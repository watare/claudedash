import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StoryList } from './StoryList';
import { useStoriesStore } from '@/stores/storiesStore';
import { useUIStore } from '@/stores/uiStore';
import type { Story } from '@/types/project';

// Mock the stores
vi.mock('@/stores/storiesStore');
vi.mock('@/stores/uiStore');

const mockStories: Story[] = [
  { id: '1-1', title: 'First Story', status: 'done' },
  { id: '1-2', title: 'Second Story', status: 'in-progress' },
  { id: '1-3', title: 'Third Story', status: 'backlog' },
];

const mockStoriesWithFailed: Story[] = [
  { id: '1-1', title: 'First Story', status: 'done' },
  { id: '1-2', title: 'Failed Story', status: 'failed' },
  { id: '1-3', title: 'Killed Story', status: 'killed' },
];

const mockRetryStory = vi.fn();
const mockAddToast = vi.fn();

describe('StoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(useStoriesStore).mockReturnValue({
      retryStory: mockRetryStory,
      retryingStoryId: null,
    } as unknown as ReturnType<typeof useStoriesStore>);

    vi.mocked(useUIStore).mockReturnValue({
      addToast: mockAddToast,
    } as unknown as ReturnType<typeof useUIStore>);
  });

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

  // Story 4.4: Retry button tests
  describe('retry button', () => {
    it('shows retry button for failed stories', () => {
      render(<StoryList stories={mockStoriesWithFailed} />);

      // Should show retry buttons for failed and killed stories
      const retryButtons = screen.getAllByTestId('retry-button');
      expect(retryButtons).toHaveLength(2);
    });

    it('does not show retry button for non-failed stories', () => {
      render(<StoryList stories={mockStories} />);

      // No retry buttons for done, in-progress, or backlog stories
      const retryButtons = screen.queryAllByTestId('retry-button');
      expect(retryButtons).toHaveLength(0);
    });

    it('calls retryStory when retry button clicked', async () => {
      mockRetryStory.mockResolvedValueOnce({ success: true });

      render(<StoryList stories={mockStoriesWithFailed} />);

      const retryButtons = screen.getAllByTestId('retry-button');
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockRetryStory).toHaveBeenCalledWith('1-2');
      });
    });

    it('shows success toast on successful retry', async () => {
      mockRetryStory.mockResolvedValueOnce({ success: true });

      render(<StoryList stories={mockStoriesWithFailed} />);

      const retryButtons = screen.getAllByTestId('retry-button');
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            message: 'Retrying Story 1-2',
          })
        );
      });
    });

    it('shows warning toast when retry has warning', async () => {
      mockRetryStory.mockResolvedValueOnce({
        success: true,
        warning: 'Max retries exceeded',
      });

      render(<StoryList stories={mockStoriesWithFailed} />);

      const retryButtons = screen.getAllByTestId('retry-button');
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'warning',
            message: 'Max retries exceeded',
          })
        );
      });
    });

    it('shows error toast on failed retry', async () => {
      mockRetryStory.mockResolvedValueOnce({ success: false });

      // Mock store error state
      vi.mocked(useStoriesStore).mockReturnValue({
        retryStory: mockRetryStory,
        retryingStoryId: null,
        error: 'Story already in progress',
      } as unknown as ReturnType<typeof useStoriesStore>);

      // Need to use a modified implementation that returns error
      vi.mocked(useStoriesStore.getState).mockReturnValue({
        error: 'Story already in progress',
      } as unknown as ReturnType<typeof useStoriesStore.getState>);

      render(<StoryList stories={mockStoriesWithFailed} />);

      const retryButtons = screen.getAllByTestId('retry-button');
      fireEvent.click(retryButtons[0]);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
          })
        );
      });
    });

    it('shows loading state while retrying', () => {
      vi.mocked(useStoriesStore).mockReturnValue({
        retryStory: mockRetryStory,
        retryingStoryId: '1-2',
      } as unknown as ReturnType<typeof useStoriesStore>);

      render(<StoryList stories={mockStoriesWithFailed} />);

      const retryButtons = screen.getAllByTestId('retry-button');
      // The first button (for story 1-2) should show retrying state
      expect(retryButtons[0]).toHaveTextContent('Retrying...');
      expect(retryButtons[0]).toBeDisabled();
    });

    it('prevents opening story detail when clicking retry', async () => {
      mockRetryStory.mockResolvedValueOnce({ success: true });

      render(<StoryList stories={mockStoriesWithFailed} />);

      const retryButtons = screen.getAllByTestId('retry-button');
      fireEvent.click(retryButtons[0]);

      // Story detail should not be opened
      expect(screen.queryByTestId('story-detail')).not.toBeInTheDocument();
    });
  });
});
