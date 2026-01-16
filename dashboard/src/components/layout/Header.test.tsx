import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('Header', () => {
  const mockLogout = vi.fn();
  const mockUser = {
    userId: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    avatarUrl: 'https://github.com/testuser.png',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
  });

  it('renders the logo/title "bmad-orchestrator"', () => {
    render(<Header />);
    expect(screen.getByText('bmad-orchestrator')).toBeInTheDocument();
  });

  it('displays the logo in gold color', () => {
    render(<Header />);
    const logo = screen.getByText('bmad-orchestrator');
    expect(logo).toHaveClass('text-[#F0B90B]');
  });

  it('displays status summary with project count', () => {
    render(<Header />);
    expect(screen.getByText('0 Projects')).toBeInTheDocument();
  });

  it('displays status summary with agent count', () => {
    render(<Header />);
    expect(screen.getByText('0 Agents')).toBeInTheDocument();
  });

  it('displays status summary with alert count', () => {
    render(<Header />);
    expect(screen.getByText('0 Alerts')).toBeInTheDocument();
  });

  it('renders user avatar with fallback initials', () => {
    render(<Header />);
    // The fallback should show initials
    expect(screen.getByText('TE')).toBeInTheDocument();
  });

  it('opens dropdown menu when avatar is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const trigger = screen.getByRole('button', { name: /user menu/i });

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('calls logout when Logout menu item is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);
    const trigger = screen.getByRole('button', { name: /user menu/i });

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    const logoutItem = screen.getByText('Logout');
    await user.click(logoutItem);

    expect(mockLogout).toHaveBeenCalled();
  });

  it('has header height of 48px (h-12)', () => {
    render(<Header />);
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('h-12');
  });

  it('has proper background color', () => {
    render(<Header />);
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-[#1E2329]');
  });
});
