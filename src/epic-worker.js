import { execa } from 'execa';
import { runStoriesParallel, StoryWorker } from './story-worker.js';
import { updateSprintStatus } from './parser.js';
import { runCreateStory } from './claude-runner.js';

/**
 * Epic Worker
 * Handles the complete lifecycle of an epic:
 * 1. CREATE all story files first (parallel)
 * 2. RUN all stories in parallel (branch -> dev -> review -> PR)
 * 3. Merge all PRs
 * 4. Run tests
 */
export class EpicWorker {
  constructor(epic, config, logger) {
    this.epic = epic;
    this.config = config;
    this.log = logger;
    this.result = {
      epic: epic.id,
      number: epic.number,
      title: epic.title,
      status: 'pending',
      storiesCreated: [],
      storyResults: [],
      mergedPRs: [],
      testsPass: null,
      error: null,
      startTime: null,
      endTime: null,
    };
  }

  async run() {
    this.result.startTime = new Date().toISOString();
    this.log(`\n${'='.repeat(60)}`);
    this.log(`Starting Epic ${this.epic.number}: ${this.epic.title}`);
    this.log(`Stories to process: ${this.epic.stories.length}`);
    this.log(`${'='.repeat(60)}\n`);

    try {
      // Update epic status
      await updateSprintStatus(this.config.sprintStatusPath, {
        [this.epic.id]: 'in-progress',
      });

      // ============================================================
      // PHASE 1: Create ALL story files first (in parallel)
      // ============================================================
      const storiesToCreate = this.epic.stories.filter(s => s.status === 'backlog');
      if (storiesToCreate.length > 0) {
        this.log(`[Epic ${this.epic.number}] PHASE 1: Creating ${storiesToCreate.length} story files...`);
        await this.createAllStories(storiesToCreate);
        this.log(`[Epic ${this.epic.number}] All story files created.`);

        // Commit story files so they don't block branch checkout in Phase 2
        await this.commitStoryArtifacts();
      } else {
        this.log(`[Epic ${this.epic.number}] PHASE 1: All story files already exist, skipping creation.`);
      }

      // ============================================================
      // PHASE 2: Run all stories in parallel (dev -> review -> PR)
      // ============================================================
      this.log(`[Epic ${this.epic.number}] PHASE 2: Running ${this.epic.stories.length} stories in parallel...`);
      this.result.storyResults = await runStoriesParallel(
        this.epic.stories,
        this.config,
        this.log,
        this.config.maxParallelStories
      );

      // Check if all stories completed
      const failedStories = this.result.storyResults.filter(r => r.status === 'failed');
      if (failedStories.length > 0) {
        this.log(`[Epic ${this.epic.number}] ${failedStories.length} stories failed:`);
        for (const failed of failedStories) {
          this.log(`  - ${failed.story}: ${failed.error}`);
        }
        throw new Error(`${failedStories.length} stories failed`);
      }

      // Note: Each story now merges its own PR in the merge-pr step
      // So we don't need to batch merge here

      // Step 2: Run tests (stories should already be merged)
      this.log(`[Epic ${this.epic.number}] Running tests...`);
      this.result.testsPass = await this.runTests();

      if (!this.result.testsPass) {
        throw new Error('Tests failed after merging');
      }

      // Mark epic as done
      await updateSprintStatus(this.config.sprintStatusPath, {
        [this.epic.id]: 'done',
      });

      // Mark all stories as done
      for (const story of this.epic.stories) {
        await updateSprintStatus(this.config.sprintStatusPath, {
          [story.slug]: 'done',
        });
      }

      this.result.status = 'completed';
      this.log(`\n[Epic ${this.epic.number}] COMPLETED SUCCESSFULLY\n`);
    } catch (error) {
      this.result.status = 'failed';
      this.result.error = error.message;
      this.log(`\n[Epic ${this.epic.number}] FAILED: ${error.message}\n`);
    }

    this.result.endTime = new Date().toISOString();
    return this.result;
  }

  /**
   * Commit story artifacts created in Phase 1 so they don't block branch checkout
   */
  async commitStoryArtifacts() {
    const cwd = this.config.projectRoot;

    try {
      // Stage all implementation artifacts (story files)
      await execa('git', ['add', '_bmad-output/implementation-artifacts/'], { cwd });

      // Also stage sprint-status.yaml if it was updated
      try {
        await execa('git', ['add', '_bmad-output/planning-artifacts/sprint-status.yaml'], { cwd });
      } catch {
        // sprint-status might not exist or be in a different location - that's ok
      }

      // Check if there's anything to commit
      const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd });
      if (!status.trim()) {
        this.log(`[Epic ${this.epic.number}] No story artifacts to commit`);
        return;
      }

      // Commit the story files
      await execa('git', ['commit', '-m', `chore(orchestrator): create story files for Epic ${this.epic.number}\n\nStory files created by BMAD Orchestrator Phase 1`], { cwd });
      this.log(`[Epic ${this.epic.number}] Committed story artifacts to ${this.config.baseBranch}`);

