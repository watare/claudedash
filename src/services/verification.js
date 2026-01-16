import fs from 'fs';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { execa } from 'execa';
import { insertAuditLog } from '../db/sqlite.js';

// ============================================================================
// Story 3.2: Status Comparison Engine
// ============================================================================

/**
 * @typedef {Object} VerificationResult
 * @property {string} storyKey - Story identifier (e.g., '3-1-yaml-status-reader-service')
 * @property {string} claimed - Normalized status the agent claims
 * @property {string} actual - Normalized actual status from YAML
 * @property {boolean} match - Whether claimed matches actual
 * @property {string} timestamp - ISO 8601 timestamp of verification
 * @property {number} attemptCount - Number of verification attempts for this story
 * @property {string} [lastChecked] - ISO 8601 timestamp of last check (set by store)
 * @property {string} [error] - Error message if verification failed
 */

/**
 * Status aliases for normalization
 * Maps various status terms to canonical values
 */
const STATUS_ALIASES = {
  'complete': 'done',
  'completed': 'done',
  'finished': 'done',
  'pending': 'backlog',
  'todo': 'backlog',
  'wip': 'in-progress',
  'working': 'in-progress'
};

// ============================================================================
// Story 3.5: Verification Logging & Audit
// ============================================================================

/**
 * Valid result types for verification audit logs
 */
const VALID_RESULT_TYPES = ['match', 'mismatch', 'error'];

/**
 * Log verification attempt to audit_log table
 * Handles database errors gracefully (logs to console but doesn't crash)
 * @param {Object} entry - Audit log entry
 * @param {string} entry.timestamp - ISO 8601 timestamp
 * @param {string} entry.storyId - Story identifier
 * @param {string} [entry.projectId] - Project identifier
 * @param {string} entry.claimedStatus - Status claimed by agent
 * @param {string} entry.actualStatus - Actual status from YAML
 * @param {'match'|'mismatch'|'error'} entry.result - Verification result
 * @param {string} [entry.actionTaken] - Action taken after verification
 * @param {number} [entry.durationMs] - Duration in milliseconds
 * @param {number} [entry.attemptCount] - Number of attempts
 * @param {string} [entry.details] - Additional JSON details
 */
export function logVerificationAttempt(entry) {
  // Validate result type early to catch programming errors
  if (!VALID_RESULT_TYPES.includes(entry.result)) {
    console.log(chalk.yellow(`[AUDIT] Warning: Invalid result type '${entry.result}', must be one of: ${VALID_RESULT_TYPES.join(', ')}`));
    return null;
  }

  try {
    const rowId = insertAuditLog(entry);
    console.log(chalk.gray(`[AUDIT] Verification logged (id: ${rowId}): ${entry.storyId} - ${entry.result}`));
    return rowId;
  } catch (error) {
    // Don't crash on audit log failure - just log the error
    console.log(chalk.yellow(`[AUDIT] Warning: Failed to log verification attempt: ${error.message}`));
    return null;
  }
}

/**
 * In-memory storage for verification results
 * @type {Map<string, VerificationResult>}
 */
const verificationResults = new Map();

/**
 * Normalize status string for comparison
 * @param {string} status - Raw status string
 * @returns {string} - Normalized status
 */
export function normalizeStatus(status) {
  const normalized = status?.toLowerCase()?.trim() || 'unknown';
  return STATUS_ALIASES[normalized] || normalized;
}

/**
 * Compare claimed status against actual YAML status
 * @param {string} storyKey - Story identifier (e.g., '3-1-yaml-status-reader-service')
 * @param {string} claimedStatus - Status the agent claims
 * @param {string} yamlFilePath - Path to sprint-status.yaml
 * @param {Object} [options] - Additional options
 * @param {string} [options.projectId] - Project identifier for audit logging
 * @param {boolean} [options.skipAuditLog] - Skip audit logging (for re-verification internal calls)
 * @returns {Promise<VerificationResult>}
 */
