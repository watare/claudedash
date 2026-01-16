/**
 * Auth module exports
 */

// JWT token management
export {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  getRefreshTokenExpiry,
} from './jwt.js';

// Session management
export {
  createSession,
  getSessionByRefreshToken,
  deleteSession,
  deleteUserSessions,
  deleteExpiredSessions,
} from './session.js';

// GitHub OAuth
export {
  getAuthorizationUrl,
  exchangeCodeForToken,
  getGitHubUser,
  generateState,
} from './github.js';

// Password authentication
export {
  hashPassword,
  verifyPassword,
  getUserByEmail,
} from './password.js';

// Password login
export {
  authenticatePassword,
  isValidEmail,
} from './login.js';

// Rate limiting
export {
  checkRateLimit,
  resetRateLimiter,
  rateLimitMiddleware,
  WINDOW_MS,
  MAX_ATTEMPTS,
} from './rate-limiter.js';

// Audit logging
export {
  logLoginSuccess,
  logLoginFailed,
  logRateLimited,
  logAuthEvent,
  getAuditLogs,
} from './audit.js';

// Auth routes
export { default as authRoutes } from './routes.js';

// Auth middleware
export { requireAuth, optionalAuth } from './middleware.js';
