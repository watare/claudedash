import { execa } from 'execa';
import { spawn } from 'child_process';
import * as pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import {
  emitAgentSpawn,
  emitAgentOutput,
  emitAgentComplete,
} from './services/websocket.js';
import {
  registerAgent as registerAgentProcess,
  removeAgent as removeAgentProcess,
  updateAgentStatus as updateAgentProcessStatus,
  updateAgentActivity,
} from './services/agentRegistry.js';
import { startWatching, stopWatching } from './services/fileWatcher.js';
import {
  isComplexQuestion,
  answerAgentQuestion,
  extractSimpleAnswer,
  isSupervisorAvailable,
} from './services/supervisorAI.js';

/**
 * Question patterns for automatic response
 * Claude may ask questions during workflows - we auto-respond to keep automation flowing
 */
const QUESTION_PATTERNS = [
  { regex: /(?:is this|this is) (?:the )?(?:correct |right )?story/i, response: 'yes', desc: 'Story confirmation' },
  { regex: /(?:do you want|should I|would you like) (?:me to )?review/i, response: 'yes', desc: 'Review confirmation' },
  { regex: /(?:do you want|should I|would you like) (?:me to )?(?:fix|correct|update)/i, response: 'yes', desc: 'Fix confirmation' },
  { regex: /(?:do you want|should I|would you like) (?:me to )?(?:continue|proceed)/i, response: 'yes', desc: 'Continue confirmation' },
  { regex: /(?:do you want|should I|would you like) (?:me to )?(?:save|commit|push)/i, response: 'yes', desc: 'Save confirmation' },
  { regex: /(?:do you want|should I|would you like) (?:me to )?(?:track|record|log)/i, response: 'yes', desc: 'Track confirmation' },
  { regex: /\?\s*\(y\/n\)/i, response: 'y', desc: 'Y/N prompt' },
  { regex: /\?\s*\[Y\/n\]/i, response: 'Y', desc: 'Y/n prompt' },
  { regex: /\?\s*\[y\/N\]/i, response: 'y', desc: 'y/N prompt' },
  { regex: /(?:overwrite|replace) (?:this |the )?file/i, response: 'yes', desc: 'Overwrite confirmation' },
  { regex: /press (?:enter|return) to (?:continue|proceed)/i, response: '\n', desc: 'Press enter' },
  { regex: /(?:select|choose) (?:an? )?option/i, response: '1', desc: 'Select option' },
];

/**
 * Active agent tracking
 * Stores information about running Claude processes for API access
 */
const activeAgents = new Map();
let agentIdCounter = 0;

/**
 * Generate unique agent ID
 */
function generateAgentId() {
  return `agent-${Date.now()}-${++agentIdCounter}`;
}

/**
 * Register a new agent when Claude process starts
 * @param {Object} agentInfo - Agent metadata
 * @returns {string} Agent ID
 */
export function registerAgent(agentInfo) {
  const id = generateAgentId();
  const now = new Date().toISOString();

  const agent = {
    id,
    projectId: agentInfo.projectId || process.cwd().split('/').pop(),
    storyId: agentInfo.storyId || null,
    storyTitle: agentInfo.storyTitle || null,
    status: 'running',
    startedAt: now,
    lastActivity: now,
    lastOutput: '',
    outputHistory: [],
    completed: false,
    killed: false,
  };

  activeAgents.set(id, agent);

  // Broadcast agent:spawn event via WebSocket
  emitAgentSpawn(agent);

  return id;
}

/**
 * Update agent activity with new output
 * @param {string} agentId - Agent ID
 * @param {string} output - New output text
 */
export function updateAgentOutput(agentId, output) {
  const agent = activeAgents.get(agentId);
  if (agent) {
    agent.lastActivity = new Date().toISOString();
    agent.lastOutput = output;
    agent.outputHistory.push(output);
    // Keep only last 100 output entries
    if (agent.outputHistory.length > 100) {
      agent.outputHistory.shift();
    }

    // Broadcast agent:output event via WebSocket
    emitAgentOutput(agentId, output);

    // Update agentRegistry activity for stuck detection (Story 4.6)
    updateAgentActivity(agentId);
  }
}

