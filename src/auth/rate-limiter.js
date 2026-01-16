/**
 * In-memory rate limiter for login attempts
 * Limits: 5 attempts per 15 minutes per IP
 */

export const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_ATTEMPTS = 5;

// In-memory storage: IP -> { count, resetAt }
const attempts = new Map();

/**
 * Check if a request from an IP is allowed
 * @param {string} ip - IP address to check
 * @returns {{ allowed: boolean, remaining?: number, retryAfter?: number }}
 */
export function checkRateLimit(ip) {
  const now = Date.now();
  const record = attempts.get(ip);

  // If no record or window expired, reset
  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  // If under limit, increment and allow
  if (record.count < MAX_ATTEMPTS) {
    record.count++;
    return { allowed: true, remaining: MAX_ATTEMPTS - record.count };
  }

  // Over limit - blocked
  const retryAfter = Math.ceil((record.resetAt - now) / 1000);
  return { allowed: false, retryAfter };
}

/**
 * Reset the rate limiter (for testing)
 */
export function resetRateLimiter() {
  attempts.clear();
}

/**
 * Clean up expired rate limit entries to prevent memory leaks
 * Removes entries where the window has expired
 * @returns {number} Number of entries cleaned up
 */
export function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;
  for (const [ip, record] of attempts) {
    if (now > record.resetAt) {
      attempts.delete(ip);
      cleaned++;
    }
  }
  return cleaned;
}

// Start periodic cleanup (every 5 minutes)
let cleanupInterval = null;

/**
 * Start the periodic cleanup interval
 */
export function startCleanupInterval() {
  if (cleanupInterval) return; // Already running
  cleanupInterval = setInterval(() => {
    cleanupExpiredEntries();
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Stop the periodic cleanup interval (for testing)
 */
export function stopCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start cleanup on module load (non-test environment)
if (process.env.NODE_ENV !== 'test') {
  startCleanupInterval();
}

/**
 * Express middleware for rate limiting login attempts
 * @returns {import('express').RequestHandler}
 */
export function rateLimitMiddleware() {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const result = checkRateLimit(ip);

    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfter));
      return res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
        code: 'RATE_LIMITED',
        retryAfter: result.retryAfter,
      });
    }

    // Attach rate limit info to request for potential use
    req.rateLimit = result;
    next();
  };
}
