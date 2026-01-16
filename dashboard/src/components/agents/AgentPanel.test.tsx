import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentPanel } from './AgentPanel';
import { useAgentsStore } from '@/stores/agentsStore';
import type { Agent } from '@/types/agent';

// Mock console.log to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('AgentPanel', () => {
  const createMockAgent = (overrides: Partial<Agent> = {}): Agent => ({
    id: 'agent-1',
    projectId: 'proj-1',
    storyId: '2-3',
    storyTitle: 'Test Story',
    status: 'running',
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    lastActivity: new Date().toISOString(),
    lastOutput: 'Working...',
    duration: 300,
    ...overrides,
  });

  beforeEach(() => {
    // Reset store state before each test
    useAgentsStore.setState({
      agents: [],
      isLoading: false,
      error: null,
    });
  });

  it('renders agent panel', () => {
    render(<AgentPanel />);
    expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
  });

  it('displays agent count in header', () => {
    useAgentsStore.setState({
      agents: [
        createMockAgent({ id: 'agent-1' }),
        createMockAgent({ id: 'agent-2' }),
        createMockAgent({ id: 'agent-3' }),
      ],
      isLoading: false,
      error: null,
    });

    render(<AgentPanel />);
    expect(screen.getByText('AGENTS (3 active)')).toBeInTheDocument();
  });

  it('shows empty state when no active agents', () => {
    useAgentsStore.setState({
      agents: [],
      isLoading: false,
      error: null,
    });

    render(<AgentPanel />);
    expect(screen.getByTestId('agent-panel-empty')).toBeInTheDocument();
    expect(screen.getByText('All agents idle')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    useAgentsStore.setState({
      agents: [],
      isLoading: true,
      error: null,
    });

    render(<AgentPanel />);
    expect(screen.getByTestId('agent-panel-loading')).toBeInTheDocument();
  });

  it('filters agents by projectId', () => {
    useAgentsStore.setState({
      agents: [
        createMockAgent({ id: 'agent-1', projectId: 'project-1' }),
        createMockAgent({ id: 'agent-2', projectId: 'project-2' }),
        createMockAgent({ id: 'agent-3', projectId: 'project-1' }),
      ],
      isLoading: false,
      error: null,
    });

    render(<AgentPanel projectId="project-1" />);

    // Should show 2 agents from project-1
    expect(screen.getByText('AGENTS (2 active)')).toBeInTheDocument();
    expect(screen.getAllByTestId('agent-row')).toHaveLength(2);
  });

  it('shows all agents when no projectId is specified', () => {
    useAgentsStore.setState({
      agents: [
        createMockAgent({ id: 'agent-1', projectId: 'project-1' }),
        createMockAgent({ id: 'agent-2', projectId: 'project-2' }),
      ],
      isLoading: false,
      error: null,
    });

    render(<AgentPanel />);

    expect(screen.getByText('AGENTS (2 active)')).toBeInTheDocument();
    expect(screen.getAllByTestId('agent-row')).toHaveLength(2);
  });

  it('only shows running and stuck agents as active', () => {
    useAgentsStore.setState({
      agents: [
        createMockAgent({ id: 'agent-1', status: 'running' }),
        createMockAgent({ id: 'agent-2', status: 'stuck' }),
        createMockAgent({ id: 'agent-3', status: 'completed' }),
        createMockAgent({ id: 'agent-4', status: 'killed' }),
      ],
      isLoading: false,
      error: null,
    });

    render(<AgentPanel />);

    // Should only count running and stuck as active
    expect(screen.getByText('AGENTS (2 active)')).toBeInTheDocument();
    expect(screen.getAllByTestId('agent-row')).toHaveLength(2);
  });

  it('renders multiple agent rows', () => {
    useAgentsStore.setState({
      agents: [
        createMockAgent({ id: 'agent-1', storyId: '2-3' }),
        createMockAgent({ id: 'agent-2', storyId: '2-4' }),
        createMockAgent({ id: 'agent-3', storyId: '2-5' }),
      ],
      isLoading: false,
      error: null,
    });

    render(<AgentPanel />);

    const rows = screen.getAllByTestId('agent-row');
    expect(rows).toHaveLength(3);
    expect(screen.getByText(/Story 2-3/)).toBeInTheDocument();
    expect(screen.getByText(/Story 2-4/)).toBeInTheDocument();
    expect(screen.getByText(/Story 2-5/)).toBeInTheDocument();
  });
});