/**
 * Mark agent as completed
 * @param {string} agentId - Agent ID
 * @param {boolean} success - Whether execution succeeded
 */
export function completeAgent(agentId, success = true) {
  const agent = activeAgents.get(agentId);
  if (agent) {
    agent.status = success ? 'completed' : 'failed';
    agent.completed = true;
    agent.lastActivity = new Date().toISOString();

    // Broadcast agent:complete event via WebSocket
    emitAgentComplete(agent, success ? 'success' : 'failed');
  }
}

/**
 * Mark agent as killed
 * @param {string} agentId - Agent ID
 */
export function killAgent(agentId) {
  const agent = activeAgents.get(agentId);
  if (agent) {
    agent.status = 'killed';
    agent.killed = true;
    agent.lastActivity = new Date().toISOString();
    // Note: WebSocket broadcast is handled by killAgentById in agents.js
    // to ensure correct AC3 format: { type: "agent:kill", data: { agentId, status: "killed" } }
  }
}

/**
 * Get all active agents (not completed or killed)
 * @returns {Array} Array of active agent objects
 */
export function getActiveAgents() {
  return Array.from(activeAgents.values())
    .filter(a => !a.completed && !a.killed);
}

/**
 * Get all agents including completed/killed
 * @returns {Array} Array of all agent objects
 */
export function getAllAgents() {
  return Array.from(activeAgents.values());
}

/**
 * Get agent by ID
 * @param {string} agentId - Agent ID
 * @returns {Object|null} Agent object or null
 */
export function getAgentById(agentId) {
  return activeAgents.get(agentId) || null;
}

/**
 * Get agents by project ID
 * @param {string} projectId - Project ID
 * @returns {Array} Array of agents for the project
 */
export function getAgentsByProject(projectId) {
  return Array.from(activeAgents.values())
    .filter(a => a.projectId === projectId && !a.completed && !a.killed);
}

/**
 * Clean up old completed agents (older than 1 hour)
 */
export function cleanupOldAgents() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, agent] of activeAgents.entries()) {
    if (agent.completed || agent.killed) {
      const lastActivityTime = new Date(agent.lastActivity).getTime();
      if (lastActivityTime < oneHourAgo) {
        activeAgents.delete(id);
      }
    }
  }
}

/**
 * Run Claude Code CLI with a prompt
 * Returns the result including success/failure and output
 * Integrates with agent tracking for dashboard visibility
 */
