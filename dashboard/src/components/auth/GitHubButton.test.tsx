import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubButton } from './GitHubButton';
import { authService } from '@/services/auth';

// Mock the auth service
vi.mock('@/services/auth', () => ({
  authService: {
    getGitHubAuthUrl: vi.fn().mockReturnValue('/auth/github'),
  },
}));

describe('GitHubButton', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('renders sign in with GitHub button', () => {
    render(<GitHubButton />);

    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
  });

  it('has GitHub icon', () => {
    render(<GitHubButton />);

    // Check for lucide GitHub icon by looking for the svg
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('redirects to GitHub auth URL on click', async () => {
    const user = userEvent.setup();
    render(<GitHubButton />);

    await user.click(screen.getByRole('button', { name: /sign in with github/i }));

    expect(authService.getGitHubAuthUrl).toHaveBeenCalled();
    expect(window.location.href).toBe('/auth/github');
  });

  it('shows loading spinner after click', async () => {
    const user = userEvent.setup();
    render(<GitHubButton />);

    const button = screen.getByRole('button', { name: /sign in with github/i });

    // Before click - no spinner
    expect(button.querySelector('.animate-spin')).not.toBeInTheDocument();

    await user.click(button);

    // After click - spinner should be visible (button is in loading state)
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
