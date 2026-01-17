/**
 * History Zustand Store
 * Story 4.7: Execution History View
 *
 * Manages execution history state and API interactions.
 */

import { create } from 'zustand';
import { fetchHistory, fetchRunDetail } from '../services/api';
import type {
  ExecutionRun,
  ExecutionRunWithEvents,
  HistoryFilters,
  PaginationMeta,
} from '../types/history';

interface HistoryState {
  // Data
  runs: ExecutionRun[];
  selectedRun: ExecutionRunWithEvents | null;

  // Filters
  filters: HistoryFilters;

  // Pagination
  pagination: PaginationMeta;

  // Loading states
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;

  // Actions
  fetchRuns: () => Promise<void>;
  fetchRunDetail: (runId: number) => Promise<void>;
  setFilters: (filters: Partial<HistoryFilters>) => void;
  setPage: (page: number) => void;
  selectRun: (runId: number) => void;
  clearSelectedRun: () => void;
  clearError: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  runs: [],
  selectedRun: null,
  filters: {
    project: null,
    status: null,
    startDate: null,
    endDate: null,
  },
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  },
  isLoading: false,
  isLoadingDetail: false,
  error: null,

  fetchRuns: async () => {
    const { filters, pagination } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await fetchHistory({
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      });

      set({
        runs: response.data,
        pagination: {
          total: response.meta.total,
          page: response.meta.page,
          limit: response.meta.limit,
          pages: response.meta.pages,
        },
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch history',
        isLoading: false,
      });
    }
  },

  fetchRunDetail: async (runId: number) => {
    set({ isLoadingDetail: true, error: null });

    try {
      const response = await fetchRunDetail(runId);
      set({
        selectedRun: response.data,
        isLoadingDetail: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch run details',
        isLoadingDetail: false,
      });
    }
  },

  setFilters: (newFilters: Partial<HistoryFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      pagination: { ...state.pagination, page: 1 }, // Reset to page 1 on filter change
    }));
    // Fetch with new filters
    get().fetchRuns();
  },

  setPage: (page: number) => {
    set((state) => ({
      pagination: { ...state.pagination, page },
    }));
    get().fetchRuns();
  },

  selectRun: (runId: number) => {
    get().fetchRunDetail(runId);
  },

  clearSelectedRun: () => {
    set({ selectedRun: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
