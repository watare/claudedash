/**
 * Tests for Projects Zustand Store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectsStore } from './projectsStore';
import * as api from '../services/api';
import type { Project } from '../types/project';

// Mock the api module
vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
}));

const mockProjects: Project[] = [
  {
    id: 'bmad-orchestrator',
    name: 'bmad-orchestrator',
    path: '/home/ubuntu/bmad-orchestrator',
    status: 'running',
    currentEpic: 2,
    currentStory: '2-3',
    agentCount: 4,
    lastActivity: '2026-01-15T12:00:00Z',
  },
];

const mockProjectDetail: Project = {
  ...mockProjects[0],
  epics: [
    {
      number: 1,
      title: 'Epic 1',
      status: 'done',
      stories: [
        { id: '1-1', title: 'Story 1', status: 'done' },
      ],
    },
    {
      number: 2,
      title: 'Epic 2',
      status: 'in-progress',
      stories: [
        { id: '2-1', title: 'Story 2-1', status: 'done' },
        { id: '2-2', title: 'Story 2-2', status: 'in-progress' },
      ],
    },
  ],
};

describe('projectsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useProjectsStore.setState({
      projects: [],
      currentProject: null,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useProjectsStore.getState();

      expect(state.projects).toEqual([]);
      expect(state.currentProject).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchProjects', () => {
    it('sets isLoading true while fetching', async () => {
      vi.mocked(api.apiGet).mockImplementation(() => new Promise(() => {})); // Never resolves

      const promise = useProjectsStore.getState().fetchProjects();

      expect(useProjectsStore.getState().isLoading).toBe(true);

      // Clean up - we don't await the promise since it never resolves
    });

    it('fetches projects and updates state', async () => {
      vi.mocked(api.apiGet).mockResolvedValue(mockProjects);

      await useProjectsStore.getState().fetchProjects();

      expect(api.apiGet).toHaveBeenCalledWith('/api/projects');
      expect(useProjectsStore.getState().projects).toEqual(mockProjects);
      expect(useProjectsStore.getState().isLoading).toBe(false);
      expect(useProjectsStore.getState().error).toBeNull();
    });

    it('handles fetch errors', async () => {
      vi.mocked(api.apiGet).mockRejectedValue(new Error('Network error'));

      await useProjectsStore.getState().fetchProjects();

      expect(useProjectsStore.getState().error).toBe('Network error');
      expect(useProjectsStore.getState().isLoading).toBe(false);
      expect(useProjectsStore.getState().projects).toEqual([]);
    });

    it('clears previous error on new fetch', async () => {
      // Set initial error state
      useProjectsStore.setState({ error: 'Previous error' });

      vi.mocked(api.apiGet).mockResolvedValue(mockProjects);

      await useProjectsStore.getState().fetchProjects();

      expect(useProjectsStore.getState().error).toBeNull();
    });
  });

  describe('fetchProjectById', () => {
    it('fetches single project with details', async () => {
      vi.mocked(api.apiGet).mockResolvedValue(mockProjectDetail);

      await useProjectsStore.getState().fetchProjectById('bmad-orchestrator');

      expect(api.apiGet).toHaveBeenCalledWith('/api/projects/bmad-orchestrator');
      expect(useProjectsStore.getState().currentProject).toEqual(mockProjectDetail);
      expect(useProjectsStore.getState().isLoading).toBe(false);
    });

    it('handles fetch errors for single project', async () => {
      vi.mocked(api.apiGet).mockRejectedValue(new Error('Project not found'));

      await useProjectsStore.getState().fetchProjectById('non-existent');

      expect(useProjectsStore.getState().error).toBe('Project not found');
      expect(useProjectsStore.getState().currentProject).toBeNull();
    });
  });

  describe('setProjects', () => {
    it('updates projects for WebSocket updates', () => {
      useProjectsStore.getState().setProjects(mockProjects);

      expect(useProjectsStore.getState().projects).toEqual(mockProjects);
    });

    it('replaces existing projects', () => {
      useProjectsStore.setState({ projects: [mockProjects[0]] });

      const newProjects: Project[] = [
        { ...mockProjects[0], status: 'paused' },
      ];

      useProjectsStore.getState().setProjects(newProjects);

      expect(useProjectsStore.getState().projects).toEqual(newProjects);
      expect(useProjectsStore.getState().projects[0].status).toBe('paused');
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useProjectsStore.setState({ error: 'Some error' });

      useProjectsStore.getState().clearError();

      expect(useProjectsStore.getState().error).toBeNull();
    });
  });
});