export async function compareStatus(storyKey, claimedStatus, yamlFilePath, options = {}) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Get existing result to track attempt count
  const existingResult = verificationResults.get(storyKey);
  const attemptCount = (existingResult?.attemptCount || 0) + 1;

  try {
    // Read actual status from YAML
    const yamlResult = readYamlStatus(yamlFilePath);

    if (!yamlResult.success) {
      const durationMs = Date.now() - startTime;
      const result = {
        storyKey,
        claimed: normalizeStatus(claimedStatus),
        actual: 'unknown',
        match: false,
        timestamp,
        attemptCount,
        error: yamlResult.error
      };

      // Log the error
      console.log(chalk.red(`[VERIFY] Story ${storyKey}: ERROR - ${yamlResult.error}`));

      // Store result
      storeVerificationResult(storyKey, result);

      // Log to audit (Story 3.5)
      if (!options.skipAuditLog) {
        logVerificationAttempt({
          timestamp,
          storyId: storyKey,
          projectId: options.projectId,
          claimedStatus: result.claimed,
          actualStatus: result.actual,
          result: 'error',
          durationMs,
          attemptCount,
          details: JSON.stringify({ error: yamlResult.error })
        });
      }

      return result;
    }

    // Get actual status from parsed YAML
    const actualRaw = getStoryStatus(yamlResult.data, storyKey);
    const claimed = normalizeStatus(claimedStatus);
    const actual = normalizeStatus(actualRaw);
    const match = claimed === actual;
    const durationMs = Date.now() - startTime;

    const result = {
      storyKey,
      claimed,
      actual,
      match,
      timestamp,
      attemptCount
    };

    // Log with appropriate styling
    if (match) {
      console.log(chalk.green(`[VERIFY] Story ${storyKey}: MATCH (${actual})`));
    } else {
      console.log(chalk.red(`[VERIFY] Story ${storyKey}: MISMATCH`));
      console.log(chalk.red(`  Claimed: ${claimed}`));
      console.log(chalk.red(`  Actual:  ${actual}`));
      console.log(chalk.red(`  Action:  Blocking progression until resolved`));
    }

    // Store result
    storeVerificationResult(storyKey, result);

    // Log to audit (Story 3.5)
    if (!options.skipAuditLog) {
      logVerificationAttempt({
        timestamp,
        storyId: storyKey,
        projectId: options.projectId,
        claimedStatus: claimed,
        actualStatus: actual,
        result: match ? 'match' : 'mismatch',
        durationMs,
        attemptCount
      });
    }

    return result;

  } catch (error) {
    const durationMs = Date.now() - startTime;
    const result = {
      storyKey,
      claimed: normalizeStatus(claimedStatus),
      actual: 'unknown',
      match: false,
      timestamp,
      attemptCount,
      error: error.message
    };

    console.log(chalk.red(`[VERIFY] Story ${storyKey}: ERROR - ${error.message}`));
    storeVerificationResult(storyKey, result);

    // Log to audit (Story 3.5)
    if (!options.skipAuditLog) {
      logVerificationAttempt({
        timestamp,
        storyId: storyKey,
        projectId: options.projectId,
        claimedStatus: result.claimed,
        actualStatus: result.actual,
        result: 'error',
        durationMs,
        attemptCount,
        details: JSON.stringify({ error: error.message })
      });
    }

    return result;
  }
}

/**
 * Store verification result for later retrieval
 * @param {string} storyKey - Story identifier
 * @param {VerificationResult} result - Verification result to store
 */
export function storeVerificationResult(storyKey, result) {
  verificationResults.set(storyKey, {
    ...result,
    lastChecked: new Date().toISOString()
  });
}

/**
 * Get stored verification result
 * @param {string} storyKey - Story identifier
 * @returns {VerificationResult|null}
 */
export function getVerificationResult(storyKey) {
  return verificationResults.get(storyKey) || null;
}

/**
 * Clear verification result
 * @param {string} storyKey - Story identifier
 */
export function clearVerificationResult(storyKey) {
  verificationResults.delete(storyKey);
}

/**
 * Get all verification results
 * @returns {Map<string, VerificationResult>}
 */
export function getAllVerificationResults() {
  return new Map(verificationResults);
}

/**
 * Clear all verification results (useful for testing)
 */
export function clearAllVerificationResults() {
  verificationResults.clear();
}

// ============================================================================
// Story 3.1: YAML Status Reader Service
// ============================================================================

/**
 * Read and parse YAML status file
 * @param {string} filePath - Absolute path to YAML file
 * @returns {{ success: boolean, data?: object, error?: string, status?: string, code?: string }}
 */
