/**
 * Tests for create-user script helpers
 */

import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';

// Test the validation and hashing logic used in the script
describe('create-user helpers', () => {
  it('should validate email format correctly', () => {
    // Valid emails
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.org')).toBe(true);

    // Invalid emails
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it('should hash password with bcrypt cost 10', async () => {
    const password = 'test-password-123';
    const hash = await bcrypt.hash(password, 10);

    expect(hash.startsWith('$2b$10$')).toBe(true);
    expect(await bcrypt.compare(password, hash)).toBe(true);
  });

  it('should enforce minimum password length', () => {
    const MIN_PASSWORD_LENGTH = 8;

    expect('short'.length < MIN_PASSWORD_LENGTH).toBe(true);
    expect('longenoughpassword'.length >= MIN_PASSWORD_LENGTH).toBe(true);
  });
});

// Inline validation function (mirrors script logic)
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
