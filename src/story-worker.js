import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import {
  runCreateStory,
  runDevStory,
  runCodeReview,
  runCodeFixes,
  runCreatePR,
  parseReviewOutput,
  needsClarification,
  isSuccessfulCompletion,
} from './claude-runner.js';
import { updateSprintStatus } from './parser.js';
import { verifyBeforeProceeding } from './services/verification.js';
import { pauseProject, isProjectPaused } from './orchestrator.js';
import { emitStoryVerificationFailed, emitStoryVerified } from './services/websocket.js';

/**
 * Story Worker
 * Handles the complete lifecycle of a single story:
 * 1. Create story file (if needed)
 * 2. Create feature branch
 * 3. Run dev workflow
 * 4. Code review loop (review -> fix -> review until clean)
 * 5. Create PR
 */
export class StoryWorker {
  constructor(story, config, logger) {
    this.story = story;
    this.config = config;
    this.log = logger;
    // Use epic-level branch (all stories in an epic share the same branch)
    this.branch = `feature/epic-${story.epicNumber}`;
    this.result = {
      story: story.id,
      slug: story.slug,
      title: story.title,
      branch: this.branch,
      status: 'pending',
      steps: [],
      prUrl: null,
      error: null,
      startTime: null,
      endTime: null,
    };
  }

  async run() {
    this.result.startTime = new Date().toISOString();
    this.log(`Starting story ${this.story.id}: ${this.story.title}`);

    try {
      // Check if project is paused before starting
      const projectId = this.config.projectId || this.config.projectRoot;
      if (isProjectPaused(projectId)) {
        this.log(`  [${this.story.id}] Project is paused, skipping story`);
        this.result.status = 'skipped';
        this.result.error = 'Project is paused';
        this.result.endTime = new Date().toISOString();
        return this.result;
      }

      // Note: Story file creation is handled by EpicWorker.createAllStories()
      // Stories should already be 'ready-for-dev' when we get here

      // Step 1: Create and checkout branch
      await this.step('create-branch', () => this.createBranch());

      // Step 2: Run dev workflow
      await this.step('dev', () => this.runDev());

      // Step 3: Review loop
      await this.step('review-loop', () => this.reviewLoop());

      // Step 4: Verify story completion status (Story 3.4: Verification Gate)
      // Note: We verify 'review' status here because reviewLoop() sets status to 'review'
      // when code review passes. The 'done' status is set later after PR merge.
      const verificationResult = await this.step('verify-completion', () =>
        this.verifyStoryCompletion('review')
      );

      // If verification failed, don't proceed to PR
      if (!verificationResult.verified) {
        this.result.status = 'verification_failed';
        this.result.error = verificationResult.reason;
        this.log(`Failed story ${this.story.id}: ${verificationResult.reason}`);
        this.result.endTime = new Date().toISOString();
        return this.result;
      }

      // Step 5: Create PR (only if verification passed)
      await this.step('create-pr', () => this.createPR());

      // Step 6: Merge PR and return to base branch (for sequential execution)
      await this.step('merge-pr', () => this.mergePR());

      // Update status to indicate story is complete (awaiting epic merge to master)
      await updateSprintStatus(this.config.sprintStatusPath, {
        [this.story.slug]: 'story-complete',
      });

      this.result.status = 'completed';
      this.log(`Completed story ${this.story.id}`);
    } catch (error) {
      this.result.status = 'failed';
      this.result.error = error.message;
      this.log(`Failed story ${this.story.id}: ${error.message}`);
    }

    this.result.endTime = new Date().toISOString();
    return this.result;
  }

  async step(name, fn) {
    const stepResult = { name, status: 'running', startTime: new Date().toISOString() };
    this.result.steps.push(stepResult);
    this.log(`  [${this.story.id}] ${name}...`);

    try {
      const output = await fn();
      stepResult.status = 'completed';
      stepResult.output = output;
      stepResult.endTime = new Date().toISOString();
      return output;
    } catch (error) {
      stepResult.status = 'failed';
      stepResult.error = error.message;
      stepResult.endTime = new Date().toISOString();
      throw error;
    }
  }

