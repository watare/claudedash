import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

// Helper to render with router
function renderWithRouter(
  ui: React.ReactElement,
  { route = '/' } = {}
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  const mockCheckAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while checking auth', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      checkAuth: mockCheckAuth,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Check for loading spinner (the div with animate-spin class)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      checkAuth: mockCheckAuth,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('redirects to login when not authenticated', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      checkAuth: mockCheckAuth,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('calls checkAuth on mount', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      checkAuth: mockCheckAuth,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(mockCheckAuth).toHaveBeenCalled();
  });

  it('does not redirect during loading even if not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      checkAuth: mockCheckAuth,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Should show spinner, not login page
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
