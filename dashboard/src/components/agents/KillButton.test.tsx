import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KillButton } from './KillButton';

describe('KillButton', () => {
  const defaultProps = {
    agentId: 'agent-123',
    storyId: '1-2',
    onKillRequest: vi.fn(),
  };

  it('renders with correct styling', () => {
    render(<KillButton {...defaultProps} />);

    const button = screen.getByTestId('kill-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Kill');
    expect(button).toHaveClass('text-[#F6465D]');
  });

  it('calls onKillRequest when clicked', () => {
    const onKillRequest = vi.fn();
    render(<KillButton {...defaultProps} onKillRequest={onKillRequest} />);

    fireEvent.click(screen.getByTestId('kill-button'));

    expect(onKillRequest).toHaveBeenCalledTimes(1);
  });

  it('shows "Killing..." when isKilling is true', () => {
    render(<KillButton {...defaultProps} isKilling={true} />);

    expect(screen.getByTestId('kill-button')).toHaveTextContent('Killing...');
  });

  it('is disabled when isKilling is true', () => {
    render(<KillButton {...defaultProps} isKilling={true} />);

    expect(screen.getByTestId('kill-button')).toBeDisabled();
  });

  it('is enabled when isKilling is false', () => {
    render(<KillButton {...defaultProps} isKilling={false} />);

    expect(screen.getByTestId('kill-button')).not.toBeDisabled();
  });
});