  async createStoryFile() {
    const result = await runCreateStory(this.story, this.config);
    if (!result.success) {
      throw new Error(`Failed to create story file: ${result.stderr || result.output}`);
    }

    // Update status
    await updateSprintStatus(this.config.sprintStatusPath, {
      [this.story.slug]: 'ready-for-dev',
    });

    return result;
  }

  async createBranch() {
    const cwd = this.config.projectRoot;
    let baseBranch = this.config.baseBranch;

    // Commit any uncommitted orchestrator artifacts first
    await this.commitOrchestratorArtifacts();

    // Fetch latest (skip if no remote configured)
    try {
      await execa('git', ['fetch', 'origin'], { cwd });
    } catch (e) {
      this.log(`  [${this.story.id}] No remote origin, skipping fetch`);
    }

    // Epic-level branch (set in constructor) - all stories in an epic share the same branch
    const epicBranch = this.branch;

    // Check if epic branch already exists (local or remote)
    const { stdout: branches } = await execa('git', ['branch', '-a'], { cwd });
    const branchLines = branches.split('\n').map(b => b.trim().replace(/^\* /, '')).filter(Boolean);
    const localBranches = branchLines.filter(b => !b.startsWith('remotes/')).map(b => b);
    const remoteBranches = branchLines
      .filter(b => b.startsWith('remotes/origin/'))
      .map(b => b.replace('remotes/origin/', ''));

    const localExists = localBranches.includes(epicBranch);
    const remoteExists = remoteBranches.includes(epicBranch);

    if (localExists) {
      // Local branch exists - checkout
      await execa('git', ['checkout', epicBranch], { cwd });
      this.log(`  [${this.story.id}] Checked out epic branch: ${epicBranch}`);

      // Pull latest if remote exists
      try {
        await execa('git', ['pull', 'origin', epicBranch], { cwd });
      } catch (e) {
        // No remote branch yet or no remote - that's ok
      }
    } else if (remoteExists) {
      // Branch exists on remote but not locally - create tracking branch
      await execa('git', ['checkout', '-b', epicBranch, `origin/${epicBranch}`], { cwd });
      this.log(`  [${this.story.id}] Checked out epic branch from remote: ${epicBranch}`);
    } else {
      // Create epic branch from base
      try {
        await execa('git', ['checkout', baseBranch], { cwd });
      } catch (e) {
        // Try alternatives
        for (const alt of ['main', 'master', 'develop']) {
          try {
            await execa('git', ['checkout', alt], { cwd });
            baseBranch = alt;
            break;
          } catch (e2) {}
        }
      }
      try {
        await execa('git', ['pull', 'origin', baseBranch], { cwd });
      } catch (e) {}

      await execa('git', ['checkout', '-b', epicBranch], { cwd });
      this.log(`  [${this.story.id}] Created epic branch: ${epicBranch}`);
    }

    // Update status
    await updateSprintStatus(this.config.sprintStatusPath, {
      [this.story.slug]: 'in-progress',
    });

    return { branch: epicBranch, created: !localExists && !remoteExists };
  }

  async runDev() {
    // Verify we're on the expected branch before proceeding
    const cwd = this.config.projectRoot;
    const { stdout: currentBranch } = await execa('git', ['branch', '--show-current'], { cwd });
    if (currentBranch.trim() !== this.branch) {
      throw new Error(`Branch mismatch: expected '${this.branch}', but on '${currentBranch.trim()}'`);
    }

    const maxRetries = 2;
    let lastResult = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log(`  [${this.story.id}] Dev attempt ${attempt}/${maxRetries}`);

      const result = await runDevStory(this.story, this.branch, this.config);
      lastResult = result;

      // Check if Claude asked for clarification instead of doing work
      if (needsClarification(result.output)) {
        this.log(`  [${this.story.id}] Claude asked for clarification, retrying with more context...`);
        // The retry will have the same prompt but Claude might behave differently
        continue;
      }

      // Check for actual success indicators
      if (result.success || isSuccessfulCompletion(result.output)) {
        // Push changes
        if (this.config.autoPush) {
          try {
            await execa('git', ['push', '-u', 'origin', this.branch], {
              cwd: this.config.projectRoot,
            });
          } catch (pushError) {
            this.log(`  [${this.story.id}] Push failed (may be ok if no changes): ${pushError.message}`);
          }
        }
        return result;
      }

      if (!result.success) {
        throw new Error(`Dev workflow failed: ${result.stderr || result.output}`);
      }
    }