      // Push if autoPush is enabled
      if (this.config.autoPush) {
        try {
          await execa('git', ['push', 'origin', this.config.baseBranch], { cwd });
          this.log(`[Epic ${this.epic.number}] Pushed story artifacts`);
        } catch (e) {
          this.log(`[Epic ${this.epic.number}] Push failed (no remote?): ${e.message}`);
        }
      }
    } catch (error) {
      this.log(`[Epic ${this.epic.number}] Warning: Failed to commit story artifacts: ${error.message}`);
      // Don't throw - try to continue anyway
    }
  }

  /**
   * Create all story files for this epic in parallel
   */
  async createAllStories(stories) {
    const { default: PQueue } = await import('p-queue');
    const queue = new PQueue({ concurrency: this.config.maxParallelStories });

    for (const story of stories) {
      queue.add(async () => {
        this.log(`  [Epic ${this.epic.number}] Creating story file: ${story.id} - ${story.title}`);
        try {
          const result = await runCreateStory(story, this.config);
          if (result.success) {
            // Update status to ready-for-dev
            await updateSprintStatus(this.config.sprintStatusPath, {
              [story.slug]: 'ready-for-dev',
            });
            // Update local story status so dev phase knows it's ready
            story.status = 'ready-for-dev';
            this.result.storiesCreated.push({ story: story.id, success: true });
            this.log(`  [Epic ${this.epic.number}] ✓ Story ${story.id} file created`);
          } else {
            this.result.storiesCreated.push({ story: story.id, success: false, error: result.stderr });
            this.log(`  [Epic ${this.epic.number}] ✗ Story ${story.id} creation failed`);
          }
        } catch (error) {
          this.result.storiesCreated.push({ story: story.id, success: false, error: error.message });
          this.log(`  [Epic ${this.epic.number}] ✗ Story ${story.id} error: ${error.message}`);
        }
      });
    }

    await queue.onIdle();

    // Check if any failed
    const failed = this.result.storiesCreated.filter(s => !s.success);
    if (failed.length > 0) {
      throw new Error(`Failed to create ${failed.length} story files`);
    }
  }

  async mergePRs() {
    const cwd = this.config.projectRoot;

    // Checkout base branch
    await execa('git', ['checkout', this.config.baseBranch], { cwd });
    await execa('git', ['pull', 'origin', this.config.baseBranch], { cwd });

    for (const storyResult of this.result.storyResults) {
      if (storyResult.prUrl) {
        try {
          // Extract PR number from URL
          const prNum = storyResult.prUrl.match(/\/pull\/(\d+)/)?.[1];
          if (prNum) {
            this.log(`  Merging PR #${prNum} (${storyResult.story})...`);

            // Merge using gh CLI
            await execa('gh', ['pr', 'merge', prNum, '--squash', '--delete-branch'], { cwd });

            this.result.mergedPRs.push({
              story: storyResult.story,
              pr: prNum,
              url: storyResult.prUrl,
            });
          }
        } catch (error) {
          this.log(`  Warning: Failed to merge PR for ${storyResult.story}: ${error.message}`);
          // Continue with other PRs
        }
      } else {
        // No PR URL, try to merge branch directly
        this.log(`  Merging branch ${storyResult.branch} directly...`);
        try {
          await execa('git', ['merge', storyResult.branch, '--no-ff', '-m',
            `Merge story ${storyResult.story}: ${storyResult.title}`], { cwd });
          await execa('git', ['branch', '-d', storyResult.branch], { cwd });
        } catch (error) {
          this.log(`  Warning: Failed to merge branch ${storyResult.branch}: ${error.message}`);
        }
      }
    }

    // Push merged changes
    await execa('git', ['push', 'origin', this.config.baseBranch], { cwd });
  }

  async runTests() {
    const cwd = this.config.projectRoot;

    try {
      // Try common test commands
      const testCommands = [
        ['npm', ['test']],
        ['mvn', ['test']],
        ['./gradlew', ['test']],
        ['pytest', []],
        ['go', ['test', './...']],
      ];

      // Check which one exists and run it
      for (const [cmd, args] of testCommands) {
        try {
          const { exitCode } = await execa('which', [cmd], { cwd, reject: false });
          if (exitCode === 0) {
            this.log(`  Running: ${cmd} ${args.join(' ')}`);
            const result = await execa(cmd, args, { cwd, reject: false });
            return result.exitCode === 0;
          }
        } catch {
          // Try next command
        }
      }

      // No test command found, assume pass
      this.log(`  No test command found, assuming pass`);
      return true;
    } catch (error) {
      this.log(`  Tests failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * Run multiple epics in parallel with concurrency limit
 */
export async function runEpicsParallel(epics, config, logger, concurrency = 2) {
  const { default: PQueue } = await import('p-queue');
  const queue = new PQueue({ concurrency });
  const results = [];

  for (const epic of epics) {
    queue.add(async () => {
      const worker = new EpicWorker(epic, config, logger);
      const result = await worker.run();
      results.push(result);
      return result;
    });
  }

  await queue.onIdle();
  return results;
}
