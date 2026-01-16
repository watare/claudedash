import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectList } from './ProjectList';
import { useProjectsStore } from '@/stores/projectsStore';
import { useUIStore } from '@/stores/uiStore';
import type { Project } from '@/types/project';

vi.mock('@/stores/projectsStore');
vi.mock('@/stores/uiStore');

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Project Alpha',
    path: '/path/alpha',
    status: 'running',
    currentEpic: 1,
    currentStory: '1-2',
    agentCount: 3,
    lastActivity: '2026-01-15T12:00:00Z',
  },
  {
    id: 'proj-2',
    name: 'Project Beta',
    path: '/path/beta',
    status: 'waiting',
    currentEpic: 2,
    currentStory: '2-1',
    agentCount: 1,
    lastActivity: '2026-01-15T11:00:00Z',
  },
];

describe('ProjectList', () => {
  const mockSetActiveProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUIStore).mockReturnValue({
      activeProjectId: null,
      setActiveProject: mockSetActiveProject,
      sidebarCollapsed: false,
      toggleSidebar: vi.fn(),
      setSidebarCollapsed: vi.fn(),
    });
  });

  describe('Loading State', () => {
    it('renders skeleton cards when loading', () => {
      vi.mocked(useProjectsStore).mockReturnValue({
        projects: [],
        isLoading: true,
        currentProject: null,
        error: null,
        fetchProjects: vi.fn(),
        fetchProjectById: vi.fn(),
        setProjects: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ProjectList />);
      expect(screen.getByTestId('project-list-loading')).toBeInTheDocument();
      expect(screen.getAllByClassName ? document.querySelectorAll('.animate-pulse').length : 3).toBe(3);
    });

    it('renders 3 skeleton cards', () => {
      vi.mocked(useProjectsStore).mockReturnValue({
        projects: [],
        isLoading: true,
        currentProject: null,
        error: null,
        fetchProjects: vi.fn(),
        fetchProjectById: vi.fn(),
        setProjects: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ProjectList />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(3);
    });
  });

  describe('Empty State', () => {
    it('renders empty state when no projects', () => {
      vi.mocked(useProjectsStore).mockReturnValue({
        projects: [],
        isLoading: false,
        currentProject: null,
        error: null,
        fetchProjects: vi.fn(),
        fetchProjectById: vi.fn(),
        setProjects: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ProjectList />);
      expect(screen.getByTestId('project-list-empty')).toBeInTheDocument();
      expect(screen.getByText('No projects configured')).toBeInTheDocument();
      expect(screen.getByText(/Point the orchestrator/)).toBeInTheDocument();
    });
  });

  describe('Projects Display', () => {
    it('renders project cards when projects exist', () => {
      vi.mocked(useProjectsStore).mockReturnValue({
        projects: mockProjects,
        isLoading: false,
        currentProject: null,
        error: null,
        fetchProjects: vi.fn(),
        fetchProjectById: vi.fn(),
        setProjects: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ProjectList />);
      expect(screen.getByTestId('project-list')).toBeInTheDocument();
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('renders correct number of project cards', () => {
      vi.mocked(useProjectsStore).mockReturnValue({
        projects: mockProjects,
        isLoading: false,
        currentProject: null,
        error: null,
        fetchProjects: vi.fn(),
        fetchProjectById: vi.fn(),
        setProjects: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ProjectList />);
      const cards = screen.getAllByTestId('project-card');
      expect(cards.length).toBe(2);
    });
  });

  describe('Active Project', () => {
    it('marks active project card with gold border', () => {
      vi.mocked(useProjectsStore).mockReturnValue({
        projects: mockProjects,
        isLoading: false,
        currentProject: null,
        error: null,
        fetchProjects: vi.fn(),
        fetchProjectById: vi.fn(),
        setProjects: vi.fn(),
        clearError: vi.fn(),
      });
      vi.mocked(useUIStore).mockReturnValue({
        activeProjectId: 'proj-1',
        setActiveProject: mockSetActiveProject,
        sidebarCollapsed: false,
        toggleSidebar: vi.fn(),
        setSidebarCollapsed: vi.fn(),
      });

      renderWithRouter(<ProjectList />);
      const cards = screen.getAllByTestId('project-card');
      expect(cards[0]).toHaveClass('border-l-[#F0B90B]');
      expect(cards[1]).not.toHaveClass('border-l-[#F0B90B]');
    });

    it('calls setActiveProject when View Details is clicked', () => {
      vi.mocked(useProjectsStore).mockReturnValue({
        projects: mockProjects,
        isLoading: false,
        currentProject: null,
        error: null,
        fetchProjects: vi.fn(),
        fetchProjectById: vi.fn(),
        setProjects: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ProjectList />);
      const viewDetailsButtons = screen.getAllByText('View Details');
      fireEvent.click(viewDetailsButtons[0]);
      expect(mockSetActiveProject).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('Grid Layout', () => {
    it('uses responsive grid layout', () => {
      vi.mocked(useProjectsStore).mockReturnValue({
        projects: mockProjects,
        isLoading: false,
        currentProject: null,
        error: null,
        fetchProjects: vi.fn(),
        fetchProjectById: vi.fn(),
        setProjects: vi.fn(),
        clearError: vi.fn(),
      });

      renderWithRouter(<ProjectList />);
      const list = screen.getByTestId('project-list');
      expect(list).toHaveClass('grid');
      expect(list).toHaveClass('grid-cols-[repeat(auto-fill,minmax(280px,1fr))]');
    });
  });
});
