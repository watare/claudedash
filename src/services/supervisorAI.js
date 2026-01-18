/**
 * BMAD Orchestrator Supervisor AI
 *
 * Lightweight AI service that intelligently answers agent questions
 * using the BMAD methodology. Uses Claude 3.5 Haiku for fast, cheap responses.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicApiKey } from '../config/secrets.js';

// Supervisor system prompt - BMAD multi-project methodology
const SUPERVISOR_SYSTEM_PROMPT = `You are **BMAD Orchestrator**, supervising **multiple parallel projects** that each follow the **BMAD Method** (spec-driven, role-based workflows: Analyst/PM/PO/Architect/SM/Dev/QA/UX).

## 0) Mission

Coordinate agents so that every interaction results in:
1. a clear next action,
2. updated documentation,
3. updated status in the tracking system,
4. code changes committed when applicable.

## 1) Operating principles (non-negotiable)

* **Move forward every turn**: no vague answers; always conclude with explicit next steps and who owns them.
* **Always document**: every decision, assumption, interface, and outcome must land in the project docs (ADR, README, specs, changelog, runbook, etc.).
* **Commit after each dev task**: if code changes were made, there must be a commit (small, atomic, descriptive).
* **Always update status**: ensure the work item transitions correctly (e.g., Review -> Done, Blocked, In Progress).
* **Fresh Claude per task**: for each new task or work item, instruct the team to **close the previous Claude session and start a new one**, to avoid context leakage and drift.
* **Answer agent questions** quickly, precisely, and in a way that unblocks execution.
* **BMAD compliance**: enforce the workflow gates (analysis/planning/design/implementation) and route the question to the right role/agent when needed.

## 2) Default interaction pattern (every time an agent asks something)

When any agent asks a question, respond using this structure:

**A. Decision / Answer**
* Provide the direct answer.
* If there are options, pick one by default and state why (briefly), unless risk is high.

**B. Actionable next steps**
* A numbered list of concrete actions (who does what).
* Include acceptance criteria when relevant.

**C. Documentation updates (mandatory)**
* List the exact doc artifacts to update (file names/sections).
* State what must be written (not "update docs" - be specific).

**D. Status + commit rules**
* Status transition required (e.g., "set STORY-123 to Review").
* If dev work is involved: require an **atomic commit** + message template.

## 3) Output format constraints

* Keep answers short and operational.
* Prefer checklists.
* If an agent proposes work without a ticket/task ID: create/require one before proceeding.
* If asked for "review": always return **(1) Correctness verdict** + **(2) Documentation checklist** + **(3) Status change**.

## 4) Routing rules (who should answer/do what)

* Requirements ambiguity -> Analyst/PM
* Backlog priority / story slicing -> PO/SM
* Architecture / interfaces / non-functional constraints -> Architect
* Implementation / refactoring / integration -> Dev
* Test strategy / coverage / quality gate -> QA
* UX flows / copy / UI consistency -> UX

If the wrong agent is asking, answer briefly then re-route with explicit instructions.

## 5) Quality gates you enforce

Before a task can move to **Done**:
* Definition of Done satisfied (tests pass, lint pass, build pass as applicable)
* Docs updated (what changed, how to run, how to test, known limits)
* Status updated in tracker
* Code committed (and ideally PR/merge if your process uses it)
* No open TODOs without linked tickets

## 6) Templates you impose

**Commit message template**
* \`type(scope): short imperative summary\`
* Examples:
  * \`feat(api): add invoice import endpoint\`
  * \`fix(parser): handle empty attachment body\`
  * \`docs(runbook): add recovery procedure\`

**Answer template for code-review workflow**
1. **Correctness**: (Correct / Needs changes) + 2-5 bullet findings
2. **Required docs**: list exact docs/sections to update
3. **Next actions**: ordered checklist + owner
4. **Status change**: e.g., "keep in Review" or "move to Done after docs+commit"

## 7) Response Style

For most questions, provide a SHORT, DIRECT answer that the agent can act on immediately.
Do NOT be verbose. Get to the point. The agent is waiting.

If the question is a simple choice (1, 2, or 3?), just answer with the choice.
If the question is about which issues to fix, answer "all" or list the specific ones.
If the question is yes/no, answer yes or no with brief reasoning if needed.

ALWAYS end with the concrete action the agent should take next.`;

// Anthropic client (lazy initialization)
let anthropicClient = null;

/**
 * Get or create Anthropic client
 * @returns {Anthropic | null} Anthropic client or null if not configured
 */
function getClient() {
  if (anthropicClient) return anthropicClient;

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    console.warn('[SupervisorAI] No Anthropic API key configured - supervisor AI disabled');
    return null;
  }

  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

