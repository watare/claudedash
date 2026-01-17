/**
 * Tests for StuckAgentIndicator Component
 *
 * Story 4.6: Stuck Agent Detection & Alerts - Task 9.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StuckAgentIndicator } from './StuckAgentIndicator';

describe('StuckAgentIndicator', () => {
  beforeEach(() => {
    // Mock Date.now() for consistent testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with stuck duration', () => {
    // Set current time to 45 minutes after stuck time
    const stuckAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    render(<StuckAgentIndicator stuckAt={stuckAt} />);

    expect(screen.getByTestId('stuck-agent-indicator')).toBeInTheDocument();
    expect(screen.getByText('Stuck for 45m')).toBeInTheDocument();
  });

  it('shows yellow color for 30-60min duration', () => {
    const stuckAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    render(<StuckAgentIndicator stuckAt={stuckAt} />);

    const indicator = screen.getByTestId('stuck-agent-indicator');
    // Check for yellow background class
    expect(indicator.className).toContain('bg-[#FCD535]/10');
  });

  it('shows red color for >60min duration', () => {
    const stuckAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();

    render(<StuckAgentIndicator stuckAt={stuckAt} />);

    const indicator = screen.getByTestId('stuck-agent-indicator');
    // Check for red background class
    expect(indicator.className).toContain('bg-[#F6465D]/10');
  });

  it('formats duration with hours when >60min', () => {
    const stuckAt = new Date(Date.now() - 90 * 60 * 1000).toISOString();

    render(<StuckAgentIndicator stuckAt={stuckAt} />);

    expect(screen.getByText('Stuck for 1h 30m')).toBeInTheDocument();
  });

  it('formats duration without hours when <60min', () => {
    const stuckAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    render(<StuckAgentIndicator stuckAt={stuckAt} />);

    expect(screen.getByText('Stuck for 30m')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const stuckAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    render(<StuckAgentIndicator stuckAt={stuckAt} className="my-custom-class" />);

    const indicator = screen.getByTestId('stuck-agent-indicator');
    expect(indicator.className).toContain('my-custom-class');
  });

  it('auto-updates duration every minute', async () => {
    // Start with 45 minutes stuck
    const now = Date.now();
    vi.setSystemTime(now);
    const stuckAt = new Date(now - 45 * 60 * 1000).toISOString();

    render(<StuckAgentIndicator stuckAt={stuckAt} />);

    // Initially shows 45m
    expect(screen.getByText('Stuck for 45m')).toBeInTheDocument();

    // Advance time by 1 minute and trigger re-render
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });

    // Now should show 46m
    expect(screen.getByText('Stuck for 46m')).toBeInTheDocument();
  });
});
