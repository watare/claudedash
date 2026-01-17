/**
 * HistoryFilters Component
 * Story 4.7: Execution History View - AC3
 *
 * Filter controls for execution history.
 */

import { useHistoryStore } from '@/stores/historyStore';
import type { ExecutionStatus } from '@/types/history';

const statusOptions: { value: ExecutionStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'stopped', label: 'Stopped' },
];

export function HistoryFilters() {
  const { filters, setFilters } = useHistoryStore();

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ExecutionStatus | '';
    setFilters({ status: value || null });
  };

  const handleDateChange = (
    field: 'startDate' | 'endDate',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFilters({ [field]: e.target.value || null });
  };

  const handleClearFilters = () => {
    setFilters({
      project: null,
      status: null,
      startDate: null,
      endDate: null,
    });
  };

  const hasActiveFilters =
    filters.project || filters.status || filters.startDate || filters.endDate;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-[#1E2329] rounded-lg border border-[#2B3139]">
      {/* Status filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#848E9C]">Status</label>
        <select
          value={filters.status || ''}
          onChange={handleStatusChange}
          className="bg-[#0B0E11] text-[#EAECEF] border border-[#2B3139] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Start date filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#848E9C]">From Date</label>
        <input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => handleDateChange('startDate', e)}
          className="bg-[#0B0E11] text-[#EAECEF] border border-[#2B3139] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* End date filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#848E9C]">To Date</label>
        <input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => handleDateChange('endDate', e)}
          className="bg-[#0B0E11] text-[#EAECEF] border border-[#2B3139] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className="mt-auto px-3 py-1.5 text-sm text-[#848E9C] hover:text-[#EAECEF] transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
