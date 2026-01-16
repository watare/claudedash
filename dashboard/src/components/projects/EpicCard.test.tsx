import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EpicCard } from './EpicCard';
import type { Epic } from '@/types/project';

const mockEpic: Epic = {
  number: 1,
  title: 'Test Epic',
  status: 'in-progress',
  stories: [
    { id: '1-1', title: 'Story 1', status: 'done' },
    { id: '1-2', title: 'Story 2', status: 'in-progress' },
    { id: '1-3', title: 'Story 3', status: 'backlog' },
  ],
};

const doneEpic: Epic = {
  number: 2,
  title: 'Done Epic',
  status: 'done',
  stories: [
    { id: '2-1', title: 'Story 1', status: 'done' },
    { id: '2-2', title: 'Story 2', status: 'done' },
  ],
};

describe('EpicCard', () => {
  it('shows story count', () => {
    render(<EpicCard epic={mockEpic} />);
    expect(screen.getByTestId('epic-story-count')).toHaveTextContent('1/3 stories complete');
  });

  it('displays epic title with number', () => {
    render(<EpicCard epic={mockEpic} />);
    expect(screen.getByTestId('epic-title')).toHaveTextContent('Epic 1: Test Epic');
  });

  it('expands to show stories on click', () => {
    render(<EpicCard epic={mockEpic} />);
    expect(screen.queryByTestId('epic-stories')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('epic-toggle'));

    expect(screen.getByTestId('epic-stories')).toBeInTheDocument();
    expect(screen.getByText('1-1 Story 1')).toBeInTheDocument();
  });

  it('collapses on second click', () => {
    render(<EpicCard epic={mockEpic} />);

    fireEvent.click(screen.getByTestId('epic-toggle'));
    expect(screen.getByTestId('epic-stories')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('epic-toggle'));
    expect(screen.queryByTestId('epic-stories')).not.toBeInTheDocument();
  });

  it('highlights current story', () => {
    render(<EpicCard epic={mockEpic} currentStoryId="1-2" defaultExpanded />);
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  it('shows check mark for done epic', () => {
    render(<EpicCard epic={doneEpic} />);
    expect(screen.getByTestId('epic-done-check')).toBeInTheDocument();
  });

  it('does not show check mark for in-progress epic', () => {
    render(<EpicCard epic={mockEpic} />);
    expect(screen.queryByTestId('epic-done-check')).not.toBeInTheDocument();
  });

  it('displays status badge', () => {
    render(<EpicCard epic={mockEpic} />);
    expect(screen.getByTestId('epic-status-badge')).toHaveTextContent('In Progress');
  });

  it('displays done status badge', () => {
    render(<EpicCard epic={doneEpic} />);
    expect(screen.getByTestId('epic-status-badge')).toHaveTextContent('Done');
  });

  it('starts expanded when defaultExpanded is true', () => {
    render(<EpicCard epic={mockEpic} defaultExpanded />);
    expect(screen.getByTestId('epic-stories')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<EpicCard epic={mockEpic} />);
    const toggle = screen.getByTestId('epic-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('calculates progress percentage correctly', () => {
    render(<EpicCard epic={mockEpic} />);
    // 1/3 = 33%
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('shows 100% for done epic', () => {
    render(<EpicCard epic={doneEpic} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('highlights border when containing current story', () => {
    const { container } = render(<EpicCard epic={mockEpic} currentStoryId="1-2" />);
    const epicCard = container.querySelector('[data-testid="epic-card"]');
    expect(epicCard).toHaveClass('border-[#F0B90B]');
  });
});
