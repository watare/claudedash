/**
 * Tests for password login route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticatePassword, isValidEmail } from './login.js';

// Mock dependencies
vi.mock('./password.js', () => ({
  getUserByEmail: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('./jwt.js', () => ({
  createAccessToken: vi.fn(() => 'mock-access-token'),
  createRefreshToken: vi.fn(() => 'mock-refresh-token'),
  getRefreshTokenExpiry: vi.fn(() => new Date('2026-01-22T00:00:00.000Z')),
}));

vi.mock('./session.js', () => ({
  createSession: vi.fn(() => ({ id: 1 })),
}));

import { getUserByEmail, verifyPassword } from './password.js';
import { createAccessToken, createRefreshToken, getRefreshTokenExpiry } from './jwt.js';
import { createSession } from './session.js';

describe('authenticatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return tokens for valid credentials', async () => {
    const mockUser = {
      email: 'admin@example.com',
      password_hash: '$2b$10$testhash',
    };

    getUserByEmail.mockReturnValue(mockUser);
    verifyPassword.mockResolvedValue(true);

    const result = await authenticatePassword('admin@example.com', 'correct-password');

    expect(result.success).toBe(true);
    expect(result.user).toEqual({
      userId: 'password:admin@example.com',
      email: 'admin@example.com',
    });
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');

    expect(getUserByEmail).toHaveBeenCalledWith('admin@example.com');
    expect(verifyPassword).toHaveBeenCalledWith('correct-password', '$2b$10$testhash');
    expect(createSession).toHaveBeenCalledWith({
      userId: 'password:admin@example.com',
      githubToken: null,
      refreshToken: 'mock-refresh-token',
      expiresAt: expect.any(String),
    });
  });

  it('should return error for non-existent user', async () => {
    getUserByEmail.mockReturnValue(null);

    const result = await authenticatePassword('nonexistent@example.com', 'password');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email or password');
    expect(result.code).toBe('INVALID_CREDENTIALS');
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('should return error for wrong password', async () => {
    const mockUser = {
      email: 'admin@example.com',
      password_hash: '$2b$10$testhash',
    };

    getUserByEmail.mockReturnValue(mockUser);
    verifyPassword.mockResolvedValue(false);

    const result = await authenticatePassword('admin@example.com', 'wrong-password');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email or password');
    expect(result.code).toBe('INVALID_CREDENTIALS');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('should return same error for invalid email and wrong password', async () => {
    // Test for user not found
    getUserByEmail.mockReturnValue(null);
    const resultNoUser = await authenticatePassword('bad@example.com', 'password');

    // Test for wrong password
    getUserByEmail.mockReturnValue({ email: 'admin@example.com', password_hash: 'hash' });
    verifyPassword.mockResolvedValue(false);
    const resultWrongPass = await authenticatePassword('admin@example.com', 'wrong');

    // Error messages should be identical to prevent enumeration
    expect(resultNoUser.error).toBe(resultWrongPass.error);
    expect(resultNoUser.code).toBe(resultWrongPass.code);
  });

  it('should normalize email to lowercase in user ID', async () => {
    const mockUser = {
      email: 'Admin@Example.com',
      password_hash: '$2b$10$testhash',
    };

    getUserByEmail.mockReturnValue(mockUser);
    verifyPassword.mockResolvedValue(true);

    const result = await authenticatePassword('ADMIN@EXAMPLE.COM', 'password');

    expect(result.user.email).toBe('Admin@Example.com'); // Original case preserved
    expect(result.user.userId).toBe('password:admin@example.com'); // Normalized
  });
});

describe('isValidEmail', () => {
  it('should return true for valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.org')).toBe(true);
    expect(isValidEmail('admin@sub.domain.co')).toBe(true);
  });

  it('should return false for invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('no@domain')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });
});
