import { describe, it, expect } from 'vitest';
import { formatDuration, formatRelativeTime } from './formatters';

describe('formatDuration', () => {
  it('formats 0 seconds as 0m', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats negative seconds as 0m', () => {
    expect(formatDuration(-10)).toBe('0m');
    expect(formatDuration(-100)).toBe('0m');
  });

  it('formats seconds under 60 as 0m', () => {
    expect(formatDuration(1)).toBe('0m');
    expect(formatDuration(30)).toBe('0m');
    expect(formatDuration(59)).toBe('0m');
  });

  it('formats exactly 60 seconds as 1m', () => {
    expect(formatDuration(60)).toBe('1m');
  });

  it('formats minutes correctly', () => {
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(300)).toBe('5m');
    expect(formatDuration(600)).toBe('10m');
    expect(formatDuration(2700)).toBe('45m');
  });

  it('formats exactly 1 hour as 1h 0m', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });

  it('formats hours and minutes correctly', () => {
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(7200)).toBe('2h 0m');
    expect(formatDuration(7380)).toBe('2h 3m');
  });

  it('handles large durations', () => {
    expect(formatDuration(36000)).toBe('10h 0m');
    expect(formatDuration(90000)).toBe('25h 0m');
  });
});

describe('formatRelativeTime', () => {
  it('formats time less than 60 seconds ago as "just now"', () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
  });

  it('formats time in minutes', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('formats time in hours', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('formats time in days', () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });
});
