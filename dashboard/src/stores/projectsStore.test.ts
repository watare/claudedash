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
  apiPost: vi.fn(),
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
      startingProjectId: null,
      stoppingProjectId: null,
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

  describe('startProject', () => {
    it('sets startingProjectId while starting', async () => {
      vi.mocked(api.apiPost).mockImplementation(() => new Promise(() => {})); // Never resolves
      useProjectsStore.setState({ projects: mockProjects });

      useProjectsStore.getState().startProject('bmad-orchestrator');

      expect(useProjectsStore.getState().startingProjectId).toBe('bmad-orchestrator');
    });

    it('starts project and updates status', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({ projectId: 'bmad-orchestrator', status: 'starting' });
      useProjectsStore.setState({ projects: mockProjects });

      const result = await useProjectsStore.getState().startProject('bmad-orchestrator');

      expect(api.apiPost).toHaveBeenCalledWith('/api/projects/bmad-orchestrator/start');
      expect(result.success).toBe(true);
      expect(useProjectsStore.getState().startingProjectId).toBeNull();
      expect(useProjectsStore.getState().projects[0].status).toBe('running');
    });

    it('handles start errors', async () => {
      vi.mocked(api.apiPost).mockRejectedValue(new Error('Failed to start'));
      useProjectsStore.setState({ projects: mockProjects });

      const result = await useProjectsStore.getState().startProject('bmad-orchestrator');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to start');
      expect(useProjectsStore.getState().startingProjectId).toBeNull();
    });
  });

  describe('stopProject', () => {
    it('sets stoppingProjectId while stopping', async () => {
      vi.mocked(api.apiPost).mockImplementation(() => new Promise(() => {})); // Never resolves
      useProjectsStore.setState({ projects: mockProjects });

      useProjectsStore.getState().stopProject('bmad-orchestrator');

      expect(useProjectsStore.getState().stoppingProjectId).toBe('bmad-orchestrator');
    });

    it('stops project and updates status', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({ projectId: 'bmad-orchestrator', status: 'stopped' });
      useProjectsStore.setState({ projects: mockProjects });

      const result = await useProjectsStore.getState().stopProject('bmad-orchestrator');

      expect(api.apiPost).toHaveBeenCalledWith('/api/projects/bmad-orchestrator/stop');
      expect(result.success).toBe(true);
      expect(useProjectsStore.getState().stoppingProjectId).toBeNull();
      expect(useProjectsStore.getState().projects[0].status).toBe('idle');
    });

    it('handles stop errors', async () => {
      vi.mocked(api.apiPost).mockRejectedValue(new Error('Failed to stop'));
      useProjectsStore.setState({ projects: mockProjects });

      const result = await useProjectsStore.getState().stopProject('bmad-orchestrator');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to stop');
      expect(useProjectsStore.getState().stoppingProjectId).toBeNull();
    });
  });

  describe('updateProjectStatus', () => {
    it('updates status in projects array', () => {
      useProjectsStore.setState({ projects: mockProjects });

      useProjectsStore.getState().updateProjectStatus('bmad-orchestrator', 'done');

      expect(useProjectsStore.getState().projects[0].status).toBe('done');
    });

    it('updates status in currentProject if matching', () => {
      useProjectsStore.setState({
        projects: mockProjects,
        currentProject: mockProjectDetail,
      });

      useProjectsStore.getState().updateProjectStatus('bmad-orchestrator', 'paused');

      expect(useProjectsStore.getState().currentProject?.status).toBe('paused');
    });

    it('does not update currentProject if not matching', () => {
      useProjectsStore.setState({
        projects: mockProjects,
        currentProject: { ...mockProjectDetail, id: 'other-project' },
      });

      useProjectsStore.getState().updateProjectStatus('bmad-orchestrator', 'paused');

      expect(useProjectsStore.getState().currentProject?.status).toBe('running');
    });
  });
});