    // If we get here, all retries failed
    throw new Error(`Dev workflow failed after ${maxRetries} attempts: ${lastResult?.output?.substring(0, 200)}`);
  }

  async reviewLoop() {
    let iteration = 0;
    let approved = false;

    while (!approved && iteration < this.config.maxReviewIterations) {
      iteration++;
      this.log(`  [${this.story.id}] Review iteration ${iteration}/${this.config.maxReviewIterations}`);

      // Run review
      const reviewResult = await runCodeReview(this.story, this.branch, this.config);
      const review = parseReviewOutput(reviewResult.output);

      // Check if approved
      const blockers = review.issues.filter(i =>
        i.severity === 'CRITICAL' ||
        i.severity === 'MAJOR' ||
        (this.config.reviewSeverityThreshold === 'medium' && i.severity === 'MEDIUM')
      );

      if (blockers.length === 0) {
        approved = true;
        this.log(`  [${this.story.id}] Review passed!`);
        break;
      }

      this.log(`  [${this.story.id}] Found ${blockers.length} issues to fix`);

      // Run fixes
      const fixResult = await runCodeFixes(this.story, this.branch, review, this.config);
      if (!fixResult.success) {
        throw new Error(`Fix iteration ${iteration} failed: ${fixResult.stderr || fixResult.output}`);
      }

      // Push fixes
      if (this.config.autoPush) {
        try {
          await execa('git', ['push', 'origin', this.branch], {
            cwd: this.config.projectRoot,
          });
        } catch (pushError) {
          this.log(`  [${this.story.id}] Push failed after fixes: ${pushError.message}`);
          // Continue - push failure after fixes is not fatal, will be pushed later
        }
      }
    }

    if (!approved) {
      throw new Error(`Review not approved after ${this.config.maxReviewIterations} iterations`);
    }

    // Update status
    await updateSprintStatus(this.config.sprintStatusPath, {
      [this.story.slug]: 'review',
    });

    return { iterations: iteration, approved };
  }

  async createPR() {
    // With epic-level branches, we don't create individual story PRs
    // Just ensure all changes are committed with a proper message
    const cwd = this.config.projectRoot;

    try {
      // Check if there are uncommitted changes
      const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd });
      if (status.trim()) {
        // Commit any remaining changes
        await execa('git', ['add', '-A'], { cwd });
        await execa('git', ['commit', '-m',
          `feat(${this.story.id}): ${this.story.title}\n\nImplements story ${this.story.id} acceptance criteria`], { cwd });
        this.log(`  [${this.story.id}] Committed story changes`);
      }
    } catch (e) {
      // Might fail if nothing to commit - that's ok
      this.log(`  [${this.story.id}] No additional changes to commit`);
    }

    // PR will be created at epic level, not story level
    return { success: true, output: 'Story committed to epic branch' };
  }

  /**
   * Commit any uncommitted changes to allow clean git operations.
   * This prevents "uncommitted changes would be overwritten" errors during checkout.
   */
  async commitOrchestratorArtifacts() {
    const cwd = this.config.projectRoot;
    const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd });

    if (!status.trim()) {
      return; // Nothing to commit
    }

    this.log(`  [${this.story.id}] Committing uncommitted changes before git operations`);
    try {
      // Add all changes (tracked and untracked) to prevent checkout conflicts
      await execa('git', ['add', '-A'], { cwd });
      await execa('git', ['commit', '-m', `chore(orchestrator): save work-in-progress for story ${this.story.id}`], { cwd });
    } catch (e) {
      // Might fail if nothing staged - that's ok
      this.log(`  [${this.story.id}] Note: ${e.message}`);
    }
  }

  /**
   * Push story changes to the epic branch (merge to master happens at epic level)
   */
  async mergePR() {
    const cwd = this.config.projectRoot;
    const epicBranch = this.branch;  // Using epic-level branch

    // Commit any uncommitted changes
    await this.commitOrchestratorArtifacts();

    // Push to epic branch
    if (this.config.autoPush) {
      try {
        await execa('git', ['push', 'origin', epicBranch], { cwd });
        this.log(`  [${this.story.id}] Pushed to ${epicBranch}`);
      } catch (e) {
        // First push might need -u flag
        try {
          await execa('git', ['push', '-u', 'origin', epicBranch], { cwd });
          this.log(`  [${this.story.id}] Pushed to ${epicBranch} (first push)`);
        } catch (e2) {
          this.log(`  [${this.story.id}] Push failed (no remote?): ${e2.message}`);
        }
      }
    }

    // Stay on epic branch for next story (no checkout back to master)
    this.log(`  [${this.story.id}] Story complete on ${epicBranch}`);
    return { merged: false, branch: epicBranch };
  }

  // ===========================================================================
  // Story 3.4: Verification Gate Integration
  // ===========================================================================

  /**
   * Verify story completion status before proceeding to next story
   * @param {string} claimedStatus - Status the story claims (usually 'done' or 'review')
   * @returns {Promise<{ verified: boolean, reason?: string }>}
   */
  async verifyStoryCompletion(claimedStatus = 'review') {
    this.log(`  [${this.story.id}] Verifying story completion...`);

    try {
      const verification = await verifyBeforeProceeding(
        this.story.slug,
        claimedStatus,
        this.config.projectRoot,
        {
          maxRetries: this.config.verificationMaxRetries || 3,
          retryDelayMs: this.config.verificationRetryDelayMs || 5000,
        }
      );

      if (verification.proceed) {
        // Emit success event
        emitStoryVerified({
          projectId: this.config.projectId || this.config.projectRoot,
          storyId: this.story.slug,
          claimed: claimedStatus,
          actual: verification.result.actual || verification.result.finalStatus,
          match: true
        });

        this.log(`  [${this.story.id}] Verification passed, proceeding`);
        return { verified: true };
      }

      // Verification failed - emit failure event and pause project
      const result = verification.result;
      const projectId = this.config.projectId || this.config.projectRoot;

      emitStoryVerificationFailed({
        storyKey: this.story.slug,
        attempts: result.attempts,
        claimed: claimedStatus,
        actual: result.finalStatus,
        projectId
      });

      // Pause the project
      pauseProject(projectId, `Verification failed for ${this.story.slug}: claimed ${claimedStatus}, actual ${result.finalStatus}`);

      // Update sprint status to verification_failed
      await updateSprintStatus(this.config.sprintStatusPath, {
        [this.story.slug]: 'verification_failed',
      });

      this.log(`  [${this.story.id}] Verification FAILED after ${result.attempts} attempts`);
      return {
        verified: false,
        reason: `Verification failed: claimed ${claimedStatus}, actual ${result.finalStatus}`
      };

    } catch (error) {
      this.log(`  [${this.story.id}] Verification error: ${error.message}`);
      return {
        verified: false,
        reason: `Verification error: ${error.message}`
      };
    }
  }
}

/**
 * Run multiple stories in parallel with concurrency limit
 * Story 3.4: Now includes verification gate and pause state checking
 *
 * Note: When a project is paused, queued stories are not cancelled but will be
 * skipped when they start (checked via isProjectPaused). This is intentional to
 * maintain queue integrity and allow for potential resume scenarios.
 */
export async function runStoriesParallel(stories, config, logger, concurrency = 4) {
  const { default: PQueue } = await import('p-queue');
  const queue = new PQueue({ concurrency });
  const results = [];
  const projectId = config.projectId || config.projectRoot;

  for (const story of stories) {
    queue.add(async () => {
      // Check if project is paused before starting each story
      if (isProjectPaused(projectId)) {
        logger(`  [${story.id}] Skipping story - project is paused`);
        const skippedResult = {
          story: story.id,
          slug: story.slug,
          title: story.title,
          status: 'skipped',
          error: 'Project is paused',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        };
        results.push(skippedResult);
        return skippedResult;
      }

      const worker = new StoryWorker(story, config, logger);
      const result = await worker.run();
      results.push(result);

      // If this story's verification failed, the project will be paused
      // Subsequent stories in the queue will be skipped
      return result;
    });
  }

  await queue.onIdle();
  return results;
}
