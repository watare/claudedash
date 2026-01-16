import fs from 'fs';
import path from 'path';
import { loadConfig, validateConfig } from './config.js';
import { parseEpicsFile, parseSprintStatus, buildExecutionPlan } from './parser.js';
import { runEpicsParallel } from './epic-worker.js';
import { emitProjectPaused, emitProjectResumed } from './services/websocket.js';

// ============================================================================
// Story 3.4: Project Pause State Management
// ============================================================================

/**
 * @typedef {Object} ProjectState
 * @property {'running'|'paused'} status - Current project status
 * @property {string} [pausedAt] - ISO timestamp when paused
 * @property {string} [resumedAt] - ISO timestamp when resumed
 * @property {string} [reason] - Reason for pause
 * @property {'verification_system'|'user'} [pausedBy] - Who initiated the pause
 */

/**
 * In-memory storage for project states
 * @type {Map<string, ProjectState>}
 */
const projectStates = new Map();

/**
 * Pause project orchestration
 * @param {string} projectId - Project identifier
 * @param {string} reason - Reason for pausing
 * @returns {boolean} - True if paused, false if already paused
 */
export function pauseProject(projectId, reason) {
  const existingState = projectStates.get(projectId);
  if (existingState?.status === 'paused') {
    console.log(`[ORCHESTRATOR] Project ${projectId} is already paused`);
    return false;
  }

  const pausedAt = new Date().toISOString();

  projectStates.set(projectId, {
    status: 'paused',
    pausedAt,
    reason,
    pausedBy: 'verification_system'
  });

  // Emit WebSocket event
  emitProjectPaused({
    projectId,
    reason,
    pausedAt
  });

  console.log(`[ORCHESTRATOR] Project ${projectId} paused: ${reason}`);
  return true;
}

/**
 * Resume paused project
 * @param {string} projectId - Project identifier
 * @returns {boolean} - True if resumed, false if wasn't paused
 */
export function resumeProject(projectId) {
  const state = projectStates.get(projectId);
  if (state?.status !== 'paused') {
    console.log(`[ORCHESTRATOR] Project ${projectId} is not paused`);
    return false;
  }

  const resumedAt = new Date().toISOString();

  projectStates.set(projectId, {
    status: 'running',
    resumedAt
  });

  // Emit WebSocket event
  emitProjectResumed({
    projectId,
    resumedAt
  });

  console.log(`[ORCHESTRATOR] Project ${projectId} resumed`);
  return true;
}

/**
 * Check if project is paused
 * @param {string} projectId - Project identifier
 * @returns {boolean}
 */
export function isProjectPaused(projectId) {
  return projectStates.get(projectId)?.status === 'paused';
}

/**
 * Get project state
 * @param {string} projectId - Project identifier
 * @returns {ProjectState|undefined}
 */
export function getProjectState(projectId) {
  return projectStates.get(projectId);
}

/**
 * Get all project states
 * @returns {Map<string, ProjectState>}
 */
export function getAllProjectStates() {
  return new Map(projectStates);
}

/**
 * Clear project state (useful for testing)
 * @param {string} projectId - Project identifier
 */
export function clearProjectState(projectId) {
  projectStates.delete(projectId);
}

/**
 * Clear all project states (useful for testing)
 */
export function clearAllProjectStates() {
  projectStates.clear();
}

/**
 * Main BMAD Orchestrator
 *
 * Coordinates parallel execution of epics and stories using BMAD workflows.
 *
 * Flow:
 * 1. Parse epics.md to get all epics/stories
 * 2. Parse sprint-status.yaml to get current state
 * 3. Build execution plan (what needs to run)
 * 4. Run epics in parallel
 *    - Each epic runs its stories in parallel
 *    - Each story: create -> branch -> dev -> review loop -> PR
 * 5. When epic stories complete: merge PRs -> test
 * 6. Generate final report
 */
export class Orchestrator {
  constructor(projectRoot, options = {}) {
    this.config = loadConfig(projectRoot, options.configFile);
    Object.assign(this.config, options);
    this.logs = [];
    this.results = null;
  }

  log(message) {
    const timestamp = new Date().toISOString().substring(11, 19);
    const line = `[${timestamp}] ${message}`;
    console.log(line);
    this.logs.push(line);
  }

