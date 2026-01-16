/**
 * Password login authentication logic
 */

import { getUserByEmail, verifyPassword } from './password.js';
import { createAccessToken, createRefreshToken, getRefreshTokenExpiry } from './jwt.js';
import { createSession } from './session.js';

/**
 * Authenticate a user with email and password
 * @param {string} email - User email address
 * @param {string} password - Plain text password
 * @returns {Promise<{
 *   success: boolean,
 *   user?: { userId: string, email: string },
 *   accessToken?: string,
 *   refreshToken?: string,
 *   error?: string,
 *   code?: string
 * }>}
 */
export async function authenticatePassword(email, password) {
  // Look up user by email
  const user = getUserByEmail(email);

  // Same error message for both invalid email and wrong password (prevent enumeration)
  const invalidCredentialsResponse = {
    success: false,
    error: 'Invalid email or password',
    code: 'INVALID_CREDENTIALS',
  };

  if (!user) {
    return invalidCredentialsResponse;
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    return invalidCredentialsResponse;
  }

  // Create user ID in format 'password:email' (email normalized to lowercase)
  const userId = `password:${email.toLowerCase()}`;

  // Create tokens
  const userPayload = { userId, username: email };
  const accessToken = createAccessToken(userPayload);
  const refreshToken = createRefreshToken(userPayload);

  // Store session
  const expiresAt = getRefreshTokenExpiry().toISOString();
  createSession({
    userId,
    githubToken: null, // Password auth doesn't have a GitHub token
    refreshToken,
    expiresAt,
  });

  return {
    success: true,
    user: {
      userId,
      email: user.email, // Return original email case from secrets file
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email validation: must have @ with at least one char before and after
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