export function readYamlStatus(filePath) {
  try {
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Handle empty file
    if (!content || content.trim() === '') {
      console.log(chalk.yellow(`[verification] Empty file: ${filePath}`));
      return {
        success: false,
        error: 'File is empty',
        status: 'unknown',
        code: 'EMPTY_FILE'
      };
    }

    // Handle YAML frontmatter in mixed markdown/YAML files
    // Frontmatter is delimited by --- at start and end
    let yamlContent = content;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      // Extract content after frontmatter
      const afterFrontmatter = content.slice(frontmatterMatch[0].length);
      // Try to find YAML content after the frontmatter
      yamlContent = afterFrontmatter;
    }

    // Parse YAML content
    const data = yaml.load(yamlContent);

    // Validate parsed data
    if (!data || typeof data !== 'object') {
      console.log(chalk.yellow(`[verification] No valid YAML data in: ${filePath}`));
      return {
        success: false,
        error: 'No valid YAML data found',
        status: 'unknown',
        code: 'INVALID_YAML_DATA'
      };
    }

    return {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Handle file read errors
    if (error.code === 'ENOENT') {
      console.log(chalk.red(`[verification] File not found: ${filePath}`));
      return {
        success: false,
        error: `File not found: ${filePath}`,
        status: 'unknown',
        code: 'FILE_READ_ERROR'
      };
    }

    // Handle YAML parse errors
    if (error.name === 'YAMLException') {
      console.log(chalk.red(`[verification] YAML parse error in ${filePath}: ${error.message}`));
      return {
        success: false,
        error: `YAML parse error: ${error.message}`,
        status: 'unknown',
        code: 'YAML_PARSE_ERROR'
      };
    }

    // Handle other errors
    console.log(chalk.red(`[verification] Error reading ${filePath}: ${error.message}`));
    return {
      success: false,
      error: error.message,
      status: 'unknown',
      code: 'FILE_READ_ERROR'
    };
  }
}

/**
 * Extract status for specific story
 * @param {object} yamlData - Parsed YAML data
 * @param {string} storyKey - Story key like '3-1-yaml-status-reader-service'
 * @returns {string} - Status string or 'unknown'
 */
export function getStoryStatus(yamlData, storyKey) {
  // Handle null/undefined yamlData
  if (!yamlData || typeof yamlData !== 'object') {
    return 'unknown';
  }

  // Try development_status wrapper first (standard format)
  if (yamlData.development_status && typeof yamlData.development_status === 'object') {
    const status = yamlData.development_status[storyKey];
    if (typeof status === 'string') {
      return status;
    }
  }

  // Fall back to legacy format (no wrapper)
  const legacyStatus = yamlData[storyKey];
  if (typeof legacyStatus === 'string') {
    return legacyStatus;
  }

  return 'unknown';
}

/**
 * Get all story statuses from YAML
 * @param {object} yamlData - Parsed YAML data
 * @returns {Map<string, string>} - Map of storyKey -> status
 */
export function getAllStatuses(yamlData) {
  const statuses = new Map();

  // Handle null/undefined yamlData
  if (!yamlData || typeof yamlData !== 'object') {
    return statuses;
  }

  // Get status source - prefer development_status wrapper
  const statusSource = yamlData.development_status || yamlData;

  if (typeof statusSource !== 'object') {
    return statuses;
  }

  // Extract all status entries
  for (const [key, value] of Object.entries(statusSource)) {
    // Only include string values (actual statuses like 'done', 'in-progress')
    // Filter out metadata like generated date, project name, etc.
    if (typeof value === 'string') {
      statuses.set(key, value);
    }
  }

  return statuses;
}

// ============================================================================
// Story 3.3: Re-Verification Workflow Trigger
// ============================================================================

/**
 * @typedef {Object} ReVerificationResult
 * @property {string} storyKey - Story identifier
 * @property {boolean} resolved - Whether the mismatch was resolved
 * @property {number} attempts - Number of verification attempts made
 * @property {string} finalStatus - Final status after verification
 * @property {string} [error] - Error message if verification failed
 * @property {number} duration - Total duration in milliseconds
 */

/**
 * @typedef {Object} SubprocessResult
 * @property {number} exitCode - Exit code of the subprocess
 * @property {string} output - Combined stdout and stderr output
 */

/**
 * Default configuration for verification retry logic
 */
export const VERIFICATION_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 5000,  // Wait 5s between retries
  timeoutMs: 120000,   // 2 min timeout per attempt
};

/**
 * Build verification prompt for Claude agent
 * @param {string} storyKey - Story identifier
 * @param {string} claimed - Claimed status
 * @param {string} actual - Actual status from YAML
 * @param {string} yamlPath - Path to sprint-status.yaml
 * @returns {string} - Verification prompt
 */
