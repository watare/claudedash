import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDot } from './StatusDot';
import type { ProjectStatus } from '@/types/project';

describe('StatusDot', () => {
  const statuses: ProjectStatus[] = ['running', 'waiting', 'failed', 'done', 'paused', 'idle'];

  it.each(statuses)('renders with correct aria-label for %s status', (status) => {
    render(<StatusDot status={status} />);
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', `Status: ${statusLabel}`);
  });

  it('applies running color class for running status', () => {
    render(<StatusDot status="running" />);
    expect(screen.getByRole('status')).toHaveClass('bg-[#0ECB81]');
  });

  it('applies waiting color class for waiting status', () => {
    render(<StatusDot status="waiting" />);
    expect(screen.getByRole('status')).toHaveClass('bg-[#FCD535]');
  });

  it('applies failed color class for failed status', () => {
    render(<StatusDot status="failed" />);
    expect(screen.getByRole('status')).toHaveClass('bg-[#F6465D]');
  });

  it('applies done color class for done status', () => {
    render(<StatusDot status="done" />);
    expect(screen.getByRole('status')).toHaveClass('bg-[#F0B90B]');
  });

  it('applies paused color class for paused status', () => {
    render(<StatusDot status="paused" />);
    expect(screen.getByRole('status')).toHaveClass('bg-[#5E6673]');
  });

  it('applies pulse animation for running status', () => {
    render(<StatusDot status="running" />);
    expect(screen.getByRole('status')).toHaveClass('animate-pulse');
  });

  it('does not apply pulse animation for non-running statuses', () => {
    render(<StatusDot status="waiting" />);
    expect(screen.getByRole('status')).not.toHaveClass('animate-pulse');
  });

  it('accepts custom className', () => {
    render(<StatusDot status="running" className="custom-class" />);
    expect(screen.getByRole('status')).toHaveClass('custom-class');
  });

  it('renders with base styling classes', () => {
    render(<StatusDot status="running" />);
    const dot = screen.getByRole('status');
    expect(dot).toHaveClass('inline-block', 'w-2', 'h-2', 'rounded-full');
  });
});