export async function runClaude(prompt, options = {}) {
  const {
    cwd = process.cwd(),
    command = 'claude',
    model = 'opus',
    timeout = 600000,
    logFile = null,
    allowedTools = null,
    permissionMode = 'bypassPermissions',  // bypassPermissions, default, plan
    // Agent tracking options
    projectId = null,
    storyId = null,
    storyTitle = null,
    trackAgent = true,  // Enable agent tracking by default
  } = options;

  const args = [
    '--print',           // Non-interactive, print output
    '--model', model,
    '--permission-mode', permissionMode,
  ];

  if (allowedTools) {
    args.push('--allowedTools', allowedTools.join(','));
  }

  // Add the prompt directly (not with --prompt flag)
  args.push(prompt);

  const startTime = Date.now();

  // Register agent for tracking (if enabled)
  let agentId = null;
  if (trackAgent) {
    agentId = registerAgent({
      projectId: projectId || cwd.split('/').pop(),
      storyId,
      storyTitle,
    });
  }

  try {
    // Use PTY for interactive handling - Claude may ask questions we need to answer
    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd,
      env: process.env,
    });

    console.log(`[PTY] Agent ${agentId}: PID=${ptyProcess.pid}, interactive mode enabled`);

    // Register process with agentRegistry for kill functionality (Story 4.1)
    if (agentId && ptyProcess.pid) {
      // Create a subprocess-like object for compatibility
      const processHandle = {
        pid: ptyProcess.pid,
        kill: (signal) => ptyProcess.kill(signal),
      };
      registerAgentProcess(agentId, processHandle, {
        storyId,
        projectId: projectId || cwd.split('/').pop(),
      });

      // Start file watching for activity detection
      startWatching(agentId, cwd);
    }

    // Accumulate output
    let accumulatedOutput = '';
    let outputBuffer = '';  // Buffer for question detection
    let timeoutId = null;
    let questionCount = 0;
    let resolved = false;

    // Set up timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        console.log(`[PTY] Agent ${agentId}: Timeout after ${timeout}ms`);
        try { ptyProcess.kill(); } catch (e) {}
      }, timeout);
    }

    // Track if we're waiting for AI response to prevent duplicate answers
    let waitingForAI = false;

    // Process output and handle questions
    ptyProcess.onData((data) => {
      accumulatedOutput += data;
      outputBuffer += data;

      // Keep buffer manageable
      if (outputBuffer.length > 1000) {
        outputBuffer = outputBuffer.slice(-500);
      }

      // Update agent activity
      if (agentId) {
        updateAgentOutput(agentId, data.slice(-200));
        updateAgentActivity(agentId);
      }

      // Skip question handling if we're waiting for AI response
      if (waitingForAI) return;

      // Check if output contains a question (ends with ?)
      const hasQuestion = /\?\s*$/.test(outputBuffer.trim());
      if (!hasQuestion) return;

      // Check if this is a complex question that needs Supervisor AI
      if (isSupervisorAvailable() && isComplexQuestion(outputBuffer)) {
        waitingForAI = true;
        console.log(`[PTY] Agent ${agentId}: Complex question detected, consulting Supervisor AI...`);

        // Handle async AI response
        answerAgentQuestion(outputBuffer, {
          projectId: projectId || cwd.split('/').pop(),
          storyId,
          phase: 'implementation',
          recentOutput: accumulatedOutput.slice(-1000),
        }).then((result) => {
          waitingForAI = false;
          if (result && result.answer) {
            const simpleAnswer = extractSimpleAnswer(result.answer);
            questionCount++;
            console.log(`[PTY] Agent ${agentId}: Supervisor AI answer: "${simpleAnswer.slice(0, 100)}..."`);
            ptyProcess.write(simpleAnswer + '\n');
            outputBuffer = '';
          } else {
            // Fallback to simple patterns if AI fails
            console.log(`[PTY] Agent ${agentId}: Supervisor AI unavailable, falling back to simple patterns`);
            handleSimpleQuestion();
          }
        }).catch((err) => {
          waitingForAI = false;
          console.error(`[PTY] Agent ${agentId}: Supervisor AI error: ${err.message}`);
          handleSimpleQuestion();
        });
        return;
      }

      // Handle simple questions with regex patterns
      handleSimpleQuestion();

      function handleSimpleQuestion() {
        // Check for questions that need automatic response
        for (const pattern of QUESTION_PATTERNS) {
          if (pattern.regex.test(outputBuffer)) {
            questionCount++;
            console.log(`[PTY] Agent ${agentId}: Auto-answering "${pattern.desc}" with "${pattern.response}"`);
            ptyProcess.write(pattern.response + '\n');
            outputBuffer = '';  // Clear buffer after answering
            return;
          }
        }

        // Check for story ID mismatch (dynamic pattern)
        const storyMatch = outputBuffer.match(/(?:story |epic )?(\d+-\d+)/i);
        if (storyMatch && storyId && storyMatch[1] !== storyId) {
          // Wrong story mentioned - correct it
          console.log(`[PTY] Agent ${agentId}: Correcting story ID from ${storyMatch[1]} to ${storyId}`);
          ptyProcess.write(`no, please work on story ${storyId}\n`);
          outputBuffer = '';
        }
      }
    });

    // Wait for process to complete
    const exitCode = await new Promise((resolve) => {
      ptyProcess.onExit(({ exitCode: code }) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          resolve(code ?? 0);
        }
      });
    });

    const duration = Date.now() - startTime;

    const output = {
      success: exitCode === 0,
      exitCode,
      output: accumulatedOutput,
      stderr: '',
      duration,
      command: `${command} ${args.join(' ')}`,
      agentId,
      questionCount,
    };

    // Update agent with final output and mark complete
    if (agentId) {
      completeAgent(agentId, output.success);
      // Stop file watching
      stopWatching(agentId);
      // Remove from process registry on natural exit (Story 4.1)
      removeAgentProcess(agentId);
    }

    // Write to log file if specified
    if (logFile) {
      const logEntry = `
================================================================================
TIME: ${new Date().toISOString()}
CWD: ${cwd}
PROMPT: ${prompt.substring(0, 500)}${prompt.length > 500 ? '...' : ''}
DURATION: ${duration}ms
EXIT CODE: ${exitCode}
AGENT ID: ${agentId || 'N/A'}
================================================================================
${output.output}
`;
      fs.appendFileSync(logFile, logEntry);
    }

    return output;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Mark agent as failed on error
    if (agentId) {
      updateAgentOutput(agentId, `Error: ${error.message}`);
      completeAgent(agentId, false);
      // Stop file watching
      stopWatching(agentId);
      // Remove from process registry on error (Story 4.1)
      removeAgentProcess(agentId);
    }

    const output = {
      success: false,
      exitCode: -1,
      output: '',
      stderr: error.message,
      duration,
      error: error.message,
      agentId,
    };

    if (logFile) {
      fs.appendFileSync(logFile, `\nERROR: ${error.message}\nAGENT ID: ${agentId || 'N/A'}\n`);
    }

    return output;
  }
}

