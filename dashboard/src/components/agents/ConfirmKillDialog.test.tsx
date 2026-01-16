import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmKillDialog } from './ConfirmKillDialog';

describe('ConfirmKillDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    agentId: 'agent-123',
    storyId: '1-2',
    onConfirm: vi.fn(),
  };

  it('renders dialog with correct content when open', () => {
    render(<ConfirmKillDialog {...defaultProps} />);

    expect(screen.getByTestId('confirm-kill-dialog')).toBeInTheDocument();
    expect(screen.getByText('Kill Agent?')).toBeInTheDocument();
    expect(screen.getByText(/Kill agent working on Story 1-2/)).toBeInTheDocument();
  });

  it('renders Cancel and Kill Agent buttons', () => {
    render(<ConfirmKillDialog {...defaultProps} />);

    expect(screen.getByTestId('kill-dialog-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('kill-dialog-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('kill-dialog-cancel')).toHaveTextContent('Cancel');
    expect(screen.getByTestId('kill-dialog-confirm')).toHaveTextContent('Kill Agent');
  });

  it('calls onConfirm when Kill Agent button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmKillDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId('kill-dialog-confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange with false when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    render(<ConfirmKillDialog {...defaultProps} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByTestId('kill-dialog-cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows "Killing..." and disables buttons when isKilling is true', () => {
    render(<ConfirmKillDialog {...defaultProps} isKilling={true} />);

    expect(screen.getByTestId('kill-dialog-confirm')).toHaveTextContent('Killing...');
    expect(screen.getByTestId('kill-dialog-confirm')).toBeDisabled();
    expect(screen.getByTestId('kill-dialog-cancel')).toBeDisabled();
  });

  it('does not render when open is false', () => {
    render(<ConfirmKillDialog {...defaultProps} open={false} />);

    expect(screen.queryByTestId('confirm-kill-dialog')).not.toBeInTheDocument();
  });

  it('has red styling on Kill Agent button', () => {
    render(<ConfirmKillDialog {...defaultProps} />);

    const confirmButton = screen.getByTestId('kill-dialog-confirm');
    expect(confirmButton).toHaveClass('bg-[#F6465D]');
  });
});
