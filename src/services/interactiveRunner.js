/**
 * Interactive Claude Runner
 *
 * Uses PTY (pseudo-terminal) to handle interactive prompts from Claude CLI.
 * Automatically responds to known question patterns to enable autonomous operation.
 */

import * as pty from 'node-pty';
import { updateAgentOutput } from '../claude-runner.js';
import { updateAgentActivity } from './agentRegistry.js';

/**
 * Question patterns and their automatic responses
 * Each pattern has:
 * - regex: Pattern to match in Claude's output
 * - response: What to send back (can be function for dynamic response)
 * - description: For logging
 */
const QUESTION_PATTERNS = [
  // Story confirmation
  {
    regex: /(?:is this|this is) (?:the )?(?:correct |right )?story/i,
    response: 'yes',
    description: 'Story confirmation',
  },
  // Review confirmation
  {
    regex: /(?:do you want|should I|would you like) (?:me to )?review/i,
    response: 'yes',
    description: 'Review confirmation',
  },
  // Fix confirmation
  {
    regex: /(?:do you want|should I|would you like) (?:me to )?(?:fix|correct|update|change)/i,
    response: 'yes',
    description: 'Fix confirmation',
  },
  // Track/record confirmation
  {
    regex: /(?:do you want|should I|would you like) (?:me to )?(?:track|record|log|note)/i,
    response: 'yes',
    description: 'Track confirmation',
  },
  // Continue confirmation
  {
    regex: /(?:do you want|should I|would you like) (?:me to )?(?:continue|proceed|go ahead)/i,
    response: 'yes',
    description: 'Continue confirmation',
  },
  // Save/commit confirmation
  {
    regex: /(?:do you want|should I|would you like) (?:me to )?(?:save|commit|push)/i,
    response: 'yes',
    description: 'Save confirmation',
  },
  // Yes/No general questions - be careful with these
  {
    regex: /\?\s*\(y\/n\)/i,
    response: 'y',
    description: 'Y/N prompt',
  },
  {
    regex: /\?\s*\[Y\/n\]/i,
    response: 'Y',
    description: 'Y/n prompt (default yes)',
  },
  {
    regex: /\?\s*\[y\/N\]/i,
    response: 'y',
    description: 'y/N prompt (default no, but we say yes)',
  },
  // Permission prompts (should be handled by bypassPermissions, but just in case)
  {
    regex: /(?:allow|permit|authorize|grant) (?:this )?(?:action|operation|command)/i,
    response: 'yes',
    description: 'Permission prompt',
  },
  // File overwrite confirmation
  {
    regex: /(?:overwrite|replace|update) (?:this |the )?file/i,
    response: 'yes',
    description: 'Overwrite confirmation',
  },
  // Multiple choice - select first/recommended option
  {
    regex: /(?:select|choose|pick) (?:an? )?option.*:\s*$/i,
    response: '1',
    description: 'Multiple choice - select first',
  },
  // Press Enter to continue
  {
    regex: /press (?:enter|return) to (?:continue|proceed)/i,
    response: '\n',
    description: 'Press enter prompt',
  },
];

/**
 * Dynamic response patterns (need context)
 * These are checked with the story context
 */
const DYNAMIC_PATTERNS = [
  {
    // "Is story 1-1 the one you want?" - verify against actual story ID
    regex: /(?:is )?(?:story |epic )?(\d+-\d+)/i,
    check: (match, context) => {
      const mentionedId = match[1];
      return context.storyId === mentionedId;
    },
    responseIfMatch: 'yes',
    responseIfNoMatch: (match, context) => `no, please work on story ${context.storyId}`,
    description: 'Story ID verification',
  },
];

/**
 * Run Claude interactively with automatic prompt handling
 *
 * @param {string} prompt - The prompt to send to Claude
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Result with success, output, etc.
 */