/**
 * Run BMAD create-story workflow
 */
export async function runCreateStory(story, config) {
  const prompt = `
You are running the BMAD create-story workflow.

Create the story file for: Story ${story.id}: ${story.title}

Use the BMAD create-story workflow at _bmad/bmm/workflows/4-implementation/create-story/

The story details are:
- Epic: ${story.epicNumber}
- Story: ${story.storyNumber}
- Title: ${story.title}
- Slug: ${story.slug}

Create the story file at: ${config.storiesDir}/${story.slug}.md

Update the sprint-status.yaml to mark this story as 'ready-for-dev'.

Do NOT start implementing the story yet - only create the story file.
`;

  return runClaude(prompt, {
    cwd: config.projectRoot,
    command: config.claudeCommand,
    model: config.claudeModel,
    timeout: config.claudeTimeout,
    logFile: path.join(config.logPath, `${story.slug}-create.log`),
    // Agent tracking
    projectId: config.projectId || config.projectRoot.split('/').pop(),
    storyId: story.id,
    storyTitle: `Create: ${story.title}`,
  });
}

/**
 * Run BMAD dev-story workflow
 */
export async function runDevStory(story, branch, config) {
  const prompt = `
You are running the BMAD dev-story workflow for: Story ${story.id}: ${story.title}

You are on branch: ${branch}

Read the story file at: ${config.storiesDir}/${story.slug}.md

Follow the BMAD dev-story workflow at _bmad/bmm/workflows/4-implementation/dev-story/

Implement ALL acceptance criteria in the story file.

When done:
1. Commit your changes with: ${story.atomicCommit || `feat: implement story ${story.id}`}
2. Update the story file's Dev Agent Record section with what you did
3. Mark all completed tasks with [x] in the story file

DO NOT create a PR yet - just implement and commit.
`;

  return runClaude(prompt, {
    cwd: config.projectRoot,
    command: config.claudeCommand,
    model: config.claudeModel,
    timeout: config.claudeTimeout,
    logFile: path.join(config.logPath, `${story.slug}-dev.log`),
    // Agent tracking
    projectId: config.projectId || config.projectRoot.split('/').pop(),
    storyId: story.id,
    storyTitle: story.title,
  });
}

/**
 * Run code review workflow
 */
export async function runCodeReview(story, branch, config) {
  const prompt = `
You are running a code review for: Story ${story.id}: ${story.title}

Branch: ${branch}

Review ALL changes on this branch compared to ${config.baseBranch}.

Check for:
1. CRITICAL issues (security vulnerabilities, data loss, crashes)
2. MAJOR issues (broken functionality, missing error handling, logic errors)
3. MEDIUM issues (code smells, poor patterns, missing tests)
4. MINOR issues (style, naming, documentation)

Output your review in this JSON format:
{
  "summary": "Brief summary of review",
  "issues": [
    {"severity": "CRITICAL|MAJOR|MEDIUM|MINOR", "file": "path", "line": N, "description": "what's wrong", "suggestion": "how to fix"}
  ],
  "approved": true|false,
  "blockers": ["list of CRITICAL/MAJOR issues that must be fixed"]
}

Be thorough but pragmatic. Focus on real problems, not style preferences.
`;

  return runClaude(prompt, {
    cwd: config.projectRoot,
    command: config.claudeCommand,
    model: config.claudeModel,
    timeout: config.claudeTimeout,
    logFile: path.join(config.logPath, `${story.slug}-review.log`),
    // Agent tracking
    projectId: config.projectId || config.projectRoot.split('/').pop(),
    storyId: story.id,
    storyTitle: `Review: ${story.title}`,
  });
}

