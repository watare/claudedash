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
      // Note: Story file creation is handled by EpicWorker.createAllStories()
      // Stories should already be 'ready-for-dev' when we get here

      // Step 1: Create and checkout branch
      await this.step('create-branch', () => this.createBranch());

      // Step 2: Run dev workflow
      await this.step('dev', () => this.runDev());

      // Step 3: Review loop
      await this.step('review-loop', () => this.reviewLoop());

      // Step 4: Create PR
      await this.step('create-pr', () => this.createPR());

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
    updateSprintStatus(this.config.sprintStatusPath, {
      [this.story.slug]: 'ready-for-dev',
    });

    return result;
  }

  async createBranch() {
    const cwd = this.config.projectRoot;

    // Fetch latest
    await execa('git', ['fetch', 'origin'], { cwd });

    // Check if branch already exists
    const { stdout: branches } = await execa('git', ['branch', '-a'], { cwd });
    const branchExists = branches.includes(this.branch);

    if (branchExists) {
      // Checkout existing branch
      await execa('git', ['checkout', this.branch], { cwd });
      this.log(`  [${this.story.id}] Checked out existing branch: ${this.branch}`);
    } else {
      // Create new branch from base
      await execa('git', ['checkout', this.config.baseBranch], { cwd });
      await execa('git', ['pull', 'origin', this.config.baseBranch], { cwd });
      await execa('git', ['checkout', '-b', this.branch], { cwd });
      this.log(`  [${this.story.id}] Created new branch: ${this.branch}`);
    }

    // Update status
    updateSprintStatus(this.config.sprintStatusPath, {
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
    updateSprintStatus(this.config.sprintStatusPath, {
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
}

/**
 * Run multiple stories in parallel with concurrency limit
 */
export async function runStoriesParallel(stories, config, logger, concurrency = 4) {
  const { default: PQueue } = await import('p-queue');
  const queue = new PQueue({ concurrency });
  const results = [];

  for (const story of stories) {
    queue.add(async () => {
      const worker = new StoryWorker(story, config, logger);
      const result = await worker.run();
      results.push(result);
      return result;
    });
  }

  await queue.onIdle();
  return results;
}
