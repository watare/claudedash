/**
 * Password authentication module
 * Handles password hashing and verification using bcrypt
 */

import bcrypt from 'bcrypt';
import { getPasswordUsers } from '../config/secrets.js';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Bcrypt hash
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Bcrypt hash to compare against
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Look up a user by email from the secrets configuration
 * @param {string} email - Email address to look up
 * @returns {{ email: string, password_hash: string } | null} User data or null if not found
 */
export function getUserByEmail(email) {
  const users = getPasswordUsers();

  if (!users || !Array.isArray(users)) {
    return null;
  }

  const normalizedEmail = email.toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  return user || null;
}
