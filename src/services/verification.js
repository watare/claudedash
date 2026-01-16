import fs from 'fs';
import yaml from 'js-yaml';
import chalk from 'chalk';

// ============================================================================
// Story 3.2: Status Comparison Engine
// ============================================================================

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
 * @returns {Promise<VerificationResult>}
 */
export async function compareStatus(storyKey, claimedStatus, yamlFilePath) {
  const timestamp = new Date().toISOString();

  // Get existing result to track attempt count
  const existingResult = verificationResults.get(storyKey);
  const attemptCount = (existingResult?.attemptCount || 0) + 1;

  try {
    // Read actual status from YAML
    const yamlResult = readYamlStatus(yamlFilePath);

    if (!yamlResult.success) {
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
      return result;
    }

    // Get actual status from parsed YAML
    const actualRaw = getStoryStatus(yamlResult.data, storyKey);
    const claimed = normalizeStatus(claimedStatus);
    const actual = normalizeStatus(actualRaw);
    const match = claimed === actual;

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
    return result;

  } catch (error) {
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
