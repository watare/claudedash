/**
 * Projects Zustand Store
 * Manages project state and API interactions
 */

import { create } from 'zustand';
import { apiGet, apiPost } from '../services/api';
import type { Project } from '../types/project';

interface StartProjectResponse {
  projectId: string;
  status: 'starting' | 'running';
}

interface StopProjectResponse {
  projectId: string;
  status: 'stopped';
}

interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  startingProjectId: string | null;
  stoppingProjectId: string | null;

  fetchProjects: () => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  startProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  stopProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  setProjects: (projects: Project[]) => void;
  updateProjectStatus: (id: string, status: Project['status']) => void;
  clearError: () => void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  startingProjectId: null,
  stoppingProjectId: null,

  fetchProjects: async () => {
    try {
      set({ isLoading: true, error: null });
      const projects = await apiGet<Project[]>('/api/projects');
      set({ projects, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch projects',
        isLoading: false,
      });
    }
  },

  fetchProjectById: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const project = await apiGet<Project>(`/api/projects/${id}`);
      set({ currentProject: project, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch project',
        isLoading: false,
        currentProject: null,
      });
    }
  },

  startProject: async (id: string) => {
    try {
      set({ startingProjectId: id, error: null });
      await apiPost<StartProjectResponse>(`/api/projects/${id}/start`);

      // Update project status optimistically
      get().updateProjectStatus(id, 'running');

      set({ startingProjectId: null });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start project';
      set({ error: errorMessage, startingProjectId: null });
      return { success: false, error: errorMessage };
    }
  },

  stopProject: async (id: string) => {
    try {
      set({ stoppingProjectId: id, error: null });
      await apiPost<StopProjectResponse>(`/api/projects/${id}/stop`);

      // Update project status - backend returns 'stopped', UI uses 'idle' for non-running state
      get().updateProjectStatus(id, 'idle');

      set({ stoppingProjectId: null });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop project';
      set({ error: errorMessage, stoppingProjectId: null });
      return { success: false, error: errorMessage };
    }
  },

  setProjects: (projects) => set({ projects }),

  updateProjectStatus: (id: string, status: Project['status']) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, status } : p)),
      currentProject:
        state.currentProject?.id === id ? { ...state.currentProject, status } : state.currentProject,
    }));
  },

  clearError: () => set({ error: null }),
}));
