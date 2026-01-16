import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { useUIStore } from '@/stores/uiStore';

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

describe('Sidebar', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({ sidebarCollapsed: false });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders with expanded width (200px) by default', () => {
    render(<Sidebar />);
    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toHaveClass('w-[200px]');
  });

  it('displays "No projects yet" message when empty and expanded', () => {
    render(<Sidebar />);
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
  });

  it('renders New Project button', () => {
    render(<Sidebar />);
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('renders Collapse button when expanded', () => {
    render(<Sidebar />);
    expect(screen.getByText('Collapse')).toBeInTheDocument();
  });

  it('collapses sidebar when collapse button is clicked', () => {
    render(<Sidebar />);
    const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });

    fireEvent.click(collapseButton);

    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toHaveClass('w-12');
  });

  it('expands sidebar when expand button is clicked', () => {
    // Start collapsed
    useUIStore.setState({ sidebarCollapsed: true });

    render(<Sidebar />);
    const expandButton = screen.getByRole('button', { name: /expand sidebar/i });

    fireEvent.click(expandButton);

    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toHaveClass('w-[200px]');
  });

  it('persists collapsed state to localStorage', () => {
    render(<Sidebar />);
    const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });

    fireEvent.click(collapseButton);

    expect(localStorageMock.setItem).toHaveBeenCalledWith('sidebar-collapsed', 'true');
  });

  it('has proper background color', () => {
    render(<Sidebar />);
    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toHaveClass('bg-[#1E2329]');
  });

  it('has smooth transition animation class', () => {
    render(<Sidebar />);
    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toHaveClass('transition-all');
    expect(sidebar).toHaveClass('duration-200');
    expect(sidebar).toHaveClass('ease-out');
  });

  it('hides text labels when collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: true });

    render(<Sidebar />);

    // "Collapse" text should not be visible when collapsed
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument();
    // "New Project" text should not be visible when collapsed
    expect(screen.queryByText('New Project')).not.toBeInTheDocument();
  });

  it('has proper aria-label for accessibility', () => {
    render(<Sidebar />);
    const sidebar = screen.getByRole('navigation');
    expect(sidebar).toHaveAttribute('aria-label', 'Project navigation');
  });

  it('collapse button has aria-expanded attribute', () => {
    render(<Sidebar />);
    const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
  });
});
