/**
 * Tests for EventTimeline Component
 * Story 4.7: Execution History View - AC2
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventTimeline } from './EventTimeline';
import type { ExecutionEvent } from '@/types/history';

describe('EventTimeline', () => {
  const mockEvents: ExecutionEvent[] = [
    {
      id: 1,
      timestamp: '2026-01-17T10:00:00Z',
      type: 'agent:spawn',
      agentId: 'agent-1',
      storyId: '1-1',
      epicNumber: 1,
      details: { model: 'claude-3' },
    },
    {
      id: 2,
      timestamp: '2026-01-17T10:05:00Z',
      type: 'agent:complete',
      agentId: 'agent-1',
      storyId: '1-1',
      epicNumber: 1,
      details: { duration: 300000 },
    },
    {
      id: 3,
      timestamp: '2026-01-17T10:06:00Z',
      type: 'agent:error',
      agentId: 'agent-2',
      storyId: '1-2',
      epicNumber: 1,
      details: { error: 'Build failed' },
    },
  ];

  it('should display empty state when no events exist', () => {
    render(<EventTimeline events={[]} />);

    expect(
      screen.getByText('No events recorded for this run')
    ).toBeInTheDocument();
  });

  it('should display all events in the timeline', () => {
    render(<EventTimeline events={mockEvents} />);

    expect(screen.getByText('Agent Started')).toBeInTheDocument();
    expect(screen.getByText('Agent Completed')).toBeInTheDocument();
    expect(screen.getByText('Agent Error')).toBeInTheDocument();
  });

  it('should display story IDs for events', () => {
    render(<EventTimeline events={mockEvents} />);

    expect(screen.getAllByText('Story 1-1').length).toBe(2);
    expect(screen.getByText('Story 1-2')).toBeInTheDocument();
  });

  it('should display agent IDs for events', () => {
    render(<EventTimeline events={mockEvents} />);

    expect(screen.getAllByText('Agent agent-1').length).toBe(2);
    expect(screen.getByText('Agent agent-2')).toBeInTheDocument();
  });

  it('should expand event details when clicked', () => {
    render(<EventTimeline events={mockEvents} />);

    // Find and click the first event (agent:spawn with details)
    const firstEvent = screen.getByText('Agent Started').closest('div');
    fireEvent.click(firstEvent!);

    // Should show the JSON details
    expect(screen.getByText(/"model": "claude-3"/)).toBeInTheDocument();
  });

  it('should collapse event details when clicked again', () => {
    render(<EventTimeline events={mockEvents} />);

    const firstEvent = screen.getByText('Agent Started').closest('div');

    // Expand
    fireEvent.click(firstEvent!);
    expect(screen.getByText(/"model": "claude-3"/)).toBeInTheDocument();

    // Collapse
    fireEvent.click(firstEvent!);
    expect(screen.queryByText(/"model": "claude-3"/)).not.toBeInTheDocument();
  });

  it('should display event timestamps', () => {
    render(<EventTimeline events={mockEvents} />);

    // Check for time format (HH:MM:SS)
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('should apply correct border colors for event types', () => {
    render(<EventTimeline events={mockEvents} />);

    // Check that different event types have different border colors
    const containers = document.querySelectorAll('[class*="border-l-2"]');
    expect(containers.length).toBe(3);

    // Spawn should be blue
    expect(containers[0]).toHaveClass('border-blue-500');
    // Complete should be green
    expect(containers[1]).toHaveClass('border-green-500');
    // Error should be red
    expect(containers[2]).toHaveClass('border-red-500');
  });
});
