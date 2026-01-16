import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EpicList } from './EpicList';
import type { Epic } from '@/types/project';

const mockEpics: Epic[] = [
  {
    number: 1,
    title: 'Foundation',
    status: 'done',
    stories: [
      { id: '1-1', title: 'Setup', status: 'done' },
      { id: '1-2', title: 'Config', status: 'done' },
    ],
  },
  {
    number: 2,
    title: 'Features',
    status: 'in-progress',
    stories: [
      { id: '2-1', title: 'First Feature', status: 'in-progress' },
      { id: '2-2', title: 'Second Feature', status: 'backlog' },
    ],
  },
  {
    number: 3,
    title: 'Future',
    status: 'backlog',
    stories: [
      { id: '3-1', title: 'Future Feature', status: 'backlog' },
    ],
  },
];

describe('EpicList', () => {
  it('renders all epics', () => {
    render(<EpicList epics={mockEpics} />);
    expect(screen.getByTestId('epic-list')).toBeInTheDocument();
    expect(screen.getByText('Epic 1: Foundation')).toBeInTheDocument();
    expect(screen.getByText('Epic 2: Features')).toBeInTheDocument();
    expect(screen.getByText('Epic 3: Future')).toBeInTheDocument();
  });

  it('shows empty message when no epics', () => {
    render(<EpicList epics={[]} />);
    expect(screen.getByTestId('epic-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No epics available')).toBeInTheDocument();
  });

  it('passes currentStoryId to EpicCard components', () => {
    render(<EpicList epics={mockEpics} currentStoryId="2-1" />);
    // The epic containing the current story should be auto-expanded
    // We can verify by checking if stories are visible
    expect(screen.getByText('2-1 First Feature')).toBeInTheDocument();
  });

  it('displays story counts for each epic', () => {
    render(<EpicList epics={mockEpics} />);
    expect(screen.getByText('2/2 stories complete')).toBeInTheDocument(); // Epic 1
    expect(screen.getByText('0/2 stories complete')).toBeInTheDocument(); // Epic 2
    expect(screen.getByText('0/1 stories complete')).toBeInTheDocument(); // Epic 3
  });
});
