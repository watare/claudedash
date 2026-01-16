/**
 * Tests for password authentication module
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { hashPassword, verifyPassword, getUserByEmail } from './password.js';

// Mock the secrets module
vi.mock('../config/secrets.js', () => ({
  getPasswordUsers: vi.fn(() => [
    { email: 'admin@example.com', password_hash: '$2b$10$testhashadmin' },
    { email: 'user@example.com', password_hash: '$2b$10$testhashuser' },
  ]),
}));

describe('bcrypt installation', () => {
  it('should hash and verify a password', async () => {
    const password = 'test-password-123';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2b$10$')).toBe(true);

    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await bcrypt.compare('wrong-password', hash);
    expect(isInvalid).toBe(false);
  });
});

describe('hashPassword', () => {
  it('should hash a password with bcrypt cost factor 10', async () => {
    const password = 'secure-password-123';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2b$10$')).toBe(true);
  });

  it('should generate different hashes for the same password', async () => {
    const password = 'test-password';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('should return true for correct password', async () => {
    const password = 'correct-password';
    const hash = await hashPassword(password);

    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('should return false for incorrect password', async () => {
    const password = 'correct-password';
    const hash = await hashPassword(password);

    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });
});

describe('getUserByEmail', () => {
  it('should return user data for existing email', () => {
    const user = getUserByEmail('admin@example.com');

    expect(user).toBeDefined();
    expect(user.email).toBe('admin@example.com');
    expect(user.password_hash).toBeDefined();
  });

  it('should return null for non-existing email', () => {
    const user = getUserByEmail('nonexistent@example.com');

    expect(user).toBeNull();
  });

  it('should be case-insensitive for email lookup', () => {
    const user = getUserByEmail('ADMIN@EXAMPLE.COM');

    expect(user).toBeDefined();
    expect(user.email).toBe('admin@example.com');
  });

  it('should return null when no password users configured', async () => {
    // Dynamically change mock return value
    const { getPasswordUsers } = await import('../config/secrets.js');
    getPasswordUsers.mockReturnValueOnce(null);

    const user = getUserByEmail('admin@example.com');
    expect(user).toBeNull();
  });
});
