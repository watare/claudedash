/**
 * File Watcher Service
 *
 * Monitors project directories for file changes to detect agent activity.
 * Since Claude CLI uses a daemon architecture, we can't capture stdout directly.
 * Instead, we watch for file modifications to determine if an agent is active.
 */

import fs from 'fs';
import path from 'path';
import { watch } from 'chokidar';
import { updateAgentActivity } from './agentRegistry.js';
import { updateAgentOutput } from '../claude-runner.js';

/**
 * @typedef {Object} ProjectWatcher
 * @property {string} projectPath - Path to the project
 * @property {string} agentId - Associated agent ID
 * @property {import('chokidar').FSWatcher} watcher - Chokidar watcher instance
 * @property {Date} lastChange - Last file change timestamp
 */

/** @type {Map<string, ProjectWatcher>} */
const watchers = new Map();

/**
 * Start watching a project directory for an agent
 * @param {string} agentId - Agent ID to associate with changes
 * @param {string} projectPath - Project directory path
 */
export function startWatching(agentId, projectPath) {
  // Stop any existing watcher for this agent
  stopWatching(agentId);

  const watcher = watch(projectPath, {
    persistent: true,
    ignoreInitial: true,
    ignored: [
      '**/node_modules/**',
      '**/.git/objects/**',
      '**/.git/logs/**',
      '**/target/**',
      '**/__pycache__/**',
      '**/*.pyc',
      '**/dist/**',
      '**/build/**',
    ],
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  const projectWatcher = {
    projectPath,
    agentId,
    watcher,
    lastChange: new Date(),
  };

  watcher.on('change', (filePath) => {
    projectWatcher.lastChange = new Date();
    updateAgentActivity(agentId);  // Update agentRegistry (for stuck detection)
    updateAgentOutput(agentId, `File changed: ${path.basename(filePath)}`);  // Update claude-runner (for API)
    console.log(`[WATCHER] File changed for ${agentId}: ${path.basename(filePath)}`);
  });

  watcher.on('add', (filePath) => {
    projectWatcher.lastChange = new Date();
    updateAgentActivity(agentId);
    updateAgentOutput(agentId, `File added: ${path.basename(filePath)}`);
    console.log(`[WATCHER] File added for ${agentId}: ${path.basename(filePath)}`);
  });

  watcher.on('unlink', (filePath) => {
    projectWatcher.lastChange = new Date();
    updateAgentActivity(agentId);
    updateAgentOutput(agentId, `File deleted: ${path.basename(filePath)}`);
    console.log(`[WATCHER] File deleted for ${agentId}: ${path.basename(filePath)}`);
  });

  watcher.on('error', (error) => {
    console.error(`[WATCHER] Error for ${agentId}:`, error.message);
  });

  watchers.set(agentId, projectWatcher);
  console.log(`[WATCHER] Started watching ${projectPath} for ${agentId}`);
}

/**
 * Stop watching for an agent
 * @param {string} agentId - Agent ID
 */
export function stopWatching(agentId) {
  const watcher = watchers.get(agentId);
  if (watcher) {
    watcher.watcher.close();
    watchers.delete(agentId);
    console.log(`[WATCHER] Stopped watching for ${agentId}`);
  }
}

/**
 * Get the last file change time for an agent
 * @param {string} agentId - Agent ID
 * @returns {Date|null} Last change timestamp or null if not watching
 */
export function getLastChange(agentId) {
  const watcher = watchers.get(agentId);
  return watcher ? watcher.lastChange : null;
}

/**
 * Stop all watchers
 */
export function stopAllWatching() {
  for (const [agentId, watcher] of watchers) {
    watcher.watcher.close();
    console.log(`[WATCHER] Stopped watching for ${agentId}`);
  }
  watchers.clear();
}

/**
 * Get watcher status for all active watchers
 * @returns {Object[]} Array of watcher status objects
 */
export function getWatcherStatus() {
  return Array.from(watchers.entries()).map(([agentId, watcher]) => ({
    agentId,
    projectPath: watcher.projectPath,
    lastChange: watcher.lastChange.toISOString(),
    ageMs: Date.now() - watcher.lastChange.getTime(),
  }));
}
