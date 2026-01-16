import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoryStatusBadge } from './StoryStatusBadge';

describe('StoryStatusBadge', () => {
  it('displays backlog status', () => {
    render(<StoryStatusBadge status="backlog" />);
    expect(screen.getByText('Backlog')).toBeInTheDocument();
  });

  it('displays ready-for-dev status', () => {
    render(<StoryStatusBadge status="ready-for-dev" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('displays in-progress status', () => {
    render(<StoryStatusBadge status="in-progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('displays review status', () => {
    render(<StoryStatusBadge status="review" />);
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('displays done status', () => {
    render(<StoryStatusBadge status="done" />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('has correct test id', () => {
    render(<StoryStatusBadge status="done" />);
    expect(screen.getByTestId('story-status-badge')).toBeInTheDocument();
  });

  it('applies correct color classes for in-progress', () => {
    render(<StoryStatusBadge status="in-progress" />);
    const badge = screen.getByTestId('story-status-badge');
    expect(badge).toHaveClass('bg-[#FCD535]/20');
    expect(badge).toHaveClass('text-[#FCD535]');
  });

  it('applies correct color classes for done', () => {
    render(<StoryStatusBadge status="done" />);
    const badge = screen.getByTestId('story-status-badge');
    expect(badge).toHaveClass('bg-[#0ECB81]/20');
    expect(badge).toHaveClass('text-[#0ECB81]');
  });

  // Story 4.4: New status types
  it('displays failed status with red styling', () => {
    render(<StoryStatusBadge status="failed" />);
    const badge = screen.getByTestId('story-status-badge');
    expect(badge).toHaveTextContent('Failed');
    expect(badge).toHaveClass('bg-[#F6465D]/20');
    expect(badge).toHaveClass('text-[#F6465D]');
  });

  it('displays killed status with red styling', () => {
    render(<StoryStatusBadge status="killed" />);
    const badge = screen.getByTestId('story-status-badge');
    expect(badge).toHaveTextContent('Killed');
    expect(badge).toHaveClass('bg-[#F6465D]/20');
    expect(badge).toHaveClass('text-[#F6465D]');
  });

  it('displays pending status with gray styling and animation', () => {
    render(<StoryStatusBadge status="pending" />);
    const badge = screen.getByTestId('story-status-badge');
    expect(badge).toHaveTextContent('Pending');
    expect(badge).toHaveClass('bg-[#848E9C]/20');
    expect(badge).toHaveClass('text-[#848E9C]');
    expect(badge).toHaveClass('animate-pulse');
  });

  it('displays in-progress status with animation', () => {
    render(<StoryStatusBadge status="in-progress" />);
    const badge = screen.getByTestId('story-status-badge');
    expect(badge).toHaveClass('animate-pulse');
  });
});
