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

      // Check story results
      const failedStories = this.result.storyResults.filter(r => r.status === 'failed');
      const skippedStories = this.result.storyResults.filter(r => r.status === 'skipped');
      const completedStories = this.result.storyResults.filter(r => r.status === 'completed');
      const verificationFailedStories = this.result.storyResults.filter(r => r.status === 'verification_failed');

      if (failedStories.length > 0) {
        this.log(`[Epic ${this.epic.number}] ${failedStories.length} stories failed:`);
        for (const failed of failedStories) {
          this.log(`  - ${failed.story}: ${failed.error}`);
        }
        throw new Error(`${failedStories.length} stories failed`);
      }

      if (verificationFailedStories.length > 0) {
        this.log(`[Epic ${this.epic.number}] ${verificationFailedStories.length} stories failed verification:`);
        for (const failed of verificationFailedStories) {
          this.log(`  - ${failed.story}: ${failed.error}`);
        }
        throw new Error(`${verificationFailedStories.length} stories failed verification`);
      }

      if (completedStories.length === 0) {
        this.log(`[Epic ${this.epic.number}] No stories completed successfully`);
        if (skippedStories.length > 0) {
          this.log(`[Epic ${this.epic.number}] ${skippedStories.length} stories were skipped (project may be paused)`);
        }
        throw new Error('No stories completed - nothing to merge');
      }

      this.log(`[Epic ${this.epic.number}] ${completedStories.length}/${this.result.storyResults.length} stories completed`);

      // Step 2: Merge epic branch to master
      this.log(`[Epic ${this.epic.number}] Merging epic branch to ${this.config.baseBranch}...`);
      await this.mergeEpicBranch();

      // Step 3: Run tests on master
      this.log(`[Epic ${this.epic.number}] Running tests...`);
      this.result.testsPass = await this.runTests();

      if (!this.result.testsPass) {
        throw new Error('Tests failed after merging');
      }

      // Mark epic and all stories as done in a single batch update
      const statusUpdates = {
        [this.epic.id]: 'done',
      };
      for (const story of this.epic.stories) {
        statusUpdates[story.slug] = 'done';
      }
      await updateSprintStatus(this.config.sprintStatusPath, statusUpdates);

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
   * Merge the epic branch back to the base branch (master)
   */
  async mergeEpicBranch() {
    const cwd = this.config.projectRoot;
    const baseBranch = this.config.baseBranch;
    const epicBranch = `feature/epic-${this.epic.number}`;

    try {
      // Check if epic branch exists (local or remote)
      const { stdout: branches } = await execa('git', ['branch', '-a'], { cwd });
      const branchLines = branches.split('\n').map(b => b.trim().replace(/^\* /, '')).filter(Boolean);
      const localExists = branchLines.some(b => b === epicBranch);
      const remoteExists = branchLines.some(b => b === `remotes/origin/${epicBranch}`);

      if (!localExists && !remoteExists) {
        this.log(`[Epic ${this.epic.number}] Epic branch ${epicBranch} does not exist - nothing to merge`);
        // Check if we're already on base branch with all changes
        const { stdout: currentBranch } = await execa('git', ['branch', '--show-current'], { cwd });
        if (currentBranch.trim() === baseBranch) {
          this.log(`[Epic ${this.epic.number}] Already on ${baseBranch}, assuming stories committed directly`);
          return;
        }
        throw new Error(`Epic branch ${epicBranch} does not exist and not on ${baseBranch}`);
      }

      // If only remote exists, fetch it first
      if (!localExists && remoteExists) {
        await execa('git', ['fetch', 'origin', epicBranch], { cwd });
      }

      // Commit any uncommitted changes before checkout to prevent "would be overwritten" errors
      try {
        const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd });
        if (status.trim()) {
          this.log(`[Epic ${this.epic.number}] Committing uncommitted changes before checkout`);
          await execa('git', ['add', '-A'], { cwd });
          await execa('git', ['commit', '-m', `chore(orchestrator): save changes before epic merge`], { cwd });
        }
      } catch (e) {
        this.log(`[Epic ${this.epic.number}] Note: ${e.message}`);
      }

      // Checkout base branch
      await execa('git', ['checkout', baseBranch], { cwd });
      try {
        await execa('git', ['pull', 'origin', baseBranch], { cwd });
      } catch (e) {
        // No remote - that's ok
      }

      // Merge epic branch
      try {
        await execa('git', ['merge', epicBranch, '--no-ff', '-m',
          `feat(epic-${this.epic.number}): ${this.epic.title}\n\nMerges all stories from Epic ${this.epic.number}`], { cwd });
        this.log(`[Epic ${this.epic.number}] Merged ${epicBranch} to ${baseBranch}`);

        // Sync submodules after successful merge
        try {
          await execa('git', ['submodule', 'update', '--init', '--recursive'], { cwd });
        } catch {
          // No submodules or submodule update failed - continue
        }
      } catch (e) {
        // Merge conflict - try to resolve safely
        this.log(`[Epic ${this.epic.number}] Merge conflict, attempting resolution...`);
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

          const unresolvedConflicts = [];
          for (const file of conflictedFiles) {
            if (file.startsWith('_bmad-output/')) {
              // For orchestrator artifacts, accept feature branch version (theirs)
              await execa('git', ['checkout', '--theirs', file], { cwd });
              await execa('git', ['add', file], { cwd });
              this.log(`[Epic ${this.epic.number}] Resolved ${file} (accepted theirs)`);
            } else if (submodules.includes(file)) {
              // Submodule conflict - accept base branch version (ours)
              await execa('git', ['checkout', '--ours', file], { cwd });
              await execa('git', ['add', file], { cwd });
              this.log(`[Epic ${this.epic.number}] Resolved submodule ${file} (accepted ours)`);
            } else {
              // Other conflicts require manual resolution
              unresolvedConflicts.push(file);
              this.log(`[Epic ${this.epic.number}] Cannot auto-resolve: ${file}`);
            }
          }

          // Fail if there are conflicts we can't safely auto-resolve
          if (unresolvedConflicts.length > 0) {
            throw new Error(`Manual resolution required for: ${unresolvedConflicts.join(', ')}`);
          }

          await execa('git', ['commit', '-m',
            `feat(epic-${this.epic.number}): ${this.epic.title}\n\nMerges all stories from Epic ${this.epic.number}`], { cwd });
          this.log(`[Epic ${this.epic.number}] Merge conflict resolved`);

          // Sync submodules after merge
          try {
            await execa('git', ['submodule', 'update', '--init', '--recursive'], { cwd });
          } catch {
            // No submodules or submodule update failed - continue
          }
        } catch (e2) {
          await execa('git', ['merge', '--abort'], { cwd }).catch(() => {});
          throw new Error(`Merge failed: ${e2.message}`);
        }
      }

      // Delete epic branch
      try {
        await execa('git', ['branch', '-d', epicBranch], { cwd });
      } catch (e) {
        // Force delete if needed
        await execa('git', ['branch', '-D', epicBranch], { cwd }).catch(() => {});
      }

      // Push to remote
      if (this.config.autoPush) {
        try {
          await execa('git', ['push', 'origin', baseBranch], { cwd });
          this.log(`[Epic ${this.epic.number}] Pushed to origin/${baseBranch}`);
        } catch (e) {
          this.log(`[Epic ${this.epic.number}] Push failed: ${e.message}`);
        }
      }
    } catch (error) {
      this.log(`[Epic ${this.epic.number}] Epic branch merge failed: ${error.message}`);
      throw error;
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
    const fs = await import('fs');
    const path = await import('path');

    try {
      // 1. Check for package.json with test script (most common for Node projects)
      const packageJsonPath = path.default.join(cwd, 'package.json');
      if (fs.default.existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(fs.default.readFileSync(packageJsonPath, 'utf8'));
          if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
            this.log(`  Running: npm test`);
            const result = await execa('npm', ['test'], { cwd, reject: false });
            return result.exitCode === 0;
          }
        } catch (e) {
          this.log(`  Warning: Could not parse package.json: ${e.message}`);
        }
      }

      // 2. Check for Gradle wrapper (file-based detection)
      const gradlewPath = path.default.join(cwd, 'gradlew');
      if (fs.default.existsSync(gradlewPath)) {
        this.log(`  Running: ./gradlew test`);
        const result = await execa('./gradlew', ['test'], { cwd, reject: false });
        return result.exitCode === 0;
      }

      // 3. Check for Maven pom.xml
      const pomPath = path.default.join(cwd, 'pom.xml');
      if (fs.default.existsSync(pomPath)) {
        this.log(`  Running: mvn test`);
        const result = await execa('mvn', ['test'], { cwd, reject: false });
        return result.exitCode === 0;
      }

      // 4. Check for Python tests (pytest or setup.py)
      const pytestExists = fs.default.existsSync(path.default.join(cwd, 'pytest.ini')) ||
                          fs.default.existsSync(path.default.join(cwd, 'pyproject.toml')) ||
                          fs.default.existsSync(path.default.join(cwd, 'setup.py'));
      if (pytestExists) {
        // Check if pytest is available
        const { exitCode: pytestCheck } = await execa('command', ['-v', 'pytest'], { cwd, reject: false, shell: true });
        if (pytestCheck === 0) {
          this.log(`  Running: pytest`);
          const result = await execa('pytest', [], { cwd, reject: false });
          return result.exitCode === 0;
        }
      }

      // 5. Check for Go modules
      const goModPath = path.default.join(cwd, 'go.mod');
      if (fs.default.existsSync(goModPath)) {
        this.log(`  Running: go test ./...`);
        const result = await execa('go', ['test', './...'], { cwd, reject: false });
        return result.exitCode === 0;
      }

      // No test command found, assume pass
      this.log(`  No test configuration found, assuming pass`);
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
