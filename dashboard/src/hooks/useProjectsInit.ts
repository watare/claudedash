/**
 * Hook to initialize projects store on component mount
 * Satisfies AC #1: "When the projectsStore initializes, Then it fetches projects"
 *
 * Usage:
 *   import { useProjectsInit } from '../hooks/useProjectsInit';
 *
 *   function App() {
 *     useProjectsInit(); // Auto-fetches projects on mount
 *     // ...
 *   }
 */

import { useEffect } from 'react';
import { useProjectsStore } from '../stores/projectsStore';

/**
 * Initialize the projects store by fetching projects on mount.
 * Should be called once in the top-level authenticated component.
 */
export function useProjectsInit() {
  const fetchProjects = useProjectsStore((state) => state.fetchProjects);
  const projects = useProjectsStore((state) => state.projects);

  useEffect(() => {
    // Only fetch if we haven't loaded projects yet
    if (projects.length === 0) {
      fetchProjects();
    }
  }, [fetchProjects, projects.length]);
}

/**
 * Hook that provides projects data and auto-fetches on mount.
 * Convenient for components that need projects data.
 */
export function useProjects() {
  useProjectsInit();

  return useProjectsStore((state) => ({
    projects: state.projects,
    isLoading: state.isLoading,
    error: state.error,
  }));
}
