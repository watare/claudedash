import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  pauseProject,
  resumeProject,
  isProjectPaused,
  getProjectState,
  getAllProjectStates,
  clearProjectState,
  clearAllProjectStates
} from './orchestrator.js';

// Mock the websocket module to avoid actual broadcasts
vi.mock('./services/websocket.js', () => ({
  emitProjectPaused: vi.fn(),
  emitProjectResumed: vi.fn(),
}));

// ==========================================================================
// Story 3.4: Project Pause State Management Tests
// ==========================================================================

describe('orchestrator pause/resume functionality', () => {
  beforeEach(() => {
    // Clear all project states before each test
    clearAllProjectStates();
  });

  afterEach(() => {
    clearAllProjectStates();
  });

  describe('pauseProject', () => {
    it('should pause a running project', () => {
      const result = pauseProject('project-1', 'Verification failed');

      expect(result).toBe(true);
      expect(isProjectPaused('project-1')).toBe(true);
    });

    it('should return false if project is already paused', () => {
      pauseProject('project-1', 'First reason');
      const result = pauseProject('project-1', 'Second reason');

      expect(result).toBe(false);
    });

    it('should store pause reason and timestamp', () => {
      pauseProject('project-1', 'Verification failed for story-1');

      const state = getProjectState('project-1');
      expect(state).toBeDefined();
      expect(state.status).toBe('paused');
      expect(state.reason).toBe('Verification failed for story-1');
      expect(state.pausedAt).toBeDefined();
      expect(state.pausedBy).toBe('verification_system');
    });

    it('should store ISO 8601 timestamp', () => {
      pauseProject('project-1', 'Test');

      const state = getProjectState('project-1');
      const timestamp = state.pausedAt;

      // Verify it's a valid ISO 8601 timestamp
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('resumeProject', () => {
    it('should resume a paused project', () => {
      pauseProject('project-1', 'Test reason');
      const result = resumeProject('project-1');

      expect(result).toBe(true);
      expect(isProjectPaused('project-1')).toBe(false);
    });

    it('should return false if project is not paused', () => {
      const result = resumeProject('project-nonexistent');

      expect(result).toBe(false);
    });

    it('should return false for already running project', () => {
      pauseProject('project-1', 'Test');
      resumeProject('project-1');
      const result = resumeProject('project-1');

      expect(result).toBe(false);
    });

    it('should update state to running with resumedAt timestamp', () => {
      pauseProject('project-1', 'Test');
      resumeProject('project-1');

      const state = getProjectState('project-1');
      expect(state.status).toBe('running');
      expect(state.resumedAt).toBeDefined();
      expect(new Date(state.resumedAt).toISOString()).toBe(state.resumedAt);
    });
  });

  describe('isProjectPaused', () => {
    it('should return true for paused project', () => {
      pauseProject('project-1', 'Test');

      expect(isProjectPaused('project-1')).toBe(true);
    });

    it('should return false for non-existent project', () => {
      expect(isProjectPaused('nonexistent')).toBe(false);
    });

    it('should return false for resumed project', () => {
      pauseProject('project-1', 'Test');
      resumeProject('project-1');

      expect(isProjectPaused('project-1')).toBe(false);
    });

    it('should correctly track multiple projects independently', () => {
      pauseProject('project-1', 'Test 1');
      pauseProject('project-2', 'Test 2');
      resumeProject('project-1');

      expect(isProjectPaused('project-1')).toBe(false);
      expect(isProjectPaused('project-2')).toBe(true);
    });
  });

  describe('getProjectState', () => {
    it('should return undefined for non-existent project', () => {
      expect(getProjectState('nonexistent')).toBeUndefined();
    });

    it('should return full state object for paused project', () => {
      pauseProject('project-1', 'Test reason');

      const state = getProjectState('project-1');
      expect(state).toMatchObject({
        status: 'paused',
        reason: 'Test reason',
        pausedBy: 'verification_system'
      });
      expect(state.pausedAt).toBeDefined();
    });
  });

  describe('getAllProjectStates', () => {
    it('should return empty Map when no projects exist', () => {
      const states = getAllProjectStates();

      expect(states).toBeInstanceOf(Map);
      expect(states.size).toBe(0);
    });

    it('should return all project states', () => {
      pauseProject('project-1', 'Reason 1');
      pauseProject('project-2', 'Reason 2');

      const states = getAllProjectStates();

      expect(states.size).toBe(2);
      expect(states.has('project-1')).toBe(true);
      expect(states.has('project-2')).toBe(true);
    });

    it('should return a copy (not the original Map)', () => {
      pauseProject('project-1', 'Test');

      const states = getAllProjectStates();
      states.delete('project-1');

      expect(isProjectPaused('project-1')).toBe(true);
    });
  });

  describe('clearProjectState', () => {
    it('should remove project state', () => {
      pauseProject('project-1', 'Test');
      clearProjectState('project-1');

      expect(getProjectState('project-1')).toBeUndefined();
    });

    it('should not affect other projects', () => {
      pauseProject('project-1', 'Test 1');
      pauseProject('project-2', 'Test 2');
      clearProjectState('project-1');

      expect(getProjectState('project-1')).toBeUndefined();
      expect(isProjectPaused('project-2')).toBe(true);
    });
  });

  describe('clearAllProjectStates', () => {
    it('should remove all project states', () => {
      pauseProject('project-1', 'Test 1');
      pauseProject('project-2', 'Test 2');
      pauseProject('project-3', 'Test 3');

      clearAllProjectStates();

      expect(getAllProjectStates().size).toBe(0);
    });
  });
});
