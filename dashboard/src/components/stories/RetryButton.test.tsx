/**
 * RetryButton component tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RetryButton } from './RetryButton';

describe('RetryButton', () => {
  const defaultProps = {
    onRetry: vi.fn() as unknown as (e: React.MouseEvent<HTMLButtonElement>) => void,
    isRetrying: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default "Retry" text', () => {
    render(<RetryButton {...defaultProps} />);

    const button = screen.getByTestId('retry-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Retry');
  });

  it('calls onRetry when clicked', () => {
    render(<RetryButton {...defaultProps} />);

    const button = screen.getByTestId('retry-button');
    fireEvent.click(button);

    expect(defaultProps.onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows "Retrying..." text when isRetrying is true', () => {
    render(<RetryButton {...defaultProps} isRetrying={true} />);

    const button = screen.getByTestId('retry-button');
    expect(button).toHaveTextContent('Retrying...');
  });

  it('is disabled when isRetrying is true', () => {
    render(<RetryButton {...defaultProps} isRetrying={true} />);

    const button = screen.getByTestId('retry-button');
    expect(button).toBeDisabled();
  });

  it('does not call onRetry when disabled', () => {
    render(<RetryButton {...defaultProps} isRetrying={true} />);

    const button = screen.getByTestId('retry-button');
    fireEvent.click(button);

    expect(defaultProps.onRetry).not.toHaveBeenCalled();
  });

  it('applies gold styling (amber-500)', () => {
    render(<RetryButton {...defaultProps} />);

    const button = screen.getByTestId('retry-button');
    expect(button.className).toContain('bg-amber-500');
  });

  it('renders with RotateCcw icon', () => {
    render(<RetryButton {...defaultProps} />);

    // The icon should be present (via svg)
    const button = screen.getByTestId('retry-button');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('spins icon when isRetrying is true', () => {
    render(<RetryButton {...defaultProps} isRetrying={true} />);

    const button = screen.getByTestId('retry-button');
    const svg = button.querySelector('svg');
    expect(svg).toHaveClass('animate-spin');
  });
});
