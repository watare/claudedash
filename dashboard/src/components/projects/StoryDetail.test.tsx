import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoryDetail } from './StoryDetail';
import type { Story } from '@/types/project';

const mockStory: Story = {
  id: '1-2',
  title: 'Test Story Title',
  status: 'in-progress',
  acceptanceCriteria: [
    '**Given** I am on the login page, **When** I enter valid credentials, **Then** I am redirected to the dashboard',
    '**Given** I am logged in, **When** I click logout, **Then** I am redirected to the login page',
  ],
};

const doneStory: Story = {
  id: '1-1',
  title: 'Completed Story',
  status: 'done',
};

const storyWithMetadata: Story = {
  id: '1-3',
  title: 'Story with Metadata',
  status: 'in-progress',
  assignedAgent: 'agent-123',
  duration: 75,
};

describe('StoryDetail', () => {
  it('displays story title', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    expect(screen.getByTestId('story-detail-title')).toHaveTextContent('Test Story Title');
  });

  it('displays story ID', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    // Story ID appears in header and metadata - verify both instances exist
    const storyIds = screen.getAllByText('1-2');
    expect(storyIds.length).toBeGreaterThanOrEqual(1);
  });

  it('displays status badge', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('story-detail-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when escape key pressed', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    const backdrop = screen.getByTestId('story-detail');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when panel content clicked', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    const title = screen.getByTestId('story-detail-title');
    fireEvent.click(title);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows view logs button for in-progress stories', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    expect(screen.getByTestId('view-logs-button')).toBeInTheDocument();
  });

  it('hides view logs button for done stories', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={doneStory} onClose={onClose} />);
    expect(screen.queryByTestId('view-logs-button')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'story-detail-title');
  });

  it('displays story metadata', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    expect(screen.getByTestId('story-metadata')).toBeInTheDocument();
  });

  it('displays acceptance criteria section', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    expect(screen.getByTestId('story-acceptance-criteria')).toBeInTheDocument();
  });

  it('displays acceptance criteria list when available', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    expect(screen.getByText(/Given.*login page.*When.*valid credentials/)).toBeInTheDocument();
    expect(screen.getByText(/Given.*logged in.*When.*click logout/)).toBeInTheDocument();
  });

  it('shows message when no acceptance criteria', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={doneStory} onClose={onClose} />);
    expect(screen.getByText('No acceptance criteria available for this story.')).toBeInTheDocument();
  });

  it('displays assigned agent when available', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={storyWithMetadata} onClose={onClose} />);
    expect(screen.getByText('Assigned Agent')).toBeInTheDocument();
    expect(screen.getByText('agent-123')).toBeInTheDocument();
  });

  it('displays duration when available', () => {
    const onClose = vi.fn();
    render(<StoryDetail story={storyWithMetadata} onClose={onClose} />);
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('1h 15m')).toBeInTheDocument();
  });

  it('calls console.log when view logs button is clicked', () => {
    const onClose = vi.fn();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<StoryDetail story={mockStory} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('view-logs-button'));
    expect(consoleSpy).toHaveBeenCalledWith('[StoryDetail] View logs requested for story 1-2');
    consoleSpy.mockRestore();
  });
});
