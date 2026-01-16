import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjectView } from './ProjectView';
import { useProjectsStore } from '@/stores/projectsStore';
import type { Project } from '@/types/project';

vi.mock('@/stores/projectsStore');

const mockProject: Project = {
  id: 'proj-1',
  name: 'Test Project',
  path: '/path/to/project',
  status: 'running',
  currentEpic: 2,
  currentStory: '2-1',
  agentCount: 1,
  lastActivity: '2026-01-15T10:00:00Z',
  epics: [
    {
      number: 1,
      title: 'Foundation',
      status: 'done',
      stories: [
        { id: '1-1', title: 'Setup', status: 'done' },
        { id: '1-2', title: 'Config', status: 'done' },
      ],
    },
    {
      number: 2,
      title: 'Features',
      status: 'in-progress',
      stories: [
        { id: '2-1', title: 'First Feature', status: 'in-progress' },
        { id: '2-2', title: 'Second Feature', status: 'backlog' },
      ],
    },
  ],
};

const renderWithRouter = (id: string = 'proj-1') => {
  return render(
    <MemoryRouter initialEntries={[`/projects/${id}`]}>
      <Routes>
        <Route path="/projects/:id" element={<ProjectView />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProjectView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    vi.mocked(useProjectsStore).mockReturnValue({
      currentProject: null,
      isLoading: true,
      error: null,
      fetchProjectById: vi.fn(),
      projects: [],
      fetchProjects: vi.fn(),
      setProjects: vi.fn(),
      clearError: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByTestId('project-view-loading')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', () => {
    vi.mocked(useProjectsStore).mockReturnValue({
      currentProject: null,
      isLoading: false,
      error: 'Failed to fetch project',
      fetchProjectById: vi.fn(),
      projects: [],
      fetchProjects: vi.fn(),
      setProjects: vi.fn(),
      clearError: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByTestId('project-view-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch project')).toBeInTheDocument();
  });

  it('shows not found when project is null', () => {
    vi.mocked(useProjectsStore).mockReturnValue({
      currentProject: null,
      isLoading: false,
      error: null,
      fetchProjectById: vi.fn(),
      projects: [],
      fetchProjects: vi.fn(),
      setProjects: vi.fn(),
      clearError: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByTestId('project-view-not-found')).toBeInTheDocument();
    expect(screen.getByText('Project not found')).toBeInTheDocument();
  });

  it('displays project name and status', () => {
    vi.mocked(useProjectsStore).mockReturnValue({
      currentProject: mockProject,
      isLoading: false,
      error: null,
      fetchProjectById: vi.fn(),
      projects: [],
      fetchProjects: vi.fn(),
      setProjects: vi.fn(),
      clearError: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByTestId('project-name')).toHaveTextContent('Test Project');
    expect(screen.getByTestId('project-status')).toHaveTextContent('running');
  });

  it('shows epic completion count', () => {
    vi.mocked(useProjectsStore).mockReturnValue({
      currentProject: mockProject,
      isLoading: false,
      error: null,
      fetchProjectById: vi.fn(),
      projects: [],
      fetchProjects: vi.fn(),
      setProjects: vi.fn(),
      clearError: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByTestId('project-status')).toHaveTextContent('1/2 epics complete');
  });

  it('calls fetchProjectById with correct id on mount', () => {
    const mockFetchProjectById = vi.fn();
    vi.mocked(useProjectsStore).mockReturnValue({
      currentProject: null,
      isLoading: true,
      error: null,
      fetchProjectById: mockFetchProjectById,
      projects: [],
      fetchProjects: vi.fn(),
      setProjects: vi.fn(),
      clearError: vi.fn(),
    });

    renderWithRouter('test-project-id');
    expect(mockFetchProjectById).toHaveBeenCalledWith('test-project-id');
  });

  it('renders back button with navigation to dashboard', () => {
    vi.mocked(useProjectsStore).mockReturnValue({
      currentProject: mockProject,
      isLoading: false,
      error: null,
      fetchProjectById: vi.fn(),
      projects: [],
      fetchProjects: vi.fn(),
      setProjects: vi.fn(),
      clearError: vi.fn(),
    });

    renderWithRouter();
    const backButton = screen.getByTestId('back-button');
    expect(backButton).toBeInTheDocument();
    expect(backButton.closest('a')).toHaveAttribute('href', '/');
  });

  it('shows no epics message when project has no epics', () => {
    vi.mocked(useProjectsStore).mockReturnValue({
      currentProject: { ...mockProject, epics: [] },
      isLoading: false,
      error: null,
      fetchProjectById: vi.fn(),
      projects: [],
      fetchProjects: vi.fn(),
      setProjects: vi.fn(),
      clearError: vi.fn(),
    });

    renderWithRouter();
    expect(screen.getByTestId('no-epics')).toBeInTheDocument();
  });
});
