/**
 * Utility functions for formatting values
 */

/**
 * Format duration in seconds to human-readable string
 * @param seconds Duration in seconds
 * @returns Formatted string like "5m" or "1h 23m"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Format relative time from ISO timestamp
 * @param timestamp ISO 8601 timestamp
 * @returns Formatted string like "5m ago" or "just now"
 */
export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = Math.floor((now - time) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
