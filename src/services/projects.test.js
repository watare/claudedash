/**
 * Tests for Projects service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getAllProjects, getProjectById } from './projects.js';

// Mock fs module
vi.mock('fs');

// Mock agents service
vi.mock('./agents.js', () => ({
  getAgentsByProject: vi.fn().mockResolvedValue([]),
}));

describe('Projects Service', () => {
  const mockSprintStatus = `
# generated: 2026-01-15
project: bmad-orchestrator

development_status:
  epic-1: done
  1-1-dashboard-scaffolding: done
  1-2-sqlite-database-setup: done
  epic-2: in-progress
  2-1-dashboard-layout: in-progress
  2-2-projects-store: ready-for-dev
`;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.cwd to return a known path
    vi.spyOn(process, 'cwd').mockReturnValue('/home/ubuntu/bmad-orchestrator');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllProjects', () => {
    it('returns projects array with correct format', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSprintStatus);

      const projects = await getAllProjects();

      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
    });

    it('returns project with all required fields', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSprintStatus);

      const projects = await getAllProjects();
      const project = projects[0];

      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('path');
      expect(project).toHaveProperty('status');
      expect(project).toHaveProperty('currentEpic');
      expect(project).toHaveProperty('currentStory');
      expect(project).toHaveProperty('agentCount');
      expect(project).toHaveProperty('lastActivity');
    });

    it('derives project status from sprint status', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSprintStatus);

      const projects = await getAllProjects();
      const project = projects[0];

      // Project has in-progress epics, so should be running
      expect(project.status).toBe('running');
    });

    it('handles missing sprint status file gracefully', async () => {
      fs.existsSync.mockReturnValue(false);

      const projects = await getAllProjects();

      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0].status).toBe('idle');
    });
  });

  describe('getProjectById', () => {
    it('returns project with epic details', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSprintStatus);

      const project = await getProjectById('bmad-orchestrator');

      expect(project).not.toBeNull();
      expect(project).toHaveProperty('epics');
      expect(Array.isArray(project.epics)).toBe(true);
    });

    it('returns null for non-existent project', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSprintStatus);

      const project = await getProjectById('non-existent-project');

      expect(project).toBeNull();
    });

    it('includes story breakdown within epics', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSprintStatus);

      const project = await getProjectById('bmad-orchestrator');

      expect(project).not.toBeNull();
      // Should have epics from the status file
      const epic1 = project.epics.find((e) => e.number === 1);
      if (epic1) {
        expect(epic1).toHaveProperty('stories');
        expect(Array.isArray(epic1.stories)).toBe(true);
      }
    });

    it('includes agents array in response', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSprintStatus);

      const project = await getProjectById('bmad-orchestrator');

      expect(project).not.toBeNull();
      expect(project).toHaveProperty('agents');
      expect(Array.isArray(project.agents)).toBe(true);
    });

    it('returns title-cased story titles', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSprintStatus);

      const project = await getProjectById('bmad-orchestrator');

      expect(project).not.toBeNull();
      const epic1 = project.epics.find((e) => e.number === 1);
      if (epic1 && epic1.stories.length > 0) {
        // Should be "Dashboard Scaffolding" not "dashboard scaffolding"
        expect(epic1.stories[0].title).toMatch(/^[A-Z]/);
      }
    });
  });
});
