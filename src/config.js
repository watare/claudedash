import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  loadSecrets,
  getGitHubCredentials,
  getAllowedUsers,
  isUserAllowed,
  getSSHConfig,
  getPasswordUsers,
  getNotificationConfig,
  sanitizeForLogging,
} from './config/secrets.js';

/**
 * Default configuration
 */
export const defaultConfig = {
  // Parallelism settings
  epicBatchSize: 2,           // Run epics in batches (e.g., 2 = Epic 1+2, then 3+4)
  maxParallelStories: 1,      // Sequential stories within project (parallel is for independent projects)
  continueOnEpicFailure: false, // Continue to next batch if epic fails

  // Claude Code settings
  claudeCommand: 'claude',    // CLI command (or full path)
  claudeModel: 'opus',        // Model to use
  claudeTimeout: 600000,      // 10 min timeout per operation

  // Code review settings
  maxReviewIterations: 5,     // Max fix cycles before giving up
  reviewSeverityThreshold: 'medium', // Stop when no issues at this level or above

  // Story retry settings (Story 4.3)
  maxStoryRetries: 3,         // Maximum retry attempts before warning

  // Stuck detection settings (Story 4.6)
  stuckThresholdMinutes: 5,   // Minutes without activity before marking agent as stuck

  // Git settings
  baseBranch: 'main',
  branchPrefix: 'feature/',
  autoCommit: true,
  autoPush: true,

  // Paths (relative to project root)
  epicsFile: '_bmad-output/planning-artifacts/epics.md',
  sprintStatusFile: '_bmad-output/implementation-artifacts/sprint-status.yaml',
  storiesDir: '_bmad-output/implementation-artifacts',

  // Output
  logDir: '_bmad-output/orchestrator-logs',
  reportFile: '_bmad-output/orchestrator-report.md',

  // Dashboard
  dashboardPort: 3456,
};

/**
 * Load configuration from file and merge with defaults
 */
export function loadConfig(projectRoot, configPath = null) {
  const config = { ...defaultConfig, projectRoot };

  // Try to find config file
  const configLocations = configPath
    ? [configPath]
    : [
        path.join(projectRoot, 'bmad-orchestrator.yaml'),
        path.join(projectRoot, 'bmad-orchestrator.json'),
        path.join(projectRoot, '_bmad/_config/orchestrator.yaml'),
      ];

  for (const loc of configLocations) {
    if (fs.existsSync(loc)) {
      const content = fs.readFileSync(loc, 'utf8');
      const fileConfig = loc.endsWith('.yaml') || loc.endsWith('.yml')
        ? yaml.load(content)
        : JSON.parse(content);
      Object.assign(config, fileConfig);
      config.configFile = loc;
      break;
    }
  }

  // Resolve paths relative to project root
  config.epicsPath = path.join(projectRoot, config.epicsFile);
  config.sprintStatusPath = path.join(projectRoot, config.sprintStatusFile);
  config.storiesPath = path.join(projectRoot, config.storiesDir);
  config.logPath = path.join(projectRoot, config.logDir);
  config.reportPath = path.join(projectRoot, config.reportFile);

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config) {
  const errors = [];

  if (!fs.existsSync(config.projectRoot)) {
    errors.push(`Project root not found: ${config.projectRoot}`);
  }

  if (!fs.existsSync(config.epicsPath)) {
    errors.push(`Epics file not found: ${config.epicsPath}`);
  }

  if (!fs.existsSync(config.sprintStatusPath)) {
    errors.push(`Sprint status file not found: ${config.sprintStatusPath}`);
  }

  return errors;
}

// Re-export secrets functions for convenient access
export {
  loadSecrets,
  getGitHubCredentials,
  getAllowedUsers,
  isUserAllowed,
  getSSHConfig,
  getPasswordUsers,
  getNotificationConfig,
  sanitizeForLogging,
};
