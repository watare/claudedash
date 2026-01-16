import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  readYamlStatus,
  getStoryStatus,
  getAllStatuses,
  normalizeStatus,
  compareStatus,
  storeVerificationResult,
  getVerificationResult,
  clearVerificationResult,
  getAllVerificationResults,
  clearAllVerificationResults,
  logVerificationAttempt
} from './verification.js';

// Mock the database functions to avoid requiring a real DB in unit tests
vi.mock('../db/sqlite.js', () => ({
  insertAuditLog: vi.fn(() => 1),
  queryAuditLogs: vi.fn(() => ({ rows: [], total: 0 })),
}));

import { insertAuditLog } from '../db/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test fixtures directory
const fixturesDir = path.join(__dirname, '__fixtures__');

describe('verification service', () => {
  // Setup: Create test fixtures
  beforeAll(() => {
    fs.mkdirSync(fixturesDir, { recursive: true });

    // Valid sprint-status.yaml
    const validYaml = `# Sprint Status File
generated: 2026-01-15
project: test-project
tracking_system: file-system

development_status:
  epic-1: in-progress
  1-1-dashboard-scaffolding: done
  1-2-database-setup: in-progress
  1-3-auth-system: ready-for-dev
  epic-2: backlog
  2-1-api-endpoints: backlog
`;
    fs.writeFileSync(path.join(fixturesDir, 'valid-status.yaml'), validYaml);

    // Malformed YAML
    const malformedYaml = `
development_status:
  epic-1: in-progress
  invalid_yaml: [unclosed bracket
  1-2-test: done
`;
    fs.writeFileSync(path.join(fixturesDir, 'malformed.yaml'), malformedYaml);

    // Empty file
    fs.writeFileSync(path.join(fixturesDir, 'empty.yaml'), '');

    // YAML with frontmatter (mixed markdown/yaml style)
    const frontmatterYaml = `---
title: Sprint Status
date: 2026-01-15
---

# This is a comment section

development_status:
  epic-1: done
  1-1-feature: done
`;
    fs.writeFileSync(path.join(fixturesDir, 'frontmatter.yaml'), frontmatterYaml);

    // Legacy format (no development_status wrapper)
    const legacyYaml = `
epic-1: in-progress
1-1-legacy-story: done
1-2-another-story: ready-for-dev
`;
    fs.writeFileSync(path.join(fixturesDir, 'legacy-format.yaml'), legacyYaml);
  });

  // Cleanup: Remove test fixtures
  afterAll(() => {
    fs.rmSync(fixturesDir, { recursive: true, force: true });
  });

  describe('readYamlStatus', () => {
    it('should parse valid sprint-status.yaml and return success', () => {
      const result = readYamlStatus(path.join(fixturesDir, 'valid-status.yaml'));

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.development_status).toBeDefined();
      expect(result.data.development_status['epic-1']).toBe('in-progress');
      expect(result.data.development_status['1-1-dashboard-scaffolding']).toBe('done');
    });

    it('should handle malformed YAML and return error response', () => {
      const result = readYamlStatus(path.join(fixturesDir, 'malformed.yaml'));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.status).toBe('unknown');
      expect(typeof result.error).toBe('string');
    });

    it('should handle missing file gracefully', () => {
      const result = readYamlStatus(path.join(fixturesDir, 'nonexistent.yaml'));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.status).toBe('unknown');
      expect(result.code).toBe('FILE_READ_ERROR');
    });

    it('should handle empty file gracefully', () => {
      const result = readYamlStatus(path.join(fixturesDir, 'empty.yaml'));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.status).toBe('unknown');
    });

    it('should handle YAML with frontmatter', () => {
      const result = readYamlStatus(path.join(fixturesDir, 'frontmatter.yaml'));

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.development_status).toBeDefined();
      expect(result.data.development_status['epic-1']).toBe('done');
    });
  });

  describe('getStoryStatus', () => {
    it('should extract single story status from development_status', () => {
      const yamlData = {
        development_status: {
          'epic-1': 'in-progress',
          '1-1-dashboard-scaffolding': 'done',
          '1-2-database-setup': 'ready-for-dev'
        }
      };

      expect(getStoryStatus(yamlData, '1-1-dashboard-scaffolding')).toBe('done');
      expect(getStoryStatus(yamlData, '1-2-database-setup')).toBe('ready-for-dev');
    });

    it('should extract epic status', () => {
      const yamlData = {
        development_status: {
          'epic-1': 'in-progress',
          'epic-2': 'backlog'
        }
      };

      expect(getStoryStatus(yamlData, 'epic-1')).toBe('in-progress');
      expect(getStoryStatus(yamlData, 'epic-2')).toBe('backlog');
    });

    it('should handle legacy format without development_status wrapper', () => {
      const yamlData = {
        'epic-1': 'in-progress',
        '1-1-legacy-story': 'done'
      };

      expect(getStoryStatus(yamlData, '1-1-legacy-story')).toBe('done');
      expect(getStoryStatus(yamlData, 'epic-1')).toBe('in-progress');
    });

    it('should return unknown for non-existent story key', () => {
      const yamlData = {
        development_status: {
          '1-1-exists': 'done'
        }
      };

      expect(getStoryStatus(yamlData, '99-99-nonexistent')).toBe('unknown');
    });

    it('should return unknown for null/undefined yamlData', () => {
      expect(getStoryStatus(null, '1-1-test')).toBe('unknown');
      expect(getStoryStatus(undefined, '1-1-test')).toBe('unknown');
    });
  });

  describe('getAllStatuses', () => {
    it('should return Map of all story statuses from development_status', () => {
      const yamlData = {
        development_status: {
          'epic-1': 'in-progress',
          '1-1-dashboard': 'done',
          '1-2-database': 'ready-for-dev'
        }
      };

      const statuses = getAllStatuses(yamlData);

      expect(statuses).toBeInstanceOf(Map);
      expect(statuses.get('epic-1')).toBe('in-progress');
      expect(statuses.get('1-1-dashboard')).toBe('done');
      expect(statuses.get('1-2-database')).toBe('ready-for-dev');
      expect(statuses.size).toBe(3);
    });

    it('should handle legacy format', () => {
      const yamlData = {
        'epic-1': 'done',
        '1-1-story': 'done'
      };

      const statuses = getAllStatuses(yamlData);

      expect(statuses.get('epic-1')).toBe('done');
      expect(statuses.get('1-1-story')).toBe('done');
    });

    it('should return empty Map for null/undefined yamlData', () => {
      expect(getAllStatuses(null).size).toBe(0);
      expect(getAllStatuses(undefined).size).toBe(0);
    });

    it('should filter out non-string values', () => {
      const yamlData = {
        development_status: {
          'epic-1': 'done',
          'generated': 2026,
          'project': 'test',
          '1-1-story': 'in-progress'
        }
      };

      const statuses = getAllStatuses(yamlData);

      // Should include string status values only
      // Note: 'project': 'test' is also included because it's a string
      // This is a known limitation - filtering string metadata requires
      // knowing valid status values (see action item MED-2)
      expect(statuses.has('epic-1')).toBe(true);
      expect(statuses.has('1-1-story')).toBe(true);
      expect(statuses.has('generated')).toBe(false); // number, filtered out
    });
  });

  // ==========================================================================
  // Story 3.2: Status Comparison Engine Tests
  // ==========================================================================

  describe('normalizeStatus', () => {
    it('should normalize status to lowercase', () => {
      expect(normalizeStatus('DONE')).toBe('done');
      expect(normalizeStatus('In-Progress')).toBe('in-progress');
      expect(normalizeStatus('BACKLOG')).toBe('backlog');
    });

    it('should trim whitespace', () => {
      expect(normalizeStatus('  done  ')).toBe('done');
      expect(normalizeStatus('\tin-progress\n')).toBe('in-progress');
    });

    it('should map status aliases to canonical values', () => {
      // done aliases
      expect(normalizeStatus('complete')).toBe('done');
      expect(normalizeStatus('completed')).toBe('done');
      expect(normalizeStatus('finished')).toBe('done');

      // backlog aliases
      expect(normalizeStatus('pending')).toBe('backlog');
      expect(normalizeStatus('todo')).toBe('backlog');

      // in-progress aliases
      expect(normalizeStatus('wip')).toBe('in-progress');
      expect(normalizeStatus('working')).toBe('in-progress');
    });

    it('should return unknown for null/undefined', () => {
      expect(normalizeStatus(null)).toBe('unknown');
      expect(normalizeStatus(undefined)).toBe('unknown');
    });

    it('should pass through unrecognized status values', () => {
      expect(normalizeStatus('ready-for-dev')).toBe('ready-for-dev');
      expect(normalizeStatus('review')).toBe('review');
      expect(normalizeStatus('blocked')).toBe('blocked');
    });
  });

  describe('compareStatus', () => {
    beforeAll(() => {
      // Clear any existing results before tests
      clearAllVerificationResults();
    });

    afterAll(() => {
      // Clean up after tests
      clearAllVerificationResults();
    });

    it('should return match: true for matching statuses', async () => {
      const result = await compareStatus(
        '1-1-dashboard-scaffolding',
        'done',
        path.join(fixturesDir, 'valid-status.yaml')
      );

      expect(result.match).toBe(true);
      expect(result.claimed).toBe('done');
      expect(result.actual).toBe('done');
      expect(result.storyKey).toBe('1-1-dashboard-scaffolding');
      expect(result.timestamp).toBeDefined();
      expect(result.attemptCount).toBe(1);
    });

    it('should return match: false for mismatching statuses', async () => {
      clearAllVerificationResults();
      const result = await compareStatus(
        '1-2-database-setup',
        'done',
        path.join(fixturesDir, 'valid-status.yaml')
      );

      expect(result.match).toBe(false);
      expect(result.claimed).toBe('done');
      expect(result.actual).toBe('in-progress');
    });

    it('should normalize status aliases before comparison', async () => {
      clearAllVerificationResults();
      // 'complete' should normalize to 'done' and match
      const result = await compareStatus(
        '1-1-dashboard-scaffolding',
        'complete',
        path.join(fixturesDir, 'valid-status.yaml')
      );

      expect(result.match).toBe(true);
      expect(result.claimed).toBe('done'); // normalized from 'complete'
      expect(result.actual).toBe('done');
    });

    it('should handle case-insensitive comparison', async () => {
      clearAllVerificationResults();
      const result = await compareStatus(
        '1-1-dashboard-scaffolding',
        'DONE',
        path.join(fixturesDir, 'valid-status.yaml')
      );

      expect(result.match).toBe(true);
      expect(result.claimed).toBe('done');
    });

    it('should return actual: unknown for missing story in YAML', async () => {
      clearAllVerificationResults();
      const result = await compareStatus(
        '99-99-nonexistent-story',
        'done',
        path.join(fixturesDir, 'valid-status.yaml')
      );

      expect(result.match).toBe(false);
      expect(result.actual).toBe('unknown');
    });

    it('should handle missing YAML file gracefully', async () => {
      clearAllVerificationResults();
      const result = await compareStatus(
        '1-1-test',
        'done',
        path.join(fixturesDir, 'nonexistent.yaml')
      );

      expect(result.match).toBe(false);
      expect(result.actual).toBe('unknown');
      expect(result.error).toBeDefined();
    });

    it('should increment attemptCount on subsequent calls', async () => {
      clearAllVerificationResults();

      const result1 = await compareStatus(
        'attempt-test-story',
        'done',
        path.join(fixturesDir, 'valid-status.yaml')
      );
      expect(result1.attemptCount).toBe(1);

      const result2 = await compareStatus(
        'attempt-test-story',
        'done',
        path.join(fixturesDir, 'valid-status.yaml')
      );
      expect(result2.attemptCount).toBe(2);

      const result3 = await compareStatus(
        'attempt-test-story',
        'in-progress',
        path.join(fixturesDir, 'valid-status.yaml')
      );
      expect(result3.attemptCount).toBe(3);
    });
  });

  describe('verification result storage', () => {
    beforeAll(() => {
      clearAllVerificationResults();
    });

    afterAll(() => {
      clearAllVerificationResults();
    });

    it('should store and retrieve verification result', () => {
      const result = {
        storyKey: 'test-story-1',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      };

      storeVerificationResult('test-story-1', result);
      const retrieved = getVerificationResult('test-story-1');

      expect(retrieved).toBeDefined();
      expect(retrieved.storyKey).toBe('test-story-1');
      expect(retrieved.claimed).toBe('done');
      expect(retrieved.actual).toBe('in-progress');
      expect(retrieved.match).toBe(false);
      expect(retrieved.lastChecked).toBeDefined();
    });

    it('should return null for non-existent story key', () => {
      const result = getVerificationResult('non-existent-key');
      expect(result).toBeNull();
    });

    it('should clear verification result', () => {
      const result = {
        storyKey: 'clear-test-story',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      };

      storeVerificationResult('clear-test-story', result);
      expect(getVerificationResult('clear-test-story')).toBeDefined();

      clearVerificationResult('clear-test-story');
      expect(getVerificationResult('clear-test-story')).toBeNull();
    });

    it('should get all verification results', () => {
      clearAllVerificationResults();

      storeVerificationResult('story-a', {
        storyKey: 'story-a',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      });

      storeVerificationResult('story-b', {
        storyKey: 'story-b',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      });

      const allResults = getAllVerificationResults();

      expect(allResults).toBeInstanceOf(Map);
      expect(allResults.size).toBe(2);
      expect(allResults.has('story-a')).toBe(true);
      expect(allResults.has('story-b')).toBe(true);
    });

    it('should update existing result when storing again', () => {
      clearAllVerificationResults();

      storeVerificationResult('update-test', {
        storyKey: 'update-test',
        claimed: 'in-progress',
        actual: 'in-progress',
        match: true,
        timestamp: '2026-01-15T10:00:00Z',
        attemptCount: 1
      });

      storeVerificationResult('update-test', {
        storyKey: 'update-test',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: '2026-01-15T11:00:00Z',
        attemptCount: 2
      });

      const result = getVerificationResult('update-test');
      expect(result.claimed).toBe('done');
      expect(result.attemptCount).toBe(2);
      expect(result.match).toBe(false);
    });
  });

  // ==========================================================================
  // Story 3.3: Re-Verification Workflow Trigger Tests
  // ==========================================================================

  describe('buildVerificationPrompt', () => {
    let buildVerificationPrompt;

    beforeAll(async () => {
      const module = await import('./verification.js');
      buildVerificationPrompt = module.buildVerificationPrompt;
    });

    it('should include story key in prompt', () => {
      const prompt = buildVerificationPrompt(
        '3-1-yaml-status-reader-service',
        'done',
        'in-progress',
        '/path/to/sprint-status.yaml'
      );

      expect(prompt).toContain('3-1-yaml-status-reader-service');
    });

    it('should include claimed and actual status in prompt', () => {
      const prompt = buildVerificationPrompt(
        '3-1-test',
        'done',
        'in-progress',
        '/path/to/sprint-status.yaml'
      );

      expect(prompt).toContain('done');
      expect(prompt).toContain('in-progress');
    });

    it('should include YAML file path in prompt', () => {
      const yamlPath = '/project/sprint-status.yaml';
      const prompt = buildVerificationPrompt(
        '3-1-test',
        'done',
        'in-progress',
        yamlPath
      );

      expect(prompt).toContain(yamlPath);
    });

    it('should include instructions for verification', () => {
      const prompt = buildVerificationPrompt(
        '3-1-test',
        'done',
        'in-progress',
        '/path/to/sprint-status.yaml'
      );

      expect(prompt.toLowerCase()).toContain('verify');
      expect(prompt).toContain('sprint-status.yaml');
    });
  });

  describe('triggerReVerification', () => {
    let triggerReVerification;
    let VERIFICATION_CONFIG;

    beforeAll(async () => {
      const module = await import('./verification.js');
      triggerReVerification = module.triggerReVerification;
      VERIFICATION_CONFIG = module.VERIFICATION_CONFIG;
    });

    beforeEach(() => {
      clearAllVerificationResults();
    });

    it('should return ReVerificationResult with required properties', async () => {
      const mismatchResult = {
        storyKey: 'test-story',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      };

      const result = await triggerReVerification(
        'test-story',
        mismatchResult,
        {
          projectPath: process.cwd(),
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 1,
          skipSubprocess: true // Skip actual Claude subprocess in tests
        }
      );

      expect(result).toHaveProperty('storyKey');
      expect(result).toHaveProperty('resolved');
      expect(result).toHaveProperty('attempts');
      expect(result).toHaveProperty('finalStatus');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });

    it('should track verification attempts', async () => {
      const mismatchResult = {
        storyKey: 'attempt-tracking-story',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      };

      const result = await triggerReVerification(
        'attempt-tracking-story',
        mismatchResult,
        {
          projectPath: process.cwd(),
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 1,
          skipSubprocess: true
        }
      );

      expect(result.attempts).toBeGreaterThanOrEqual(1);
    });

    it('should return resolved: false when status still mismatches', async () => {
      const mismatchResult = {
        storyKey: '1-2-database-setup', // This is in-progress in valid-status.yaml
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      };

      const result = await triggerReVerification(
        '1-2-database-setup',
        mismatchResult,
        {
          projectPath: process.cwd(),
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 1,
          skipSubprocess: true
        }
      );

      expect(result.resolved).toBe(false);
    });

    it('should respect maxRetries configuration', async () => {
      const mismatchResult = {
        storyKey: 'retry-test-story',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      };

      const result = await triggerReVerification(
        'retry-test-story',
        mismatchResult,
        {
          projectPath: process.cwd(),
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 2,
          retryDelayMs: 10, // Short delay for testing
          skipSubprocess: true
        }
      );

      expect(result.attempts).toBeLessThanOrEqual(2);
    }, 10000); // Extended timeout for retry test

    it('should return error message when max retries exceeded', async () => {
      const mismatchResult = {
        storyKey: 'max-retry-story',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      };

      const result = await triggerReVerification(
        'max-retry-story',
        mismatchResult,
        {
          projectPath: process.cwd(),
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 1,
          skipSubprocess: true
        }
      );

      if (!result.resolved) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('spawnVerificationAgent', () => {
    let spawnVerificationAgent;

    beforeAll(async () => {
      const module = await import('./verification.js');
      spawnVerificationAgent = module.spawnVerificationAgent;
    });

    it('should return SubprocessResult with exitCode and output', async () => {
      // This test uses a simple echo command to verify the function signature
      // In production, this would spawn Claude
      const result = await spawnVerificationAgent(
        'Test prompt',
        process.cwd(),
        { mockCommand: 'echo', mockArgs: ['test output'] }
      );

      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('output');
    });
  });

  // ==========================================================================
  // Story 3.4: Verification Blocking Logic Tests
  // ==========================================================================

  describe('verifyBeforeProceeding', () => {
    let verifyBeforeProceeding;

    beforeAll(async () => {
      const module = await import('./verification.js');
      verifyBeforeProceeding = module.verifyBeforeProceeding;
    });

    beforeEach(() => {
      clearAllVerificationResults();
    });

    it('should return proceed: true when status matches', async () => {
      const result = await verifyBeforeProceeding(
        '1-1-dashboard-scaffolding',
        'done',
        process.cwd(),
        {
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 1,
          skipSubprocess: true
        }
      );

      expect(result.proceed).toBe(true);
      expect(result.action).toBe('proceed');
      expect(result.result).toBeDefined();
      expect(result.result.match).toBe(true);
    });

    it('should return proceed: false when status mismatches after max retries', async () => {
      const result = await verifyBeforeProceeding(
        '1-2-database-setup', // This is in-progress in valid-status.yaml
        'done',               // But we claim it's done
        process.cwd(),
        {
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 1,
          skipSubprocess: true,
          retryDelayMs: 10 // Minimal delay for tests
        }
      );

      expect(result.proceed).toBe(false);
      expect(result.action).toBe('pause');
      expect(result.result).toBeDefined();
    });

    it('should include verification result in response', async () => {
      const result = await verifyBeforeProceeding(
        '1-1-dashboard-scaffolding',
        'done',
        process.cwd(),
        {
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 1,
          skipSubprocess: true
        }
      );

      expect(result.result).toHaveProperty('storyKey', '1-1-dashboard-scaffolding');
      expect(result.result).toHaveProperty('claimed', 'done');
      expect(result.result).toHaveProperty('actual', 'done');
    });

    it('should handle missing YAML file gracefully', async () => {
      const result = await verifyBeforeProceeding(
        'test-story',
        'done',
        process.cwd(),
        {
          yamlPath: path.join(fixturesDir, 'nonexistent.yaml'),
          maxRetries: 1,
          skipSubprocess: true,
          retryDelayMs: 10
        }
      );

      expect(result.proceed).toBe(false);
      expect(result.action).toBe('pause');
    });

    it('should use default yaml path when not specified', async () => {
      // Create a temp project path for this test
      const tempProjectPath = path.join(fixturesDir, 'temp-project');
      const tempYamlDir = path.join(tempProjectPath, '_bmad-output', 'implementation-artifacts');
      fs.mkdirSync(tempYamlDir, { recursive: true });

      // Copy the valid status file
      const validYaml = fs.readFileSync(path.join(fixturesDir, 'valid-status.yaml'), 'utf8');
      fs.writeFileSync(path.join(tempYamlDir, 'sprint-status.yaml'), validYaml);

      try {
        const result = await verifyBeforeProceeding(
          '1-1-dashboard-scaffolding',
          'done',
          tempProjectPath,
          {
            maxRetries: 1,
            skipSubprocess: true
          }
        );

        expect(result.proceed).toBe(true);
      } finally {
        // Cleanup
        fs.rmSync(tempProjectPath, { recursive: true, force: true });
      }
    });

    it('should trigger re-verification on mismatch', async () => {
      const result = await verifyBeforeProceeding(
        '1-3-auth-system', // This is ready-for-dev in valid-status.yaml
        'in-progress',     // Claim it's in-progress (mismatch)
        process.cwd(),
        {
          yamlPath: path.join(fixturesDir, 'valid-status.yaml'),
          maxRetries: 2,
          skipSubprocess: true,
          retryDelayMs: 10
        }
      );

      // Should attempt re-verification
      expect(result.result).toHaveProperty('attempts');
      expect(result.result.attempts).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Story 3.5: Verification Logging & Audit Tests
  // ==========================================================================

  describe('logVerificationAttempt', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call insertAuditLog with correct parameters', () => {
      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: '3-1-test-story',
        projectId: 'bmad-orchestrator',
        claimedStatus: 'done',
        actualStatus: 'in-progress',
        result: 'mismatch',
        durationMs: 150,
        attemptCount: 1
      };

      const rowId = logVerificationAttempt(entry);

      expect(insertAuditLog).toHaveBeenCalledTimes(1);
      expect(insertAuditLog).toHaveBeenCalledWith(entry);
      expect(rowId).toBe(1);
    });

    it('should return rowId on successful insert', () => {
      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: 'success-test',
        claimedStatus: 'done',
        actualStatus: 'done',
        result: 'match'
      };

      const rowId = logVerificationAttempt(entry);

      expect(rowId).toBe(1);
    });

    it('should handle database errors gracefully without crashing', () => {
      insertAuditLog.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: 'error-test',
        claimedStatus: 'done',
        actualStatus: 'in-progress',
        result: 'error'
      };

      // Should not throw
      const rowId = logVerificationAttempt(entry);

      // Should return null on error
      expect(rowId).toBeNull();
    });

    it('should log match result correctly', () => {
      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: 'match-test',
        claimedStatus: 'done',
        actualStatus: 'done',
        result: 'match',
        durationMs: 50,
        attemptCount: 1
      };

      logVerificationAttempt(entry);

      expect(insertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'match',
          storyId: 'match-test'
        })
      );
    });

    it('should log mismatch result correctly', () => {
      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: 'mismatch-test',
        claimedStatus: 'done',
        actualStatus: 'in-progress',
        result: 'mismatch',
        durationMs: 100,
        attemptCount: 2
      };

      logVerificationAttempt(entry);

      expect(insertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'mismatch',
          claimedStatus: 'done',
          actualStatus: 'in-progress'
        })
      );
    });

    it('should log error result with details', () => {
      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: 'error-detail-test',
        claimedStatus: 'done',
        actualStatus: 'unknown',
        result: 'error',
        durationMs: 10,
        attemptCount: 1,
        details: JSON.stringify({ error: 'File not found' })
      };

      logVerificationAttempt(entry);

      expect(insertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'error',
          details: expect.stringContaining('File not found')
        })
      );
    });

    it('should handle optional fields', () => {
      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: 'minimal-test',
        claimedStatus: 'done',
        actualStatus: 'done',
        result: 'match'
        // No optional fields: projectId, durationMs, attemptCount, details, actionTaken
      };

      const rowId = logVerificationAttempt(entry);

      expect(rowId).toBe(1);
      expect(insertAuditLog).toHaveBeenCalledWith(entry);
    });

    it('should include actionTaken when provided', () => {
      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: 'action-test',
        claimedStatus: 'done',
        actualStatus: 'done',
        result: 'match',
        actionTaken: 're-verification-resolved',
        durationMs: 5000,
        attemptCount: 3
      };

      logVerificationAttempt(entry);

      expect(insertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actionTaken: 're-verification-resolved'
        })
      );
    });

    it('should reject invalid result type and return null', () => {
      const entry = {
        timestamp: '2026-01-15T12:00:00Z',
        storyId: 'invalid-result-test',
        claimedStatus: 'done',
        actualStatus: 'done',
        result: 'invalid-type'
      };

      const rowId = logVerificationAttempt(entry);

      expect(rowId).toBeNull();
      expect(insertAuditLog).not.toHaveBeenCalled();
    });

    it('should accept all valid result types', () => {
      const validTypes = ['match', 'mismatch', 'error'];

      for (const resultType of validTypes) {
        vi.clearAllMocks();
        const entry = {
          timestamp: '2026-01-15T12:00:00Z',
          storyId: `valid-${resultType}-test`,
          claimedStatus: 'done',
          actualStatus: 'done',
          result: resultType
        };

        const rowId = logVerificationAttempt(entry);

        expect(rowId).toBe(1);
        expect(insertAuditLog).toHaveBeenCalled();
      }
    });
  });
});