export async function runClaudeInteractive(prompt, options = {}) {
  const {
    cwd = process.cwd(),
    command = 'claude',
    model = 'opus',
    timeout = 600000,
    storyId = null,
    storyTitle = null,
    agentId = null,
    onOutput = null,
    onQuestion = null,
  } = options;

  const args = [
    '--print',
    '--model', model,
    '--permission-mode', 'bypassPermissions',
    prompt,
  ];

  const context = { storyId, storyTitle };
  const startTime = Date.now();
  let accumulatedOutput = '';
  let lastQuestion = null;
  let questionCount = 0;

  return new Promise((resolve) => {
    // Spawn PTY process
    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd,
      env: process.env,
    });

    let timeoutId = null;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (!resolved) {
        resolved = true;
        try {
          ptyProcess.kill();
        } catch (e) {
          // Process may already be dead
        }
      }
    };

    // Set up timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        console.log(`[PTY] Timeout after ${timeout}ms for agent ${agentId}`);
        cleanup();
        resolve({
          success: false,
          exitCode: -1,
          output: accumulatedOutput,
          stderr: 'Process timed out',
          duration: Date.now() - startTime,
          timedOut: true,
          questionCount,
        });
      }, timeout);
    }

    // Buffer for detecting questions
    let outputBuffer = '';
    const QUESTION_BUFFER_SIZE = 500; // Check last 500 chars for questions

    ptyProcess.onData((data) => {
      accumulatedOutput += data;
      outputBuffer += data;

      // Keep buffer size manageable
      if (outputBuffer.length > QUESTION_BUFFER_SIZE * 2) {
        outputBuffer = outputBuffer.slice(-QUESTION_BUFFER_SIZE);
      }

      // Update agent activity
      if (agentId) {
        updateAgentOutput(agentId, data.slice(-200));
        updateAgentActivity(agentId);
      }

      // Call output callback
      if (onOutput) {
        onOutput(data);
      }

      // Check for questions in the buffer
      checkForQuestions(outputBuffer, ptyProcess, context, {
        agentId,
        onQuestion,
        onAnswer: (pattern, response) => {
          questionCount++;
          lastQuestion = { pattern: pattern.description, response };
          console.log(`[PTY] Agent ${agentId}: Auto-answered "${pattern.description}" with "${response}"`);
          // Clear buffer after answering to avoid re-triggering
          outputBuffer = '';
        },
      });
    });

    ptyProcess.onExit(({ exitCode }) => {
      cleanup();
      if (!resolved) {
        resolved = true;
        resolve({
          success: exitCode === 0,
          exitCode,
          output: accumulatedOutput,
          stderr: '',
          duration: Date.now() - startTime,
          questionCount,
          lastQuestion,
        });
      }
    });
  });
}

/**
 * Check output buffer for questions and respond
 */
function checkForQuestions(buffer, ptyProcess, context, callbacks) {
  const { agentId, onQuestion, onAnswer } = callbacks;

  // Check dynamic patterns first (need context)
  for (const pattern of DYNAMIC_PATTERNS) {
    const match = buffer.match(pattern.regex);
    if (match) {
      const isMatch = pattern.check(match, context);
      const response = isMatch
        ? pattern.responseIfMatch
        : (typeof pattern.responseIfNoMatch === 'function'
          ? pattern.responseIfNoMatch(match, context)
          : pattern.responseIfNoMatch);

      if (onQuestion) onQuestion(pattern.description, match[0]);

      // Send response
      ptyProcess.write(response + '\n');
      if (onAnswer) onAnswer(pattern, response);
      return;
    }
  }

  // Check static patterns
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.regex.test(buffer)) {
      const response = typeof pattern.response === 'function'
        ? pattern.response(context)
        : pattern.response;

      if (onQuestion) onQuestion(pattern.description, buffer.slice(-100));

      // Send response
      ptyProcess.write(response + '\n');
      if (onAnswer) onAnswer(pattern, response);
      return;
    }
  }
}

/**
 * Add a custom question pattern
 * @param {RegExp} regex - Pattern to match
 * @param {string|Function} response - Response to send
 * @param {string} description - Description for logging
 */
export function addQuestionPattern(regex, response, description) {
  QUESTION_PATTERNS.push({ regex, response, description });
}

/**
 * Get all registered question patterns (for debugging/display)
 */
export function getQuestionPatterns() {
  return [
    ...QUESTION_PATTERNS.map(p => ({
      pattern: p.regex.toString(),
      description: p.description,
    })),
    ...DYNAMIC_PATTERNS.map(p => ({
      pattern: p.regex.toString(),
      description: p.description,
      dynamic: true,
    })),
  ];
}
