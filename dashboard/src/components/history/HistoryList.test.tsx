/**
 * Tests for HistoryList Component
 * Story 4.7: Execution History View - AC1, AC4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryList } from './HistoryList';
import { useHistoryStore } from '@/stores/historyStore';
import type { ExecutionRun } from '@/types/history';

// Mock the store
vi.mock('@/stores/historyStore');

describe('HistoryList', () => {
  const mockSelectRun = vi.fn();
  const mockSetPage = vi.fn();

  const mockRuns: ExecutionRun[] = [
    {
      id: 1,
      project: 'test-project-1',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: 'completed',
      storiesCompleted: 5,
      storiesFailed: 0,
      storiesTotal: 5,
      duration: '5m 30s',
      durationMs: 330000,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      project: 'test-project-2',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: 'failed',
      storiesCompleted: 3,
      storiesFailed: 2,
      storiesTotal: 5,
      duration: '10m',
      durationMs: 600000,
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display loading skeleton when isLoading is true', () => {
    vi.mocked(useHistoryStore).mockReturnValue({
      runs: [],
      pagination: { total: 0, page: 1, limit: 20, pages: 0 },
      isLoading: true,
      selectRun: mockSelectRun,
      setPage: mockSetPage,
    } as ReturnType<typeof useHistoryStore>);

    render(<HistoryList />);

    // Should show skeletons (check for skeleton container class)
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display empty state when no runs exist', () => {
    vi.mocked(useHistoryStore).mockReturnValue({
      runs: [],
      pagination: { total: 0, page: 1, limit: 20, pages: 0 },
      isLoading: false,
      selectRun: mockSelectRun,
      setPage: mockSetPage,
    } as ReturnType<typeof useHistoryStore>);

    render(<HistoryList />);

    expect(screen.getByText('No execution history found')).toBeInTheDocument();
    expect(
      screen.getByText('Run an orchestration to see history here')
    ).toBeInTheDocument();
  });

  it('should display list of runs', () => {
    vi.mocked(useHistoryStore).mockReturnValue({
      runs: mockRuns,
      pagination: { total: 2, page: 1, limit: 20, pages: 1 },
      isLoading: false,
      selectRun: mockSelectRun,
      setPage: mockSetPage,
    } as ReturnType<typeof useHistoryStore>);

    render(<HistoryList />);

    expect(screen.getByText('test-project-1')).toBeInTheDocument();
    expect(screen.getByText('test-project-2')).toBeInTheDocument();
    expect(screen.getByText('5 completed')).toBeInTheDocument();
    expect(screen.getByText('2 failed')).toBeInTheDocument();
  });

  it('should call selectRun when a run is clicked', () => {
    vi.mocked(useHistoryStore).mockReturnValue({
      runs: mockRuns,
      pagination: { total: 2, page: 1, limit: 20, pages: 1 },
      isLoading: false,
      selectRun: mockSelectRun,
      setPage: mockSetPage,
    } as ReturnType<typeof useHistoryStore>);

    render(<HistoryList />);

    fireEvent.click(screen.getByText('test-project-1'));

    expect(mockSelectRun).toHaveBeenCalledWith(1);
  });

  it('should display pagination when multiple pages exist', () => {
    vi.mocked(useHistoryStore).mockReturnValue({
      runs: mockRuns,
      pagination: { total: 50, page: 1, limit: 20, pages: 3 },
      isLoading: false,
      selectRun: mockSelectRun,
      setPage: mockSetPage,
    } as ReturnType<typeof useHistoryStore>);

    render(<HistoryList />);

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('should call setPage when Next is clicked', () => {
    vi.mocked(useHistoryStore).mockReturnValue({
      runs: mockRuns,
      pagination: { total: 50, page: 1, limit: 20, pages: 3 },
      isLoading: false,
      selectRun: mockSelectRun,
      setPage: mockSetPage,
    } as ReturnType<typeof useHistoryStore>);

    render(<HistoryList />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(mockSetPage).toHaveBeenCalledWith(2);
  });

  it('should display status badges with correct colors', () => {
    vi.mocked(useHistoryStore).mockReturnValue({
      runs: mockRuns,
      pagination: { total: 2, page: 1, limit: 20, pages: 1 },
      isLoading: false,
      selectRun: mockSelectRun,
      setPage: mockSetPage,
    } as ReturnType<typeof useHistoryStore>);

    render(<HistoryList />);

    const completedBadge = screen.getByText('completed');
    const failedBadge = screen.getByText('failed');

    expect(completedBadge).toHaveClass('text-green-400');
    expect(failedBadge).toHaveClass('text-red-400');
  });
});
