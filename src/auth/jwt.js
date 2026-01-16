/**
 * JWT token management for access and refresh tokens
 */

import jwt from 'jsonwebtoken';

// JWT secret from environment (required in production)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

// Use a dev-only secret for local development (never in production)
const SECRET = JWT_SECRET || 'dev-secret-do-not-use-in-production';

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Create an access token for a user
 * @param {{ userId: string, username: string }} user - User info
 * @returns {string} JWT access token
 */
export function createAccessToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      username: user.username,
      type: 'access',
    },
    SECRET,
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_EXPIRY,
    }
  );
}

/**
 * Create a refresh token for a user
 * @param {{ userId: string, username: string }} user - User info
 * @returns {string} JWT refresh token
 */
export function createRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      username: user.username,
      type: 'refresh',
    },
    SECRET,
    {
      algorithm: 'HS256',
      expiresIn: REFRESH_TOKEN_EXPIRY,
    }
  );
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {{ userId: string, username: string, type: string, iat: number, exp: number }} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyToken(token) {
  return jwt.verify(token, SECRET, { algorithms: ['HS256'] });
}

/**
 * Get the expiry date for a refresh token (7 days from now)
 * @returns {Date} Expiry date
 */
export function getRefreshTokenExpiry() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
}
