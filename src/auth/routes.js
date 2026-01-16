/**
 * Auth routes - Express router for authentication endpoints
 */

import { Router } from 'express';
import {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  getRefreshTokenExpiry,
} from './jwt.js';
import {
  createSession,
  getSessionByRefreshToken,
  deleteSession,
} from './session.js';
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  getGitHubUser,
  generateState,
} from './github.js';
import { isUserAllowed } from '../config/secrets.js';
import { logAuthEvent, logLoginSuccess, logLoginFailed, logRateLimited } from './audit.js';
import { authenticatePassword, isValidEmail } from './login.js';
import { checkRateLimit, MAX_ATTEMPTS, WINDOW_MS } from './rate-limiter.js';

const router = Router();

/**
 * Wrap async route handlers to properly catch and forward errors
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped handler that catches errors
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Note: cookie-parser middleware is added globally in server.js

// Cookie configuration for refresh token (7 days)
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Cookie configuration for access token (15 minutes, accessible from all paths)
const ACCESS_REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 minutes
};

/**
 * POST /auth/refresh
 * Refresh access token using refresh token from HTTP-only cookie
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  // Rate limiting to prevent refresh token brute-force
  const clientIp = req.ip || req.socket.remoteAddress;
  const rateResult = checkRateLimit(clientIp);
  if (!rateResult.allowed) {
    res.set('Retry-After', String(rateResult.retryAfter));
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: rateResult.retryAfter,
    });
  }

  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      error: 'No refresh token',
      code: 'NO_REFRESH_TOKEN',
    });
  }

  try {
    // Verify JWT
    const payload = verifyToken(refreshToken);
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Lookup session in DB
    const session = getSessionByRefreshToken(refreshToken);
    if (!session || new Date(session.expires_at) < new Date()) {
      throw new Error('Session expired');
    }

    // Create new access token
    const accessToken = createAccessToken({
      userId: payload.userId,
      username: payload.username,
    });

    return res.json({
      data: { accessToken },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    // Clear invalid cookie
    res.clearCookie('refreshToken', { path: '/auth' });

    // Delete session from DB if exists
    if (refreshToken) {
      deleteSession(refreshToken);
    }

    return res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
  }
}));

/**
 * POST /auth/logout
 * Logout user - clear session and cookie
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    // Delete session from DB
    deleteSession(refreshToken);
  }

  // Clear cookies
  res.clearCookie('refreshToken', { path: '/auth' });
  res.clearCookie('accessToken', { path: '/' });

  return res.json({
    data: { message: 'Logged out successfully' },
    meta: { timestamp: new Date().toISOString() },
  });
}));

/**
 * POST /auth/login
 * Password-based login (uses login.js module)
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email address
 * @param {string} req.body.password - User password
 * @returns {Object} JSON response with accessToken and user info on success
 */
