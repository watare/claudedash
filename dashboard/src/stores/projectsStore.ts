/**
 * Projects Zustand Store
 * Manages project state and API interactions
 */

import { create } from 'zustand';
import { apiGet } from '../services/api';
import type { Project } from '../types/project';

interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  setProjects: (projects: Project[]) => void;
  clearError: () => void;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

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

  setProjects: (projects) => set({ projects }),

  clearError: () => set({ error: null }),
}));
