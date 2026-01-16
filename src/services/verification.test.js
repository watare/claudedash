import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  readYamlStatus,
  getStoryStatus,
  getAllStatuses
} from './verification.js';

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
});
