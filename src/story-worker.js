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
    this.branch = `${config.branchPrefix}${story.slug}`;
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

    // First, ensure we're on the base branch with latest changes
    // This should be clean after previous story's merge
    try {
      await execa('git', ['checkout', baseBranch], { cwd });
    } catch (e) {
      // Try common alternatives if configured base doesn't exist
      const alternatives = ['main', 'master', 'develop'];
      for (const alt of alternatives) {
        try {
          await execa('git', ['checkout', alt], { cwd });
          baseBranch = alt;
          break;
        } catch (e2) {
          // Try next
        }
      }
    }

    // Fetch and pull latest (skip if no remote configured)
    try {
      await execa('git', ['fetch', 'origin'], { cwd });
      await execa('git', ['pull', 'origin', baseBranch], { cwd });
    } catch (e) {
      // No remote origin - that's fine for local-only repos
      this.log(`  [${this.story.id}] No remote origin, skipping fetch/pull`);
    }

    // Check if feature branch already exists
    const { stdout: branches } = await execa('git', ['branch', '-a'], { cwd });
    const branchExists = branches.includes(this.branch);

    // Commit any uncommitted orchestrator artifacts before checkout
    await this.commitOrchestratorArtifacts();

    if (branchExists) {
      // Branch exists - checkout and rebase on latest base
      await execa('git', ['checkout', this.branch], { cwd });
      this.log(`  [${this.story.id}] Checked out existing branch: ${this.branch}`);

      // Rebase on latest base to get any merged changes
      try {
        await execa('git', ['rebase', baseBranch], { cwd });
      } catch (e) {
        // Rebase conflict - abort and continue (might already be up to date)
        try {
          await execa('git', ['rebase', '--abort'], { cwd });
        } catch (e2) {
          // No rebase in progress - that's fine
        }
      }
    } else {
      // Create new branch from base
      await execa('git', ['checkout', '-b', this.branch], { cwd });
      this.log(`  [${this.story.id}] Created new branch: ${this.branch}`);
    }

    // Update status
    await updateSprintStatus(this.config.sprintStatusPath, {
      [this.story.slug]: 'in-progress',
    });

    return { branch: this.branch, created: !branchExists };
  }

  async runDev() {
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
        await execa('git', ['push', 'origin', this.branch], {
          cwd: this.config.projectRoot,
        });
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
    const result = await runCreatePR(this.story, this.branch, this.config);

    // Try to extract PR URL from output
    const urlMatch = result.output.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
    if (urlMatch) {
      this.result.prUrl = urlMatch[0];
    }

    return result;
  }

  /**
   * Commit any uncommitted orchestrator artifacts to allow clean git operations
   */
  async commitOrchestratorArtifacts() {
    const cwd = this.config.projectRoot;
    const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd });

    if (!status.trim()) {
      return; // Nothing to commit
    }

    this.log(`  [${this.story.id}] Committing orchestrator artifacts`);
    try {
      // Add all _bmad-output files (tracked and untracked)
      await execa('git', ['add', '_bmad-output/'], { cwd });
      await execa('git', ['commit', '-m', `chore(orchestrator): save artifacts for story ${this.story.id}`], { cwd });
    } catch (e) {
      // Might fail if nothing staged - that's ok
      this.log(`  [${this.story.id}] Note: ${e.message}`);
    }
  }

  /**
   * Merge the PR and return to base branch for clean sequential execution
   */
  async mergePR() {
    const cwd = this.config.projectRoot;
    const baseBranch = this.config.baseBranch;

    // Try to merge via gh CLI if PR was created
    if (this.result.prUrl) {
      const prNum = this.result.prUrl.match(/\/pull\/(\d+)/)?.[1];
      if (prNum) {
        this.log(`  [${this.story.id}] Merging PR #${prNum}...`);
        try {
          await execa('gh', ['pr', 'merge', prNum, '--squash', '--delete-branch'], { cwd });
          this.log(`  [${this.story.id}] PR #${prNum} merged successfully`);
        } catch (e) {
          // If gh merge fails, try manual merge
          this.log(`  [${this.story.id}] gh merge failed, trying manual merge: ${e.message}`);
          await this.manualMerge();
        }
      }
    } else {
      // No PR URL, do manual merge
      await this.manualMerge();
    }

    // Commit any uncommitted artifacts before returning to base branch
    await this.commitOrchestratorArtifacts();

    // Return to base branch with latest changes
    await execa('git', ['checkout', baseBranch], { cwd });
    try {
      await execa('git', ['pull', 'origin', baseBranch], { cwd });
    } catch (e) {
      // Pull might fail if no remote - that's ok
    }

    this.log(`  [${this.story.id}] Returned to ${baseBranch} branch`);
    return { merged: true };
  }

  /**
   * Manual merge when gh CLI is not available or fails
   */
  async manualMerge() {
    const cwd = this.config.projectRoot;
    const baseBranch = this.config.baseBranch;

    this.log(`  [${this.story.id}] Performing manual merge...`);

    // Commit any uncommitted artifacts before checkout
    await this.commitOrchestratorArtifacts();

    // Checkout base branch
    await execa('git', ['checkout', baseBranch], { cwd });
    try {
      await execa('git', ['pull', 'origin', baseBranch], { cwd });
    } catch (e) {
      // No remote - skip pull
    }

    // Merge the feature branch
    try {
      await execa('git', ['merge', this.branch, '--no-ff', '-m',
        `Merge story ${this.story.id}: ${this.story.title}`], { cwd });
    } catch (e) {
      // Merge conflict - try to resolve automatically
      this.log(`  [${this.story.id}] Merge conflict detected, attempting resolution...`);

      try {
        // Get list of submodules to handle them specially
        let submodules = [];
        try {
          const { stdout: submoduleList } = await execa('git', ['config', '--file', '.gitmodules', '--get-regexp', 'path'], { cwd });
          submodules = submoduleList.split('\n').map(line => line.split(' ')[1]).filter(Boolean);
        } catch {
          // No .gitmodules or error reading it
        }

        // Get list of conflicted files
        const { stdout: conflictList } = await execa('git', ['diff', '--name-only', '--diff-filter=U'], { cwd });
        const conflictedFiles = conflictList.trim().split('\n').filter(f => f);

        for (const file of conflictedFiles) {
          if (file.startsWith('_bmad-output/')) {
            // For orchestrator artifacts, accept feature branch version (theirs)
            await execa('git', ['checkout', '--theirs', file], { cwd });
            await execa('git', ['add', file], { cwd });
            this.log(`  [${this.story.id}] Resolved ${file} (accepted theirs)`);
          } else if (submodules.includes(file)) {
            // Submodule conflict - accept base branch version (ours) to avoid issues
            this.log(`  [${this.story.id}] Submodule conflict: ${file} - accepting ours`);
            await execa('git', ['checkout', '--ours', file], { cwd });
            await execa('git', ['add', file], { cwd });
          } else {
            // Other conflicts - accept theirs as default for story changes
            await execa('git', ['checkout', '--theirs', file], { cwd });
            await execa('git', ['add', file], { cwd });
            this.log(`  [${this.story.id}] Resolved ${file} (accepted theirs)`);
          }
        }

        // Check for any remaining unmerged files
        const { stdout: remaining } = await execa('git', ['diff', '--name-only', '--diff-filter=U'], { cwd });
        if (remaining.trim()) {
          throw new Error(`Unresolved conflicts: ${remaining.trim()}`);
        }

        // Commit the merge
        await execa('git', ['commit', '-m', `Merge story ${this.story.id}: ${this.story.title}`], { cwd });
        this.log(`  [${this.story.id}] Merge conflict resolved`);
      } catch (e2) {
        // Can't resolve - abort and throw
        try {
          await execa('git', ['merge', '--abort'], { cwd });
        } catch {
          // Merge might not be in progress
        }
        throw new Error(`Merge failed and could not be resolved: ${e2.message}`);
      }
    }

    // Delete the feature branch locally
    try {
      await execa('git', ['branch', '-d', this.branch], { cwd });
    } catch (e) {
      // Branch might not exist or be protected - that's ok
    }

    // Push to remote if configured
    if (this.config.autoPush) {
      try {
        await execa('git', ['push', 'origin', baseBranch], { cwd });
        this.log(`  [${this.story.id}] Pushed to origin/${baseBranch}`);
      } catch (e) {
        this.log(`  [${this.story.id}] Push failed (no remote?): ${e.message}`);
      }
    }
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