export function buildVerificationPrompt(storyKey, claimed, actual, yamlPath) {
  return `You are a verification agent. A status mismatch has been detected:

Story: ${storyKey}
Claimed Status: ${claimed}
Actual Status in YAML: ${actual}
YAML File: ${yamlPath}

Your task:
1. Read the sprint-status.yaml file at the path above
2. Verify the actual state of story "${storyKey}"
3. If the story IS actually "${claimed}", update the YAML to set status to "${claimed}"
4. If the story is NOT "${claimed}", report the discrepancy

IMPORTANT:
- Do NOT update the status to something incorrect. Verify first.
- Only modify the development_status entry for "${storyKey}"
- Preserve all other entries and file structure

After verification, report what action you took.`;
}

/**
 * Spawn Claude verification subprocess
 * @param {string} prompt - Verification prompt
 * @param {string} projectPath - Project working directory
 * @param {object} [options] - Options for subprocess
 * @returns {Promise<SubprocessResult>} - Subprocess result
 */
export async function spawnVerificationAgent(prompt, projectPath, options = {}) {
  const {
    mockCommand,
    mockArgs,
    command = 'claude',
    timeout = VERIFICATION_CONFIG.timeoutMs,
  } = options;

  // Support mock commands for testing
  const execCommand = mockCommand || command;
  const execArgs = mockArgs || [
    '--dangerously-skip-permissions',
    '--print',
    '-p', prompt
  ];

  console.log(chalk.blue(`[VERIFY] Spawning verification agent for project: ${projectPath}`));

  try {
    const subprocess = await execa(execCommand, execArgs, {
      cwd: projectPath,
      all: true,
      timeout,
      reject: false,
    });

    const result = {
      exitCode: subprocess.exitCode ?? -1,
      output: subprocess.all || subprocess.stdout || '',
    };

    console.log(chalk.blue(`[VERIFY] Verification agent completed with exit code: ${result.exitCode}`));

    return result;
  } catch (error) {
    console.log(chalk.red(`[VERIFY] Verification agent error: ${error.message}`));
    return {
      exitCode: -1,
      output: error.message,
    };
  }
}

/**
 * Trigger re-verification workflow for mismatched status
 * @param {string} storyKey - Story identifier
 * @param {VerificationResult} mismatchResult - Result from compareStatus showing mismatch
 * @param {object} [options] - Configuration overrides
 * @returns {Promise<ReVerificationResult>}
 */
