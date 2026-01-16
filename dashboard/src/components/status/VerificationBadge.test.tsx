import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationBadge } from './VerificationBadge';

describe('VerificationBadge', () => {
  beforeEach(() => {
    // Mock Date.now() for consistent timestamp testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-16T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('pending state', () => {
    it('renders spinner and "Verifying..." text', () => {
      render(<VerificationBadge status="pending" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Verifying...')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
      render(<VerificationBadge status="pending" />);

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Verification pending'
      );
    });

    it('applies gray text color', () => {
      render(<VerificationBadge status="pending" />);

      expect(screen.getByRole('status')).toHaveClass('text-gray-400');
    });

    it('shows spinner with animation', () => {
      render(<VerificationBadge status="pending" />);

      const spinner = screen.getByRole('status').querySelector('svg');
      expect(spinner).toHaveClass('animate-spin');
    });
  });

  describe('verified state', () => {
    it('renders checkmark and "Verified" text', () => {
      render(<VerificationBadge status="verified" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/Verified/)).toBeInTheDocument();
    });

    it('applies amber/gold text color', () => {
      render(<VerificationBadge status="verified" />);

      expect(screen.getByRole('status')).toHaveClass('text-amber-500');
    });

    it('shows time ago when verifiedAt provided (minutes)', () => {
      const fiveMinutesAgo = new Date('2026-01-16T11:55:00.000Z').toISOString();
      render(<VerificationBadge status="verified" verifiedAt={fiveMinutesAgo} />);

      expect(screen.getByText(/5m ago/)).toBeInTheDocument();
    });

    it('shows time ago when verifiedAt provided (hours)', () => {
      const twoHoursAgo = new Date('2026-01-16T10:00:00.000Z').toISOString();
      render(<VerificationBadge status="verified" verifiedAt={twoHoursAgo} />);

      expect(screen.getByText(/2h ago/)).toBeInTheDocument();
    });

    it('shows time ago when verifiedAt provided (days)', () => {
      const twoDaysAgo = new Date('2026-01-14T12:00:00.000Z').toISOString();
      render(<VerificationBadge status="verified" verifiedAt={twoDaysAgo} />);

      expect(screen.getByText(/2d ago/)).toBeInTheDocument();
    });

    it('shows "just now" for recent verification', () => {
      const justNow = new Date('2026-01-16T11:59:45.000Z').toISOString();
      render(<VerificationBadge status="verified" verifiedAt={justNow} />);

      expect(screen.getByText(/just now/)).toBeInTheDocument();
    });

    it('has correct aria-label with timestamp', () => {
      const fiveMinutesAgo = new Date('2026-01-16T11:55:00.000Z').toISOString();
      render(<VerificationBadge status="verified" verifiedAt={fiveMinutesAgo} />);

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Verified 5m ago'
      );
    });
  });

  describe('mismatch state', () => {
    it('renders warning icon and "Mismatch" text', () => {
      render(<VerificationBadge status="mismatch" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Mismatch')).toBeInTheDocument();
    });

    it('applies red text color', () => {
      render(<VerificationBadge status="mismatch" />);

      expect(screen.getByRole('status')).toHaveClass('text-red-500');
    });

    it('has correct aria-label', () => {
      render(<VerificationBadge status="mismatch" />);

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Status mismatch detected'
      );
    });
  });

  describe('unknown state', () => {
    it('renders nothing', () => {
      const { container } = render(<VerificationBadge status="unknown" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('className prop', () => {
    it('accepts custom className for pending state', () => {
      render(<VerificationBadge status="pending" className="custom-class" />);

      expect(screen.getByRole('status')).toHaveClass('custom-class');
    });

    it('accepts custom className for verified state', () => {
      render(<VerificationBadge status="verified" className="custom-class" />);

      expect(screen.getByRole('status')).toHaveClass('custom-class');
    });

    it('accepts custom className for mismatch state', () => {
      render(<VerificationBadge status="mismatch" className="custom-class" />);

      expect(screen.getByRole('status')).toHaveClass('custom-class');
    });
  });
});
