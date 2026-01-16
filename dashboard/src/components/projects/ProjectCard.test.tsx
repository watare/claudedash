import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectCard } from './ProjectCard';
import type { Project, ProjectStatus } from '@/types/project';

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'test-1',
  name: 'Test Project',
  path: '/path/to/project',
  status: 'running' as ProjectStatus,
  currentEpic: 2,
  currentStory: '2-3',
  agentCount: 4,
  lastActivity: '2026-01-15T12:00:00Z',
  ...overrides,
});

describe('ProjectCard', () => {
  const defaultProps = {
    onViewDetails: vi.fn(),
    onViewLogs: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display', () => {
    it('displays project name', () => {
      const project = createMockProject({ name: 'My Project' });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByText('My Project')).toBeInTheDocument();
    });

    it('displays status dot with correct aria-label', () => {
      const project = createMockProject({ status: 'running' });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Status: Running');
    });

    it('shows agent count badge with singular form', () => {
      const project = createMockProject({ agentCount: 1 });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByText('1 agent')).toBeInTheDocument();
    });

    it('shows agent count badge with plural form', () => {
      const project = createMockProject({ agentCount: 4 });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByText('4 agents')).toBeInTheDocument();
    });

    it('displays current epic and story', () => {
      const project = createMockProject({ currentEpic: 2, currentStory: '2-3' });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByText(/Epic 2, Story 2-3/)).toBeInTheDocument();
    });

    it('displays "No active work" when no current epic/story', () => {
      const project = createMockProject({ currentEpic: null, currentStory: null });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByText(/No active work/)).toBeInTheDocument();
    });

    it('displays status text', () => {
      const project = createMockProject({ status: 'running' });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByText(/Status: running/i)).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('applies gold border when active', () => {
      const project = createMockProject();
      render(<ProjectCard project={project} isActive {...defaultProps} />);
      const card = screen.getByTestId('project-card');
      expect(card).toHaveClass('border-l-[#F0B90B]');
    });

    it('does not apply gold border when not active', () => {
      const project = createMockProject();
      render(<ProjectCard project={project} isActive={false} {...defaultProps} />);
      const card = screen.getByTestId('project-card');
      expect(card).not.toHaveClass('border-l-[#F0B90B]');
    });
  });

  describe('Action Buttons', () => {
    it('renders View Details button', () => {
      const project = createMockProject();
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('renders View Logs button', () => {
      const project = createMockProject();
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByText('View Logs')).toBeInTheDocument();
    });

    it('calls onViewDetails with project id when View Details clicked', () => {
      const onViewDetails = vi.fn();
      const project = createMockProject({ id: 'proj-123' });
      render(<ProjectCard project={project} {...defaultProps} onViewDetails={onViewDetails} />);
      fireEvent.click(screen.getByText('View Details'));
      expect(onViewDetails).toHaveBeenCalledWith('proj-123');
    });

    it('calls onViewLogs with project id when View Logs clicked', () => {
      const onViewLogs = vi.fn();
      const project = createMockProject({ id: 'proj-456' });
      render(<ProjectCard project={project} {...defaultProps} onViewLogs={onViewLogs} />);
      fireEvent.click(screen.getByText('View Logs'));
      expect(onViewLogs).toHaveBeenCalledWith('proj-456');
    });
  });

  describe('Waiting State with Approve Button', () => {
    it('shows Approve button when status is waiting and onApprove provided', () => {
      const project = createMockProject({ status: 'waiting' });
      render(<ProjectCard project={project} {...defaultProps} onApprove={vi.fn()} />);
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    it('does not show Approve button when status is not waiting', () => {
      const project = createMockProject({ status: 'running' });
      render(<ProjectCard project={project} {...defaultProps} onApprove={vi.fn()} />);
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    });

    it('does not show Approve button when onApprove is not provided', () => {
      const project = createMockProject({ status: 'waiting' });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    });

    it('calls onApprove with project id when Approve clicked', () => {
      const onApprove = vi.fn();
      const project = createMockProject({ id: 'proj-789', status: 'waiting' });
      render(<ProjectCard project={project} {...defaultProps} onApprove={onApprove} />);
      fireEvent.click(screen.getByText('Approve'));
      expect(onApprove).toHaveBeenCalledWith('proj-789');
    });

    it('Approve button has gold/default variant styling (prominent)', () => {
      const project = createMockProject({ status: 'waiting' });
      render(<ProjectCard project={project} {...defaultProps} onApprove={vi.fn()} />);
      const approveButton = screen.getByText('Approve').closest('button');
      // variant="default" renders as data-variant="default" and applies gold background
      expect(approveButton).toHaveAttribute('data-variant', 'default');
    });
  });

  describe('Status Colors', () => {
    const statusTests: Array<{ status: ProjectStatus; colorClass: string }> = [
      { status: 'running', colorClass: 'bg-[#0ECB81]' },
      { status: 'waiting', colorClass: 'bg-[#FCD535]' },
      { status: 'failed', colorClass: 'bg-[#F6465D]' },
      { status: 'done', colorClass: 'bg-[#F0B90B]' },
      { status: 'paused', colorClass: 'bg-[#5E6673]' },
    ];

    it.each(statusTests)('displays $colorClass for $status status', ({ status, colorClass }) => {
      const project = createMockProject({ status });
      render(<ProjectCard project={project} {...defaultProps} />);
      expect(screen.getByRole('status')).toHaveClass(colorClass);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('card is focusable with tabIndex', () => {
      const project = createMockProject();
      render(<ProjectCard project={project} {...defaultProps} />);
      const card = screen.getByTestId('project-card');
      expect(card).toHaveAttribute('tabindex', '0');
    });

    it('has accessible aria-label with project name and status', () => {
      const project = createMockProject({ name: 'My Project', status: 'running' });
      render(<ProjectCard project={project} {...defaultProps} />);
      const card = screen.getByTestId('project-card');
      expect(card).toHaveAttribute('aria-label', 'Project My Project, status running');
    });

    it('calls onViewDetails when Enter key is pressed', () => {
      const onViewDetails = vi.fn();
      const project = createMockProject({ id: 'proj-enter' });
      render(<ProjectCard project={project} {...defaultProps} onViewDetails={onViewDetails} />);
      const card = screen.getByTestId('project-card');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onViewDetails).toHaveBeenCalledWith('proj-enter');
    });

    it('calls onViewDetails when Space key is pressed', () => {
      const onViewDetails = vi.fn();
      const project = createMockProject({ id: 'proj-space' });
      render(<ProjectCard project={project} {...defaultProps} onViewDetails={onViewDetails} />);
      const card = screen.getByTestId('project-card');
      fireEvent.keyDown(card, { key: ' ' });
      expect(onViewDetails).toHaveBeenCalledWith('proj-space');
    });

    it('has focus ring styling', () => {
      const project = createMockProject();
      render(<ProjectCard project={project} {...defaultProps} />);
      const card = screen.getByTestId('project-card');
      expect(card).toHaveClass('focus:ring-2');
      expect(card).toHaveClass('focus:ring-[#F0B90B]');
    });
  });
});
