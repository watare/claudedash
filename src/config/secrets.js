import { readFileSync, existsSync } from 'fs';
import { load as parseYaml } from 'js-yaml';
import { join } from 'path';
import { homedir } from 'os';

const SECRETS_FILENAME = 'bmad-orchestrator.secrets.yaml';

// Keys that should be redacted in logs (patterns that indicate actual secrets, not paths)
const REDACT_KEYS = ['secret', 'password', 'token', 'credential', 'hash', 'api_key', 'private_key', 'ssh_key'];

// Cached secrets (loaded once)
let cachedSecrets = null;
let secretsPath = null;

/**
 * Get the path to the secrets file
 * @param {string} [projectRoot] - Optional project root override
 * @returns {string} Path to secrets file
 */
function getSecretsPath(projectRoot = null) {
  if (secretsPath) return secretsPath;
  const root = projectRoot || process.cwd();
  secretsPath = join(root, SECRETS_FILENAME);
  return secretsPath;
}

/**
 * Validate that all required secrets are present
 * @param {object} secrets - Parsed secrets object
 * @throws {Error} If required secrets are missing
 */
function validateSecrets(secrets) {
  const errors = [];

  // Check github.client_id
  if (!secrets.github?.client_id) {
    errors.push(
      `Missing required secret: github.client_id\n` +
      `       Please add this to ${SECRETS_FILENAME}\n` +
      `       Example:\n` +
      `         github:\n` +
      `           client_id: "your_client_id_here"`
    );
  }

  // Check github.client_secret
  if (!secrets.github?.client_secret) {
    errors.push(
      `Missing required secret: github.client_secret\n` +
      `       Please add this to ${SECRETS_FILENAME}\n` +
      `       Example:\n` +
      `         github:\n` +
      `           client_secret: "your_client_secret_here"`
    );
  }

  // Check allowed_users
  if (!secrets.allowed_users || !Array.isArray(secrets.allowed_users) || secrets.allowed_users.length === 0) {
    errors.push(
      `Missing required secret: allowed_users\n` +
      `       Please add this to ${SECRETS_FILENAME}\n` +
      `       Example:\n` +
      `         allowed_users:\n` +
      `           - "your_github_username"`
    );
  }

  if (errors.length > 0) {
    const message = `ERROR: ${errors.length} missing required secret(s):\n\n` +
      errors.map((e, i) => `${i + 1}. ${e}`).join('\n\n');
    throw new Error(message);
  }
}

/**
 * Load secrets from the secrets file
 * @param {string} [projectRoot] - Optional project root override
 * @returns {object} Parsed secrets object
 * @throws {Error} If secrets file not found or invalid
 */
export function loadSecrets(projectRoot = null) {
  if (cachedSecrets) return cachedSecrets;

  const filePath = getSecretsPath(projectRoot);

  if (!existsSync(filePath)) {
    console.error(`ERROR: Secrets file not found: ${SECRETS_FILENAME}`);
    console.error(`       Copy ${SECRETS_FILENAME.replace('.yaml', '.example.yaml')} and fill in your values.`);
    console.error(`       Location: ${filePath}`);
    process.exit(1);
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    cachedSecrets = parseYaml(content);
    validateSecrets(cachedSecrets);
    return cachedSecrets;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`ERROR: Secrets file not found: ${SECRETS_FILENAME}`);
      console.error(`       Copy ${SECRETS_FILENAME.replace('.yaml', '.example.yaml')} and fill in your values.`);
      process.exit(1);
    }
    // Re-throw validation errors or parsing errors
    console.error(`ERROR: Failed to load secrets: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Get GitHub OAuth credentials
 * @returns {{ client_id: string, client_secret: string }}
 */
export function getGitHubCredentials() {
  const secrets = loadSecrets();
  return {
    client_id: secrets.github.client_id,
    client_secret: secrets.github.client_secret,
  };
}

/**
 * Get the list of allowed users
 * @returns {string[]} Array of allowed GitHub usernames
 */
export function getAllowedUsers() {
  const secrets = loadSecrets();
  return secrets.allowed_users || [];
}

/**
 * Check if a user is allowed
 * @param {string} username - GitHub username to check
 * @returns {boolean} True if user is allowed
 */
export function isUserAllowed(username) {
  const allowedUsers = getAllowedUsers();
  return allowedUsers.includes(username);
}

/**
 * Get SSH configuration (if configured)
 * @returns {{ key_path: string, host: string, user: string } | null}
 */
export function getSSHConfig() {
  const secrets = loadSecrets();

  if (!secrets.ssh) return null;

  const { key_path, host, user } = secrets.ssh;

  if (!key_path || !host || !user) return null;

  // Expand ~ to home directory
  const expandedKeyPath = key_path.startsWith('~')
    ? join(homedir(), key_path.slice(1))
    : key_path;

  return {
    key_path: expandedKeyPath,
    host,
    user,
  };
}

/**
 * Get password users configuration (if configured)
 * @returns {Array<{ email: string, password_hash: string }> | null}
 */
export function getPasswordUsers() {
  const secrets = loadSecrets();
  return secrets.password_users || null;
}

/**
 * Get notification configuration (if configured)
 * @returns {{ webhook_url?: string, slack_webhook_url?: string } | null}
 */
export function getNotificationConfig() {
  const secrets = loadSecrets();
  return secrets.notifications || null;
}

/**
 * Get Anthropic API key for Supervisor AI (if configured)
 * @returns {string | null} API key or null if not configured
 */
export function getAnthropicApiKey() {
  const secrets = loadSecrets();
  return secrets.anthropic?.api_key || null;
}

/**
 * Sanitize an object for safe logging by redacting sensitive values
 * @param {any} obj - Object to sanitize
 * @returns {any} Sanitized copy of the object
 */
export function sanitizeForLogging(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (REDACT_KEYS.some(k => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Reset cached secrets (for testing)
 */
export function resetSecretsCache() {
  cachedSecrets = null;
  secretsPath = null;
}
