import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoryList } from './StoryList';
import type { Story } from '@/types/project';

const mockStories: Story[] = [
  { id: '1-1', title: 'First Story', status: 'done' },
  { id: '1-2', title: 'Second Story', status: 'in-progress' },
  { id: '1-3', title: 'Third Story', status: 'backlog' },
];

describe('StoryList', () => {
  it('renders all stories', () => {
    render(<StoryList stories={mockStories} />);
    expect(screen.getByTestId('story-list')).toBeInTheDocument();
    expect(screen.getByText('1-1 First Story')).toBeInTheDocument();
    expect(screen.getByText('1-2 Second Story')).toBeInTheDocument();
    expect(screen.getByText('1-3 Third Story')).toBeInTheDocument();
  });

  it('shows empty message when no stories', () => {
    render(<StoryList stories={[]} />);
    expect(screen.getByTestId('story-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No stories in this epic')).toBeInTheDocument();
  });

  it('highlights current story with star', () => {
    render(<StoryList stories={mockStories} currentStoryId="1-2" />);
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  it('does not highlight non-current stories', () => {
    render(<StoryList stories={mockStories} currentStoryId="1-2" />);
    const stars = screen.queryAllByText('★');
    expect(stars).toHaveLength(1);
  });

  it('displays status badges for each story', () => {
    render(<StoryList stories={mockStories} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
  });

  it('opens story detail when clicked', () => {
    render(<StoryList stories={mockStories} />);
    fireEvent.click(screen.getByTestId('story-item-1-1'));
    expect(screen.getByTestId('story-detail')).toBeInTheDocument();
  });

  it('closes story detail when close button clicked', () => {
    render(<StoryList stories={mockStories} />);
    fireEvent.click(screen.getByTestId('story-item-1-1'));
    expect(screen.getByTestId('story-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('story-detail-close'));
    expect(screen.queryByTestId('story-detail')).not.toBeInTheDocument();
  });

  it('applies highlight background to current story', () => {
    render(<StoryList stories={mockStories} currentStoryId="1-2" />);
    const currentStoryButton = screen.getByTestId('story-item-1-2');
    expect(currentStoryButton).toHaveClass('bg-[#F0B90B]/10');
  });

  it('has individual test ids for each story', () => {
    render(<StoryList stories={mockStories} />);
    expect(screen.getByTestId('story-item-1-1')).toBeInTheDocument();
    expect(screen.getByTestId('story-item-1-2')).toBeInTheDocument();
    expect(screen.getByTestId('story-item-1-3')).toBeInTheDocument();
  });
});
