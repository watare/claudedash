import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useAgentsStore } from '@/stores/agentsStore';

// Wrap component with Router for testing
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock the useWebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Layout', () => {
  const mockUser = {
    userId: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    avatarUrl: 'https://github.com/testuser.png',
  };

  const mockFetchAgents = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      logout: vi.fn(),
    });
    useUIStore.setState({
      sidebarCollapsed: false,
      activeProjectId: null,
      agentPanelVisible: true,
    });
    useAgentsStore.setState({
      agents: [],
      isLoading: false,
      error: null,
      fetchAgents: mockFetchAgents,
    });
    localStorageMock.clear();
  });

  it('renders the header component', () => {
    renderWithRouter(<Layout>Content</Layout>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders the sidebar component', () => {
    renderWithRouter(<Layout>Content</Layout>);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders children in the main content area', () => {
    renderWithRouter(<Layout><div data-testid="child-content">Test Content</div></Layout>);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('has full screen height', () => {
    renderWithRouter(<Layout>Content</Layout>);
    const container = screen.getByRole('banner').parentElement?.parentElement;
    expect(container).toHaveClass('h-screen');
  });

  it('uses proper background color', () => {
    renderWithRouter(<Layout>Content</Layout>);
    const container = screen.getByRole('banner').parentElement?.parentElement;
    expect(container).toHaveClass('bg-[#0B0E11]');
  });

  it('uses flex layout for proper structure', () => {
    renderWithRouter(<Layout>Content</Layout>);
    const container = screen.getByRole('banner').parentElement?.parentElement;
    expect(container).toHaveClass('flex');
  });

  // Agent Panel Integration Tests (Story 2.5)
  it('renders the agent activity section', () => {
    renderWithRouter(<Layout>Content</Layout>);
    expect(screen.getByText('Agent Activity')).toBeInTheDocument();
  });

  it('renders agent panel when visible', () => {
    useUIStore.setState({ agentPanelVisible: true });
    renderWithRouter(<Layout>Content</Layout>);
    expect(screen.getByTestId('agent-panel')).toBeInTheDocument();
  });

  it('hides agent panel when not visible', () => {
    useUIStore.setState({ agentPanelVisible: false });
    renderWithRouter(<Layout>Content</Layout>);
    expect(screen.queryByTestId('agent-panel')).not.toBeInTheDocument();
  });

  it('toggles agent panel visibility when button is clicked', () => {
    useUIStore.setState({ agentPanelVisible: true });
    renderWithRouter(<Layout>Content</Layout>);

    const toggleButton = screen.getByRole('button', { name: /hide agent panel/i });
    expect(screen.getByTestId('agent-panel')).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByTestId('agent-panel')).not.toBeInTheDocument();
  });

  it('calls fetchAgents on mount', () => {
    renderWithRouter(<Layout>Content</Layout>);
    expect(mockFetchAgents).toHaveBeenCalled();
  });
});
