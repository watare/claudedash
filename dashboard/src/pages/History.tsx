/**
 * History Page
 * Story 4.7: Execution History View
 *
 * Page for viewing execution history and reports.
 */

import { useEffect } from 'react';
import { useHistoryStore } from '@/stores/historyStore';
import { HistoryFilters } from '@/components/history/HistoryFilters';
import { HistoryList } from '@/components/history/HistoryList';
import { RunDetailPanel } from '@/components/history/RunDetailPanel';

export function History() {
  const { fetchRuns, error, clearError, selectedRun } = useHistoryStore();

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#2B3139]">
          <h1 className="text-xl font-semibold text-[#EAECEF]">
            Execution History
          </h1>
          <p className="text-sm text-[#848E9C] mt-1">
            View past orchestration runs and their details
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-[#F6465D] hover:text-[#F6465D]/80"
            >
              &times;
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="p-4">
          <HistoryFilters />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <HistoryList />
        </div>
      </div>

      {/* Detail panel */}
      {selectedRun && <RunDetailPanel />}
    </div>
  );
}
