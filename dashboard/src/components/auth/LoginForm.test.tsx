import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

describe('LoginForm', () => {
  const mockLogin = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    });
  });

  it('renders email and password fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error when email is empty on submit', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows error when email format is invalid', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    // Type text without @ symbol - just typing directly works
    await user.type(screen.getByLabelText(/email/i), 'invalidemail');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    // Submit form by clicking button
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Our validation checks for @ symbol - wait for error to appear
    const errorMessage = await screen.findByText('Invalid email format');
    expect(errorMessage).toBeInTheDocument();
    // Should not call login due to validation failure
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows error when password is empty on submit', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('calls login with email and password on valid submit', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('clears email error when user starts typing', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    // Submit to trigger error
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Email is required')).toBeInTheDocument();

    // Start typing to clear error
    await user.type(screen.getByLabelText(/email/i), 't');
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
  });

  it('clears password error when user starts typing', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Password is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/password/i), 'p');
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
  });

  it('displays API error from store', () => {
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: 'Invalid email or password',
      clearError: mockClearError,
    });

    render(<LoginForm />);

    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
  });

  it('disables form during loading', () => {
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: true,
      error: null,
      clearError: mockClearError,
    });

    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('clears store error when user starts typing', async () => {
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: 'Invalid email or password',
      clearError: mockClearError,
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 't');

    expect(mockClearError).toHaveBeenCalled();
  });
});
