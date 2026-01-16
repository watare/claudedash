/**
 * Auth middleware for protecting routes
 */

import { verifyToken } from './jwt.js';

/**
 * Middleware that requires valid access token
 * Checks Authorization header first, falls back to accessToken cookie
 * Attaches decoded user info to req.user
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token;

  // Check Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.accessToken) {
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
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
  }
}

/**
 * Optional auth middleware - attaches user if valid token present, but doesn't require it
 * Checks Authorization header first, falls back to accessToken cookie
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token;

  // Check Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    // Fall back to access token cookie
    token = req.cookies.accessToken;
  }

  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.type === 'access') {
        req.user = payload;
      }
    } catch {
      // Token invalid, but that's okay for optional auth
    }
  }
  next();
}
