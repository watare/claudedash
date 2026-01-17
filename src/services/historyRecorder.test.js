/**
 * Tests for History Recorder Service
 * Story 4.7: Execution History View
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// We need to mock the database for isolated testing
// Create an in-memory database with the same schema
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('historyRecorder', () => {
  let db;
  let historyRecorder;

  beforeAll(async () => {
    // Create in-memory database
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Apply migrations
    const migrationsDir = path.join(__dirname, '../db/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      db.exec(sql);
    }

    // Mock the getDb function
    const originalModule = await import('./historyRecorder.js');

    // We need to test with real DB, so we'll use the actual module
    // but test the logic through the API
    historyRecorder = originalModule;
  });

  afterEach(() => {
    // Reset after each test
    historyRecorder._resetForTesting();
  });

  describe('startRun', () => {
    it('should create a new run and return the run ID', async () => {
      // Import fresh to test with real DB
      const { initDb } = await import('../db/index.js');
      initDb();

      const { startRun, getCurrentRunId, endRun } = await import('./historyRecorder.js');

      const runId = startRun('test-project', { projectRoot: '/test/path' });

      expect(runId).toBeGreaterThan(0);
      expect(getCurrentRunId()).toBe(runId);

      // Clean up
      endRun('completed', { completed: 0, failed: 0, total: 0 });
    });
  });

  describe('recordEvent', () => {
    it('should record an event during an active run', async () => {
      const { initDb } = await import('../db/index.js');
      initDb();

      const {
        startRun,
        recordEvent,
        getRunWithEvents,
        endRun,
      } = await import('./historyRecorder.js');

      const runId = startRun('test-project', {});

      recordEvent('agent:spawn', {
        agentId: 'agent-1',
        storyId: '1-1',
        epicNumber: 1,
        details: { model: 'claude-3' },
      });

      recordEvent('agent:complete', {
        agentId: 'agent-1',
        storyId: '1-1',
        details: { duration: 5000 },
      });

      endRun('completed', { completed: 1, failed: 0, total: 1 });

      const runWithEvents = getRunWithEvents(runId);

      expect(runWithEvents).not.toBeNull();
      expect(runWithEvents.events).toHaveLength(2);
      expect(runWithEvents.events[0].type).toBe('agent:spawn');
      expect(runWithEvents.events[0].agentId).toBe('agent-1');
      expect(runWithEvents.events[1].type).toBe('agent:complete');
    });

    it('should not record an event when no run is active', async () => {
      const { recordEvent, _resetForTesting } = await import('./historyRecorder.js');

      _resetForTesting();

      const result = recordEvent('agent:spawn', { agentId: 'test' });

      expect(result).toBeNull();
    });
  });

  describe('endRun', () => {
    it('should end a run with final status and stats', async () => {
      const { initDb } = await import('../db/index.js');
      initDb();

      const {
        startRun,
        endRun,
        getRunWithEvents,
        getCurrentRunId,
      } = await import('./historyRecorder.js');

      const runId = startRun('test-project', {});

      endRun('completed', {
        completed: 5,
        failed: 1,
        total: 6,
      });

      expect(getCurrentRunId()).toBeNull();

      const run = getRunWithEvents(runId);

      expect(run.status).toBe('completed');
      expect(run.storiesCompleted).toBe(5);
      expect(run.storiesFailed).toBe(1);
      expect(run.storiesTotal).toBe(6);
      expect(run.endedAt).not.toBeNull();
      expect(run.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('queryRuns', () => {
    it('should query runs with pagination', async () => {
      const { initDb } = await import('../db/index.js');
      initDb();

      const {
        startRun,
        endRun,
        queryRuns,
      } = await import('./historyRecorder.js');

      // Create multiple runs
      for (let i = 0; i < 5; i++) {
        startRun(`project-${i}`, {});
        endRun('completed', { completed: i, failed: 0, total: i });
      }

      const result = queryRuns({ limit: 3, page: 1 });

      expect(result.data.length).toBeLessThanOrEqual(3);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.page).toBe(1);
    });

    it('should filter runs by project', async () => {
      const { initDb } = await import('../db/index.js');
      initDb();

      const {
        startRun,
        endRun,
        queryRuns,
      } = await import('./historyRecorder.js');

      startRun('filter-test-project', {});
      endRun('completed', {});

      startRun('other-project', {});
      endRun('completed', {});

      const result = queryRuns({ project: 'filter-test-project' });

      const matchingRuns = result.data.filter(r => r.project === 'filter-test-project');
      expect(matchingRuns.length).toBeGreaterThan(0);
    });

    it('should filter runs by status', async () => {
      const { initDb } = await import('../db/index.js');
      initDb();

      const {
        startRun,
        endRun,
        queryRuns,
      } = await import('./historyRecorder.js');

      startRun('status-test', {});
      endRun('failed', { failed: 1 });

      const result = queryRuns({ status: 'failed' });

      const failedRuns = result.data.filter(r => r.status === 'failed');
      expect(failedRuns.length).toBeGreaterThan(0);
    });
  });

  describe('getRunWithEvents', () => {
    it('should return null for non-existent run', async () => {
      const { initDb } = await import('../db/index.js');
      initDb();

      const { getRunWithEvents } = await import('./historyRecorder.js');

      const result = getRunWithEvents(999999);

      expect(result).toBeNull();
    });

    it('should return run with formatted data', async () => {
      const { initDb } = await import('../db/index.js');
      initDb();

      const {
        startRun,
        recordEvent,
        endRun,
        getRunWithEvents,
      } = await import('./historyRecorder.js');

      const runId = startRun('formatted-test', { projectRoot: '/test' });

      recordEvent('agent:spawn', {
        agentId: 'agent-1',
        details: { test: true },
      });

      endRun('completed', { completed: 1, failed: 0, total: 1 });

      const run = getRunWithEvents(runId);

      expect(run.id).toBe(runId);
      expect(run.project).toBe('formatted-test');
      expect(run.events).toHaveLength(1);
      expect(run.events[0].details).toEqual({ test: true });
      expect(typeof run.duration).toBe('string');
    });
  });

  describe('incrementCompletedStories', () => {
    it('should increment completed stories count during run', async () => {
      const { initDb, getDb } = await import('../db/index.js');
      initDb();

      const {
        startRun,
        incrementCompletedStories,
        getCurrentRunId,
        endRun,
      } = await import('./historyRecorder.js');

      const runId = startRun('increment-test', {});

      incrementCompletedStories();
      incrementCompletedStories();

      // Check the value before endRun
      const db = getDb();
      const beforeEnd = db.prepare('SELECT stories_completed FROM execution_runs WHERE id = ?').get(runId);
      expect(beforeEnd.stories_completed).toBe(2);

      // endRun with stats will overwrite - that's the expected behavior
      // Use increment during run OR pass final stats to endRun
      endRun('completed', { completed: 2, failed: 0, total: 2 });
    });
  });

  describe('incrementFailedStories', () => {
    it('should increment failed stories count during run', async () => {
      const { initDb, getDb } = await import('../db/index.js');
      initDb();

      const {
        startRun,
        incrementFailedStories,
        endRun,
      } = await import('./historyRecorder.js');

      const runId = startRun('failed-increment-test', {});

      incrementFailedStories();

      // Check the value before endRun
      const db = getDb();
      const beforeEnd = db.prepare('SELECT stories_failed FROM execution_runs WHERE id = ?').get(runId);
      expect(beforeEnd.stories_failed).toBe(1);

      endRun('failed', { completed: 0, failed: 1, total: 1 });
    });
  });
});