  async run() {
    this.log('BMAD Orchestrator starting...');
    this.log(`Project: ${this.config.projectRoot}`);
    this.log(`Config: ${this.config.configFile || 'defaults'}`);

    // Validate config
    const errors = validateConfig(this.config);
    if (errors.length > 0) {
      for (const err of errors) {
        this.log(`ERROR: ${err}`);
      }
      throw new Error('Configuration validation failed');
    }

    // Ensure log directory exists
    fs.mkdirSync(this.config.logPath, { recursive: true });

    // Parse epics and status
    this.log('Parsing epics file...');
    const epics = parseEpicsFile(this.config.epicsPath);
    this.log(`Found ${epics.length} epics`);

    this.log('Parsing sprint status...');
    const status = parseSprintStatus(this.config.sprintStatusPath);

    // Build execution plan
    this.log('Building execution plan...');
    const plan = buildExecutionPlan(epics, status, {
      startFromEpic: this.config.startFromEpic,
      endAtEpic: this.config.endAtEpic,
      onlyEpics: this.config.onlyEpics,
      skipCompleted: this.config.skipCompleted !== false,
    });

    this.log(`Execution plan:`);
    this.log(`  Epics to run: ${plan.epics.length}`);
    this.log(`  Total stories: ${plan.totalStories}`);
    this.log(`  Already completed: ${plan.storiesCompleted}`);
    this.log(`  Ready for dev: ${plan.storiesReady}`);
    this.log(`  In progress: ${plan.storiesInProgress}`);

    if (plan.epics.length === 0) {
      this.log('No epics to run. All done!');
      return { status: 'complete', plan };
    }

    // Show what will run
    this.log('\nEpics to process:');
    for (const epic of plan.epics) {
      this.log(`  Epic ${epic.number}: ${epic.title} (${epic.stories.length} stories)`);
      for (const story of epic.stories) {
        this.log(`    - ${story.id}: ${story.title} [${story.status}]`);
      }
    }

    // Confirm before running (unless in auto mode)
    if (!this.config.autoRun) {
      this.log('\nReady to start. Set autoRun:true to skip this pause.');
      // In daemon mode, just continue
    }

    // Run epics in batches/pairs
    this.log('\nStarting parallel execution...');
    this.log(`Epic batch size: ${this.config.epicBatchSize || this.config.maxParallelEpics}`);
    this.log(`Max parallel stories per epic: ${this.config.maxParallelStories}`);

    const startTime = Date.now();

    // Batch epics for execution (e.g., Epic 1+2, then Epic 3+4, etc.)
    const batchSize = this.config.epicBatchSize || this.config.maxParallelEpics;
    this.results = [];

    for (let i = 0; i < plan.epics.length; i += batchSize) {
      const batch = plan.epics.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(plan.epics.length / batchSize);

      this.log(`\n${'#'.repeat(60)}`);
      this.log(`BATCH ${batchNum}/${totalBatches}: Running Epics ${batch.map(e => e.number).join(' + ')}`);
      this.log(`${'#'.repeat(60)}`);

      const batchResults = await runEpicsParallel(
        batch,
        this.config,
        (msg) => this.log(msg),
        batchSize  // All epics in batch run in parallel
      );

      this.results.push(...batchResults);

      // Check if batch had failures
      const failedEpics = batchResults.filter(r => r.status === 'failed');
      if (failedEpics.length > 0 && !this.config.continueOnEpicFailure) {
        this.log(`\nBatch ${batchNum} had ${failedEpics.length} failed epics. Stopping.`);
        this.log(`Set continueOnEpicFailure: true to continue despite failures.`);
        break;
      }
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    this.log(`\nOrchestration completed in ${duration} minutes`);

    // Generate report
    await this.generateReport();

    return {
      status: 'complete',
      results: this.results,
      duration,
    };
  }

  async generateReport() {
    const report = [];
    report.push('# BMAD Orchestrator Report');
    report.push(`\nGenerated: ${new Date().toISOString()}`);
    report.push(`Project: ${this.config.projectRoot}`);
    report.push('');

    // Summary
    const completed = this.results.filter(r => r.status === 'completed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    report.push('## Summary');
    report.push(`- Epics processed: ${this.results.length}`);
    report.push(`- Completed: ${completed}`);
    report.push(`- Failed: ${failed}`);
    report.push('');

    // Epic details
    report.push('## Epic Results');
    for (const epic of this.results) {
      report.push(`\n### Epic ${epic.number}: ${epic.title}`);
      report.push(`Status: **${epic.status.toUpperCase()}**`);
      if (epic.error) {
        report.push(`Error: ${epic.error}`);
      }

      report.push('\n#### Stories');
      report.push('| Story | Status | PR | Duration |');
      report.push('|-------|--------|----|---------:|');
      for (const story of epic.storyResults) {
        const dur = story.startTime && story.endTime
          ? `${((new Date(story.endTime) - new Date(story.startTime)) / 1000 / 60).toFixed(1)}m`
          : '-';
        const pr = story.prUrl ? `[PR](${story.prUrl})` : '-';
        report.push(`| ${story.story} | ${story.status} | ${pr} | ${dur} |`);
      }

      if (epic.mergedPRs.length > 0) {
        report.push('\n#### Merged PRs');
        for (const pr of epic.mergedPRs) {
          report.push(`- ${pr.story}: [#${pr.pr}](${pr.url})`);
        }
      }
    }

    // Logs
    report.push('\n## Execution Log');
    report.push('```');
    report.push(this.logs.join('\n'));
    report.push('```');

    // Write report
    fs.writeFileSync(this.config.reportPath, report.join('\n'));
    this.log(`Report written to: ${this.config.reportPath}`);
  }
}

/**
 * Run orchestrator from command line
 */
export async function runOrchestrator(projectRoot, options = {}) {
  const orchestrator = new Orchestrator(projectRoot, options);
  return orchestrator.run();
}
