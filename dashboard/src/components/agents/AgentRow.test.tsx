import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentRow } from './AgentRow';
import type { Agent } from '@/types/agent';

describe('AgentRow', () => {
  const mockOnKill = vi.fn();
  const mockOnViewLogs = vi.fn();

  const createMockAgent = (overrides: Partial<Agent> = {}): Agent => ({
    id: 'agent-12345678',
    projectId: 'proj-1',
    storyId: '2-3',
    storyTitle: 'Test Story',
    status: 'running',
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    lastActivity: new Date().toISOString(),
    lastOutput: 'Working on implementation...',
    duration: 300, // 5 minutes
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders agent row with basic info', () => {
    const agent = createMockAgent();
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByTestId('agent-row')).toBeInTheDocument();
    expect(screen.getByText(/agent-12/)).toBeInTheDocument();
    expect(screen.getByText(/Story 2-3/)).toBeInTheDocument();
  });

  it('displays pulsing indicator for running agent under 30 minutes', () => {
    const agent = createMockAgent({ duration: 300 }); // 5 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByTestId('pulsing-indicator')).toBeInTheDocument();
  });

  it('shows warning indicator for agent running 30-45 minutes', () => {
    const agent = createMockAgent({ duration: 35 * 60 }); // 35 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByTestId('warning-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('pulsing-indicator')).not.toBeInTheDocument();
  });

  it('shows stuck indicator for agent running over 45 minutes', () => {
    const agent = createMockAgent({ duration: 50 * 60 }); // 50 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByTestId('stuck-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('pulsing-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('warning-indicator')).not.toBeInTheDocument();
  });

  it('displays duration in correct format', () => {
    const agent = createMockAgent({ duration: 300 }); // 5 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByText(/Running 5m/)).toBeInTheDocument();
  });

  it('displays "Stuck" text for stuck agents', () => {
    const agent = createMockAgent({ duration: 50 * 60 }); // 50 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByText(/Stuck/)).toBeInTheDocument();
  });

  it('shows action buttons when agent is warning', () => {
    const agent = createMockAgent({ duration: 35 * 60 }); // 35 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByRole('button', { name: /kill/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view logs/i })).toBeInTheDocument();
  });

  it('shows action buttons when agent is stuck', () => {
    const agent = createMockAgent({ duration: 50 * 60 }); // 50 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByRole('button', { name: /kill/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view logs/i })).toBeInTheDocument();
  });

  it('shows Kill button for healthy running agent (AC1: always visible)', () => {
    const agent = createMockAgent({ duration: 300 }); // 5 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    // Kill button always visible per AC1
    expect(screen.getByRole('button', { name: /kill/i })).toBeInTheDocument();
    // View Logs only shown for warning/stuck agents
    expect(screen.queryByRole('button', { name: /view logs/i })).not.toBeInTheDocument();
  });

  it('calls onKill when Kill button is clicked', () => {
    const agent = createMockAgent({ duration: 50 * 60 }); // 50 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    fireEvent.click(screen.getByRole('button', { name: /kill/i }));

    expect(mockOnKill).toHaveBeenCalledWith('agent-12345678');
  });

  it('calls onViewLogs when View Logs button is clicked', () => {
    const agent = createMockAgent({ duration: 50 * 60 }); // 50 minutes
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    fireEvent.click(screen.getByRole('button', { name: /view logs/i }));

    expect(mockOnViewLogs).toHaveBeenCalledWith('agent-12345678');
  });

  it('displays truncated output text', () => {
    const agent = createMockAgent({ lastOutput: 'Working on implementation...' });
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByText(/Last: "Working on implementation\.\.\."/)).toBeInTheDocument();
  });

  it('truncates long output text with ellipsis', () => {
    const longOutput = 'A'.repeat(100);
    const agent = createMockAgent({ lastOutput: longOutput });
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    // Should show truncated text (60 chars + ...)
    const truncatedText = 'A'.repeat(60) + '...';
    expect(screen.getByText(new RegExp(`Last: "${truncatedText}"`))).toBeInTheDocument();
  });

  it('displays "Starting..." when no output', () => {
    const agent = createMockAgent({ lastOutput: '' });
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByText(/Last: "Starting\.\.\."/)).toBeInTheDocument();
  });

  it('truncates long agent id to 8 characters', () => {
    const agent = createMockAgent({ id: 'very-long-agent-id-12345' });
    render(<AgentRow agent={agent} onKill={mockOnKill} onViewLogs={mockOnViewLogs} />);

    expect(screen.getByText(/very-lon/)).toBeInTheDocument();
    expect(screen.queryByText(/very-long-agent-id-12345/)).not.toBeInTheDocument();
  });
});
