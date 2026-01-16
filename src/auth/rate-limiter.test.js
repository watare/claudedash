/**
 * Tests for rate limiter module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkRateLimit, resetRateLimiter, WINDOW_MS, MAX_ATTEMPTS } from './rate-limiter.js';

describe('rate limiter', () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow first attempt from an IP', () => {
    const result = checkRateLimit('192.168.1.1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(MAX_ATTEMPTS - 1);
  });

  it('should track multiple attempts from same IP', () => {
    const ip = '192.168.1.1';

    checkRateLimit(ip);
    checkRateLimit(ip);
    const result = checkRateLimit(ip);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(MAX_ATTEMPTS - 3);
  });

  it('should block after MAX_ATTEMPTS exceeded', () => {
    const ip = '192.168.1.1';

    // Use up all attempts
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const r = checkRateLimit(ip);
      expect(r.allowed).toBe(true);
    }

    // Next attempt should be blocked
    const blocked = checkRateLimit(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('should track different IPs independently', () => {
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';

    // Exhaust ip1
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkRateLimit(ip1);
    }

    // ip2 should still be allowed
    const result = checkRateLimit(ip2);
    expect(result.allowed).toBe(true);
  });

  it('should reset after window expires', () => {
    const ip = '192.168.1.1';

    // Use up all attempts
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkRateLimit(ip);
    }

    // Should be blocked
    expect(checkRateLimit(ip).allowed).toBe(false);

    // Advance time past window
    vi.advanceTimersByTime(WINDOW_MS + 1000);

    // Should be allowed again
    const result = checkRateLimit(ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(MAX_ATTEMPTS - 1);
  });

  it('should return correct retryAfter value', () => {
    const ip = '192.168.1.1';

    // Exhaust attempts
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkRateLimit(ip);
    }

    // Check blocked response
    const blocked = checkRateLimit(ip);
    expect(blocked.allowed).toBe(false);
    // retryAfter should be approximately WINDOW_MS in seconds
    expect(blocked.retryAfter).toBeLessThanOrEqual(WINDOW_MS / 1000);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('should have constants configured for 5 attempts per 15 minutes', () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(WINDOW_MS).toBe(15 * 60 * 1000); // 15 minutes in ms
  });
});
