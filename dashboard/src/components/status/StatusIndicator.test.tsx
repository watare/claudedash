import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusIndicator } from './StatusIndicator';

describe('StatusIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-16T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('status dot', () => {
    it('renders status dot for backlog', () => {
      render(
        <StatusIndicator storyStatus="backlog" verificationStatus="unknown" />
      );

      const group = screen.getByRole('group');
      const dot = group.querySelector('span');
      expect(dot).toHaveClass('bg-[#5E6673]');
    });

    it('renders status dot for ready-for-dev', () => {
      render(
        <StatusIndicator
          storyStatus="ready-for-dev"
          verificationStatus="unknown"
        />
      );

      const group = screen.getByRole('group');
      const dot = group.querySelector('span');
      expect(dot).toHaveClass('bg-[#FCD535]');
    });

    it('renders status dot for in-progress with pulse animation', () => {
      render(
        <StatusIndicator
          storyStatus="in-progress"
          verificationStatus="unknown"
        />
      );

      const group = screen.getByRole('group');
      const dot = group.querySelector('span');
      expect(dot).toHaveClass('bg-[#0ECB81]');
      expect(dot).toHaveClass('animate-pulse');
    });

    it('renders status dot for review', () => {
      render(
        <StatusIndicator storyStatus="review" verificationStatus="unknown" />
      );

      const group = screen.getByRole('group');
      const dot = group.querySelector('span');
      expect(dot).toHaveClass('bg-[#F0B90B]');
    });

    it('renders status dot for done', () => {
      render(
        <StatusIndicator storyStatus="done" verificationStatus="unknown" />
      );

      const group = screen.getByRole('group');
      const dot = group.querySelector('span');
      expect(dot).toHaveClass('bg-[#0ECB81]');
    });

    it('does not pulse for non-active statuses', () => {
      render(
        <StatusIndicator storyStatus="done" verificationStatus="unknown" />
      );

      const group = screen.getByRole('group');
      const dot = group.querySelector('span');
      expect(dot).not.toHaveClass('animate-pulse');
    });
  });

  describe('status label', () => {
    it('does not show label by default', () => {
      render(
        <StatusIndicator storyStatus="done" verificationStatus="unknown" />
      );

      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });

    it('shows label when showLabel is true', () => {
      render(
        <StatusIndicator
          storyStatus="done"
          verificationStatus="unknown"
          showLabel
        />
      );

      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('shows correct label for each status', () => {
      const statusLabels = [
        { status: 'backlog' as const, label: 'Backlog' },
        { status: 'ready-for-dev' as const, label: 'Ready for Dev' },
        { status: 'in-progress' as const, label: 'In Progress' },
        { status: 'review' as const, label: 'Review' },
        { status: 'done' as const, label: 'Done' },
        { status: 'failed' as const, label: 'Failed' },
        { status: 'killed' as const, label: 'Killed' },
        { status: 'pending' as const, label: 'Pending' },
      ];

      statusLabels.forEach(({ status, label }) => {
        const { unmount } = render(
          <StatusIndicator
            storyStatus={status}
            verificationStatus="unknown"
            showLabel
          />
        );

        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      });
    });

    // Story 4.4: New status labels
    it('shows Failed label for failed status', () => {
      render(
        <StatusIndicator
          storyStatus="failed"
          verificationStatus="unknown"
          showLabel
        />
      );

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('shows Killed label for killed status', () => {
      render(
        <StatusIndicator
          storyStatus="killed"
          verificationStatus="unknown"
          showLabel
        />
      );

      expect(screen.getByText('Killed')).toBeInTheDocument();
    });

    it('shows Pending label for pending status', () => {
      render(
        <StatusIndicator
          storyStatus="pending"
          verificationStatus="unknown"
          showLabel
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('verification badge integration', () => {
    it('shows pending verification state', () => {
      render(
        <StatusIndicator storyStatus="done" verificationStatus="pending" />
      );

      expect(screen.getByText('Verifying...')).toBeInTheDocument();
    });

    it('shows verified state with timestamp', () => {
      const fiveMinutesAgo = new Date('2026-01-16T11:55:00.000Z').toISOString();
      render(
        <StatusIndicator
          storyStatus="done"
          verificationStatus="verified"
          verifiedAt={fiveMinutesAgo}
        />
      );

      expect(screen.getByText(/Verified/)).toBeInTheDocument();
      expect(screen.getByText(/5m ago/)).toBeInTheDocument();
    });

    it('shows mismatch state', () => {
      render(
        <StatusIndicator storyStatus="done" verificationStatus="mismatch" />
      );

      expect(screen.getByText('Mismatch')).toBeInTheDocument();
    });

    it('shows nothing for unknown verification state', () => {
      render(
        <StatusIndicator storyStatus="done" verificationStatus="unknown" />
      );

      expect(screen.queryByText('Verifying...')).not.toBeInTheDocument();
      expect(screen.queryByText(/Verified/)).not.toBeInTheDocument();
      expect(screen.queryByText('Mismatch')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct aria-label for story status', () => {
      render(
        <StatusIndicator storyStatus="in-progress" verificationStatus="unknown" />
      );

      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-label',
        'Story status: In Progress'
      );
    });

    it('status dot is aria-hidden', () => {
      render(
        <StatusIndicator storyStatus="done" verificationStatus="unknown" />
      );

      const group = screen.getByRole('group');
      const dot = group.querySelector('span');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(
        <StatusIndicator
          storyStatus="done"
          verificationStatus="unknown"
          className="custom-class"
        />
      );

      expect(screen.getByRole('group')).toHaveClass('custom-class');
    });
  });
});
