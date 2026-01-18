import { execa } from 'execa';
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
    // Start the subprocess (don't await yet to get handle for kill functionality)
    const subprocess = execa(command, args, {
      cwd,
      timeout,
      reject: false,  // Don't throw on non-zero exit
      all: true,      // Combine stdout and stderr
    });

    // Register subprocess with agentRegistry for kill functionality (Story 4.1)
    if (agentId && subprocess.pid) {
      registerAgentProcess(agentId, subprocess, {
        storyId,
        projectId: projectId || cwd.split('/').pop(),
      });
    }

    // Stream output to track activity in real-time (for stuck detection)
    if (agentId && subprocess.stdout) {
      subprocess.stdout.on('data', (chunk) => {
        updateAgentOutput(agentId, chunk.toString().slice(-200));
      });
    }
    if (agentId && subprocess.stderr) {
      subprocess.stderr.on('data', (chunk) => {
        updateAgentOutput(agentId, chunk.toString().slice(-200));
      });
    }

    // Now await the result
    const result = await subprocess;

    const duration = Date.now() - startTime;

    const output = {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      output: result.all || result.stdout || '',
      stderr: result.stderr || '',
      duration,
      command: `${command} ${args.join(' ')}`,
      agentId,  // Include agent ID in result for reference
    };

    // Update agent with final output and mark complete
    if (agentId) {
      updateAgentOutput(agentId, output.output.slice(-500));  // Last 500 chars
      completeAgent(agentId, output.success);
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
EXIT CODE: ${result.exitCode}
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
