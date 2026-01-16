import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerificationStatus } from './VerificationStatus';

describe('VerificationStatus', () => {
  const defaultProps = {
    storyKey: '3-6-verification-status',
    claimed: 'done',
    actual: 'in-progress',
    onReVerify: vi.fn(),
    onViewDetails: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-16T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('mismatch state', () => {
    it('renders mismatch alert container', () => {
      render(<VerificationStatus {...defaultProps} status="mismatch" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows "Status Mismatch" heading', () => {
      render(<VerificationStatus {...defaultProps} status="mismatch" />);

      expect(screen.getByText('Status Mismatch')).toBeInTheDocument();
    });

    it('displays claimed status', () => {
      render(
        <VerificationStatus
          {...defaultProps}
          status="mismatch"
          claimed="done"
        />
      );

      expect(screen.getByText('Claimed:')).toBeInTheDocument();
      expect(screen.getByText('done')).toBeInTheDocument();
    });

    it('displays actual/verified status', () => {
      render(
        <VerificationStatus
          {...defaultProps}
          status="mismatch"
          actual="in-progress"
        />
      );

      expect(screen.getByText('Verified:')).toBeInTheDocument();
      expect(screen.getByText('in-progress')).toBeInTheDocument();
    });

    it('renders Re-verify button', () => {
      render(<VerificationStatus {...defaultProps} status="mismatch" />);

      expect(
        screen.getByRole('button', { name: /re-verify/i })
      ).toBeInTheDocument();
    });

    it('renders View Details button', () => {
      render(<VerificationStatus {...defaultProps} status="mismatch" />);

      expect(
        screen.getByRole('button', { name: /view details/i })
      ).toBeInTheDocument();
    });

    it('calls onReVerify when Re-verify button clicked', () => {
      const onReVerify = vi.fn();
      render(
        <VerificationStatus
          {...defaultProps}
          status="mismatch"
          onReVerify={onReVerify}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /re-verify/i }));

      expect(onReVerify).toHaveBeenCalledTimes(1);
    });

    it('calls onViewDetails when View Details button clicked', () => {
      const onViewDetails = vi.fn();
      render(
        <VerificationStatus
          {...defaultProps}
          status="mismatch"
          onViewDetails={onViewDetails}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /view details/i }));

      expect(onViewDetails).toHaveBeenCalledTimes(1);
    });

    it('has correct aria-label with story key', () => {
      render(
        <VerificationStatus
          {...defaultProps}
          status="mismatch"
          storyKey="test-story-key"
        />
      );

      expect(screen.getByRole('alert')).toHaveAttribute(
        'aria-label',
        'Status mismatch for story test-story-key'
      );
    });

    it('applies red background styling', () => {
      render(<VerificationStatus {...defaultProps} status="mismatch" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-red-500/10');
      expect(alert).toHaveClass('border-red-500/20');
    });
  });

  describe('pending state', () => {
    it('delegates to VerificationBadge for pending state', () => {
      render(<VerificationStatus {...defaultProps} status="pending" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
    });

    it('does not show action buttons', () => {
      render(<VerificationStatus {...defaultProps} status="pending" />);

      expect(
        screen.queryByRole('button', { name: /re-verify/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('verified state', () => {
    it('delegates to VerificationBadge for verified state', () => {
      render(<VerificationStatus {...defaultProps} status="verified" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/Verified/)).toBeInTheDocument();
    });

    it('shows timestamp when verifiedAt provided', () => {
      const fiveMinutesAgo = new Date('2026-01-16T11:55:00.000Z').toISOString();
      render(
        <VerificationStatus
          {...defaultProps}
          status="verified"
          verifiedAt={fiveMinutesAgo}
        />
      );

      expect(screen.getByText(/5m ago/)).toBeInTheDocument();
    });

    it('does not show action buttons', () => {
      render(<VerificationStatus {...defaultProps} status="verified" />);

      expect(
        screen.queryByRole('button', { name: /re-verify/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('unknown state', () => {
    it('renders nothing for unknown state', () => {
      const { container } = render(
        <VerificationStatus {...defaultProps} status="unknown" />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('className prop', () => {
    it('applies custom className to mismatch container', () => {
      render(
        <VerificationStatus
          {...defaultProps}
          status="mismatch"
          className="custom-class"
        />
      );

      expect(screen.getByRole('alert')).toHaveClass('custom-class');
    });

    it('passes className to VerificationBadge for other states', () => {
      render(
        <VerificationStatus
          {...defaultProps}
          status="verified"
          className="custom-class"
        />
      );

      expect(screen.getByRole('status')).toHaveClass('custom-class');
    });
  });
});