/**
 * Classify if a question is complex (needs AI) or simple (can use regex)
 * @param {string} question - The question text
 * @returns {boolean} True if complex, false if simple
 */
export function isComplexQuestion(question) {
  // Simple patterns that don't need AI
  const simplePatterns = [
    /\?\s*\(y\/n\)/i,           // (y/n)
    /\?\s*\[Y\/n\]/i,           // [Y/n]
    /\?\s*\[y\/N\]/i,           // [y/N]
    /press (?:enter|return)/i,  // Press enter
    /overwrite.*\?/i,           // Overwrite file?
  ];

  for (const pattern of simplePatterns) {
    if (pattern.test(question)) {
      return false; // Simple question
    }
  }

  // Complex patterns that need AI
  const complexPatterns = [
    /which.*(?:issue|option|choice|item)/i,           // Which issues/options?
    /(?:select|choose|pick).*(?:\d+.*\d+|\d+\s*(?:,|and|or))/i,  // Select 1, 2, or 3
    /(?:fix|address|resolve).*(?:all|which|specific)/i,  // Fix all or specific?
    /how.*(?:should|would|could)/i,                   // How should we...?
    /what.*(?:approach|strategy|method)/i,            // What approach?
    /(?:prioritize|priority|first|order)/i,           // Priority questions
    /(?:architecture|design|interface)/i,             // Architecture questions
    /(?:clarify|explain|elaborate)/i,                 // Clarification requests
    /(?:review|feedback|opinion)/i,                   // Review requests
    /(?:decision|decide|choice)/i,                    // Decision requests
  ];

  for (const pattern of complexPatterns) {
    if (pattern.test(question)) {
      return true; // Complex question
    }
  }

  // Check for multi-option patterns: "1, 2, 3" or "1+2" or "option A, B"
  if (/\d+\s*[,+]\s*\d+/.test(question) || /option\s+\w+\s*[,+]/i.test(question)) {
    return true;
  }

  // Default to simple for anything else
  return false;
}

/**
 * Answer an agent question using the Supervisor AI
 * @param {string} question - The question from the agent
 * @param {object} context - Context about the current work
 * @returns {Promise<{answer: string, reasoning?: string} | null>} Response or null if unavailable
 */
export async function answerAgentQuestion(question, context = {}) {
  const client = getClient();
  if (!client) {
    return null; // Fall back to regex
  }

  const {
    projectId = 'unknown',
    storyId = null,
    phase = 'implementation',
    recentOutput = '',
  } = context;

  // Build context message
  const contextMessage = `
## Current Context
- Project: ${projectId}
- Story: ${storyId || 'N/A'}
- Phase: ${phase}

## Recent Agent Output
\`\`\`
${recentOutput.slice(-500)}
\`\`\`

## Agent Question
${question}

Provide a concise answer that unblocks the agent. Be direct and actionable.`;

  try {
    console.log(`[SupervisorAI] Answering question for ${projectId}/${storyId || 'N/A'}`);

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: SUPERVISOR_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: contextMessage }
      ],
    });

    const answer = response.content[0]?.text || '';

    console.log(`[SupervisorAI] Response: ${answer.slice(0, 100)}...`);

    return {
      answer: answer.trim(),
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    };
  } catch (error) {
    console.error(`[SupervisorAI] Error: ${error.message}`);
    return null; // Fall back to regex
  }
}

/**
 * Extract a simple one-line answer from the full response
 * For sending to the agent via PTY
 * @param {string} fullAnswer - Full supervisor response
 * @returns {string} Simplified answer for agent
 */
export function extractSimpleAnswer(fullAnswer) {
  if (!fullAnswer) return 'yes';

  // If it's already short, use it directly
  if (fullAnswer.length < 100 && !fullAnswer.includes('\n')) {
    return fullAnswer;
  }

  // Look for a direct answer pattern
  const patterns = [
    /^(?:answer|decision|response):\s*(.+)/im,
    /^(?:yes|no|all|\d+(?:\s*,\s*\d+)*)/im,
    /^\*\*(?:decision|answer)\*\*:\s*(.+)/im,
  ];

  for (const pattern of patterns) {
    const match = fullAnswer.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  // Take the first sentence/line as the answer
  const firstLine = fullAnswer.split('\n')[0].trim();
  if (firstLine.length < 200) {
    return firstLine;
  }

  // Last resort: first 100 chars
  return fullAnswer.slice(0, 100).trim();
}

/**
 * Check if Supervisor AI is available
 * @returns {boolean} True if configured and ready
 */
export function isSupervisorAvailable() {
  return getAnthropicApiKey() !== null;
}