/**
 * Run code fixes based on review feedback
 */
export async function runCodeFixes(story, branch, reviewResults, config) {
  const prompt = `
You are fixing code review issues for: Story ${story.id}: ${story.title}

Branch: ${branch}

The code review found these issues that need fixing:
${JSON.stringify(reviewResults.issues.filter(i =>
  i.severity === 'CRITICAL' ||
  i.severity === 'MAJOR' ||
  (config.reviewSeverityThreshold === 'medium' && i.severity === 'MEDIUM')
), null, 2)}

Fix ALL listed issues. For each fix:
1. Make the code change
2. Verify it works
3. Commit with message: fix: address review feedback for story ${story.id}

Be thorough but don't over-engineer. Fix what's asked, nothing more.
`;

  return runClaude(prompt, {
    cwd: config.projectRoot,
    command: config.claudeCommand,
    model: config.claudeModel,
    timeout: config.claudeTimeout,
    logFile: path.join(config.logPath, `${story.slug}-fix.log`),
    // Agent tracking
    projectId: config.projectId || config.projectRoot.split('/').pop(),
    storyId: story.id,
    storyTitle: `Fix: ${story.title}`,
  });
}

/**
 * Create a pull request
 */
export async function runCreatePR(story, branch, config) {
  const prompt = `
Create a Pull Request for: Story ${story.id}: ${story.title}

Branch: ${branch} -> ${config.baseBranch}

Use the gh CLI to create the PR:
- Title: Story ${story.id}: ${story.title}
- Body should include:
  - Summary of what was implemented
  - Link to story file
  - Checklist of acceptance criteria met
  - Testing notes

After creating the PR, output the PR URL.
`;

  return runClaude(prompt, {
    cwd: config.projectRoot,
    command: config.claudeCommand,
    model: config.claudeModel,
    timeout: 120000,  // 2 min should be enough for PR
    logFile: path.join(config.logPath, `${story.slug}-pr.log`),
    // Agent tracking
    projectId: config.projectId || config.projectRoot.split('/').pop(),
    storyId: story.id,
    storyTitle: `PR: ${story.title}`,
  });
}

/**
 * Parse review output to extract issues
 */
export function parseReviewOutput(output) {
  try {
    // First, try to extract JSON from markdown code blocks
    const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed.issues !== undefined) {
        return parsed;
      }
    }

    // Try to find raw JSON in the output
    const jsonMatch = output.match(/\{[\s\S]*"issues"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Failed to parse - log the error for debugging
    console.error('Failed to parse review output:', e.message);
  }

  // Return default structure if parsing fails
  return {
    summary: 'Unable to parse review output',
    issues: [],
    approved: false,
    blockers: ['Review output could not be parsed'],
    _rawOutput: output.substring(0, 500),  // Include snippet for debugging
  };
}

/**
 * Check if Claude's response indicates it needs more information
 */
export function needsClarification(output) {
  const clarificationPatterns = [
    /could you (share|provide|clarify|specify|tell me)/i,
    /I('d| would) need (to see|more|additional)/i,
    /what (is|are) (the|your)/i,
    /can you (explain|describe|share)/i,
    /please (provide|specify|clarify)/i,
    /I'm not sure (what|which|how)/i,
    /before I (can|proceed)/i,
  ];

  return clarificationPatterns.some(pattern => pattern.test(output));
}

/**
 * Check if the response indicates successful completion
 */
export function isSuccessfulCompletion(output) {
  const successPatterns = [
    /successfully (created|completed|implemented|fixed|updated)/i,
    /has been (created|completed|implemented|fixed|updated)/i,
    /done|finished|complete/i,
    /committed|pushed/i,
    /PR (created|opened|ready)/i,
  ];

  return successPatterns.some(pattern => pattern.test(output));
}