export async function triggerReVerification(storyKey, mismatchResult, options = {}) {
  const startTime = Date.now();
  const config = { ...VERIFICATION_CONFIG, ...options };

  const {
    maxRetries = VERIFICATION_CONFIG.maxRetries,
    retryDelayMs = VERIFICATION_CONFIG.retryDelayMs,
    projectPath = process.cwd(),
    yamlPath,
    skipSubprocess = false,
  } = config;

  let attempts = 0;
  let resolved = false;
  let finalStatus = mismatchResult.actual;
  let lastError = null;

  console.log(chalk.yellow(`[VERIFY] Starting re-verification for story ${storyKey}`));
  console.log(chalk.yellow(`[VERIFY] Claimed: ${mismatchResult.claimed}, Actual: ${mismatchResult.actual}`));
  console.log(chalk.yellow(`[VERIFY] Max retries: ${maxRetries}`));

  while (attempts < maxRetries && !resolved) {
    attempts++;
    console.log(chalk.blue(`[VERIFY] Verification attempt ${attempts}/${maxRetries} for ${storyKey}`));

    // Build verification prompt
    const prompt = buildVerificationPrompt(
      storyKey,
      mismatchResult.claimed,
      mismatchResult.actual,
      yamlPath
    );

    // Spawn verification agent (unless skipSubprocess for testing)
    if (!skipSubprocess) {
      const subprocessResult = await spawnVerificationAgent(prompt, projectPath, config);

      if (subprocessResult.exitCode !== 0) {
        console.log(chalk.yellow(`[VERIFY] Verification agent returned non-zero exit code: ${subprocessResult.exitCode}`));
        lastError = `Verification subprocess failed with exit code ${subprocessResult.exitCode}`;
      }
    } else {
      console.log(chalk.gray(`[VERIFY] Skipping subprocess (test mode)`));
    }

    // Re-check status after verification attempt (skip audit log for internal recheck)
    const recheckResult = await compareStatus(storyKey, mismatchResult.claimed, yamlPath, {
      skipAuditLog: true,
      projectId: options.projectId
    });

    if (recheckResult.match) {
      console.log(chalk.green(`[VERIFY] Status resolved after ${attempts} attempt(s)`));
      resolved = true;
      finalStatus = recheckResult.actual;
    } else {
      console.log(chalk.yellow(`[VERIFY] Status still mismatched after attempt ${attempts}`));
      finalStatus = recheckResult.actual;

      // Wait before next retry (unless last attempt)
      if (attempts < maxRetries) {
        console.log(chalk.gray(`[VERIFY] Waiting ${retryDelayMs}ms before retry...`));
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  const duration = Date.now() - startTime;

  // Build result
  const result = {
    storyKey,
    resolved,
    attempts,
    finalStatus,
    duration,
  };

  // Add error if not resolved
  if (!resolved) {
    result.error = lastError || `Max verification attempts (${maxRetries}) exceeded. Status still mismatched.`;
    console.log(chalk.red(`[VERIFY] Re-verification FAILED for ${storyKey}: ${result.error}`));
  } else {
    console.log(chalk.green(`[VERIFY] Re-verification SUCCEEDED for ${storyKey} in ${duration}ms`));
  }

  // Store the final verification result
  storeVerificationResult(storyKey, {
    storyKey,
    claimed: mismatchResult.claimed,
    actual: finalStatus,
    match: resolved,
    timestamp: new Date().toISOString(),
    attemptCount: mismatchResult.attemptCount + attempts,
  });

  // Log re-verification result to audit (Story 3.5)
  logVerificationAttempt({
    timestamp: new Date().toISOString(),
    storyId: storyKey,
    projectId: options.projectId,
    claimedStatus: mismatchResult.claimed,
    actualStatus: finalStatus,
    result: resolved ? 'match' : 'mismatch',
    actionTaken: resolved ? 're-verification-resolved' : 're-verification-failed',
    durationMs: duration,
    attemptCount: attempts,
    details: resolved ? null : JSON.stringify({ error: result.error })
  });

  return result;
}

// ============================================================================
// Story 3.4: Verification Blocking Logic
// ============================================================================

/**
 * @typedef {Object} VerificationGateResult
 * @property {boolean} proceed - Whether to proceed with next story
 * @property {VerificationResult|ReVerificationResult} result - Verification result
 * @property {'pause'|'retry'|'proceed'} [action] - Recommended action
 */

/**
 * Verification gate - blocks progression until status is verified
 * This is the main entry point for the verification blocking logic.
 *
 * Note: In tests, use `skipSubprocess: true` to avoid spawning actual Claude
 * processes. The subprocess integration is tested separately via spawnVerificationAgent
 * mock tests. Production subprocess behavior relies on the same execa patterns
 * used throughout the codebase.
 *
 * @param {string} storyKey - Story identifier (e.g., '3-1-yaml-status-reader-service')
 * @param {string} claimedStatus - Status the agent claims
 * @param {string} projectPath - Path to project root
 * @param {object} [options] - Configuration options
 * @returns {Promise<VerificationGateResult>}
 */
export async function verifyBeforeProceeding(storyKey, claimedStatus, projectPath, options = {}) {
  const yamlPath = options.yamlPath ||
    `${projectPath}/_bmad-output/implementation-artifacts/sprint-status.yaml`;

  const config = {
    maxRetries: VERIFICATION_CONFIG.maxRetries,
    retryDelayMs: VERIFICATION_CONFIG.retryDelayMs,
    projectPath,
    yamlPath,
    ...options,
  };

  console.log(chalk.blue(`[VERIFY-GATE] Starting verification gate for ${storyKey}`));
  console.log(chalk.blue(`[VERIFY-GATE] Claimed status: ${claimedStatus}`));

  // Step 1: Compare status
  const result = await compareStatus(storyKey, claimedStatus, yamlPath);

  if (result.match) {
    console.log(chalk.green(`[VERIFY-GATE] Status verified for ${storyKey}, proceeding`));
    return {
      proceed: true,
      result,
      action: 'proceed'
    };
  }

  // Step 2: Attempt re-verification
  console.log(chalk.yellow(`[VERIFY-GATE] Mismatch detected for ${storyKey}, triggering re-verification`));
  const reVerifyResult = await triggerReVerification(storyKey, result, config);

  if (reVerifyResult.resolved) {
    console.log(chalk.green(`[VERIFY-GATE] Re-verification resolved for ${storyKey}, proceeding`));
    return {
      proceed: true,
      result: reVerifyResult,
      action: 'proceed'
    };
  }

  // Step 3: Max retries exceeded - pause and alert
  console.log(chalk.red(`[VERIFY-GATE] Verification failed for ${storyKey} after ${reVerifyResult.attempts} attempts`));
  return {
    proceed: false,
    result: reVerifyResult,
    action: 'pause'
  };
}