router.post('/login', asyncHandler(async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress;

  // Rate limiting (checkRateLimit increments count internally)
  const rateResult = checkRateLimit(clientIp);
  if (!rateResult.allowed) {
    logRateLimited({
      ip: clientIp,
      endpoint: '/auth/login',
      attempts: MAX_ATTEMPTS,
    });
    res.set('Retry-After', String(rateResult.retryAfter));
    return res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: rateResult.retryAfter,
    });
  }

  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required',
      code: 'MISSING_CREDENTIALS',
    });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: 'Invalid email format',
      code: 'INVALID_EMAIL',
    });
  }

  try {
    // Use login.js module for authentication
    const result = await authenticatePassword(email, password);

    if (!result.success) {
      logLoginFailed({ method: 'password', email, reason: 'invalid_credentials' });
      return res.status(401).json({
        error: result.error,
        code: result.code,
      });
    }

    // Set refresh token cookie
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    // Set access token cookie
    res.cookie('accessToken', result.accessToken, ACCESS_REFRESH_COOKIE_OPTIONS);

    // Log successful login
    logLoginSuccess({ method: 'password', email, userId: result.user.userId });

    return res.json({
      data: {
        accessToken: result.accessToken,
        user: {
          userId: result.user.userId,
          username: result.user.email,
          email: result.user.email,
        },
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    // Log error message only (not full stack/object) to avoid leaking internal state
    console.error('Login error:', error.message || 'Unknown error');
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}));

/**
 * GET /auth/github
 * Start GitHub OAuth flow
 */
router.get('/github', (req, res) => {
  const state = generateState();
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/github/callback`;

  // Store state in cookie for verification
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const authUrl = getAuthorizationUrl(state, redirectUri);
  res.redirect(authUrl);
});

/**
 * GET /auth/github/callback
 * Handle GitHub OAuth callback
 */
router.get('/github/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies.oauth_state;

  // Clear state cookie
  res.clearCookie('oauth_state');

  // Verify state
  if (!state || state !== storedState) {
    return res.redirect('/login?error=invalid_state');
  }

  if (!code) {
    return res.redirect('/login?error=no_code');
  }

  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/github/callback`;

    logAuthEvent('oauth_start', { provider: 'github' });

    // Exchange code for token
    const githubToken = await exchangeCodeForToken(code, redirectUri);

    // Get user info
    const githubUser = await getGitHubUser(githubToken);

    // Check if user is in allowed_users list (AC#3, AC#6)
    if (!isUserAllowed(githubUser.login)) {
      logAuthEvent('login_denied', {
        provider: 'github',
        username: githubUser.login,
        reason: 'User not in allowed_users list',
      });
      // AC#6: Show "Access denied: user not authorized"
      // AC#7: No session is created (we return before session creation)
      return res.redirect('/auth/error?error=' + encodeURIComponent('Access denied: user not authorized'));
    }

    // Create tokens (AC#3: JWT access token with 15min expiry)
    const userId = `github:${githubUser.login}`;
    const accessToken = createAccessToken({ userId, username: githubUser.login });
    const refreshToken = createRefreshToken({ userId, username: githubUser.login });
    const expiresAt = getRefreshTokenExpiry().toISOString();

    // Store session (AC#4: Refresh token stored in SQLite)
    createSession({
      userId,
      githubToken,
      refreshToken,
      expiresAt,
    });

    // Set refresh token cookie (AC#4: HTTP-only cookie with 7 days expiry)
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    // Set access token cookie (15 minutes, HTTP-only for security)
    res.cookie('accessToken', accessToken, ACCESS_REFRESH_COOKIE_OPTIONS);

    logAuthEvent('login', {
      provider: 'github',
      username: githubUser.login,
    });

    // Redirect to dashboard (AC#5) - tokens are in HTTP-only cookies
    res.redirect('/');
  } catch (error) {
    // Log error message only (not full stack/object) to avoid leaking internal state
    console.error('GitHub OAuth error:', error.message || 'Unknown error');
    logAuthEvent('auth_error', { provider: 'github', error: error.message });
    res.redirect('/login?error=oauth_failed');
  }
}));

/**
 * GET /auth/me
 * Get current authenticated user info
 * Checks Authorization header first, falls back to accessToken cookie
 */
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  let token;

  // Check Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies.accessToken) {
    // Fall back to access token cookie
    token = req.cookies.accessToken;
  } else {
    return res.status(401).json({
      error: 'Authorization required',
      code: 'NO_TOKEN',
    });
  }

  try {
    const payload = verifyToken(token);
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return res.json({
      data: {
        user: {
          userId: payload.userId,
          username: payload.username,
        },
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
  }
});

/**
 * GET /auth/error
 * Display authentication errors (AC#6)
 */
router.get('/error', (req, res) => {
  const { error } = req.query;

  // Return JSON error response per project API format
  res.status(403).json({
    error: error || 'Authentication failed',
    code: 'AUTH_ERROR',
    details: { message: error || 'Access denied' },
  });
});

export default router;
