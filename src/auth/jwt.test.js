/**
 * Tests for JWT token management
 */

import { describe, it, expect } from 'vitest';
import { createAccessToken, createRefreshToken, verifyToken, getRefreshTokenExpiry } from './jwt.js';

describe('JWT Token Management', () => {
  const testUser = { userId: 'github:testuser', username: 'testuser' };

  describe('createAccessToken', () => {
    it('should create a valid JWT access token', () => {
      const token = createAccessToken(testUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should include user info in token payload', () => {
      const token = createAccessToken(testUser);
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(testUser.userId);
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.type).toBe('access');
    });

    it('should have correct expiry time (15 minutes)', () => {
      const token = createAccessToken(testUser);
      const decoded = verifyToken(token);
      const expiryMs = (decoded.exp - decoded.iat) * 1000;
      const fifteenMinutes = 15 * 60 * 1000;
      expect(expiryMs).toBe(fifteenMinutes);
    });
  });

  describe('createRefreshToken', () => {
    it('should create a valid JWT refresh token', () => {
      const token = createRefreshToken(testUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should include user info in token payload', () => {
      const token = createRefreshToken(testUser);
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(testUser.userId);
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.type).toBe('refresh');
    });

    it('should have correct expiry time (7 days)', () => {
      const token = createRefreshToken(testUser);
      const decoded = verifyToken(token);
      const expiryMs = (decoded.exp - decoded.iat) * 1000;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(expiryMs).toBe(sevenDays);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = createAccessToken(testUser);
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(testUser.userId);
    });

    it('should throw for invalid token', () => {
      expect(() => {
        verifyToken('invalid.token.here');
      }).toThrow(/invalid/i);
    });

    it('should throw for tampered token', () => {
      const token = createAccessToken(testUser);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      expect(() => {
        verifyToken(tamperedToken);
      }).toThrow(/invalid signature/i);
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('should return a date 7 days in the future', () => {
      const expiry = getRefreshTokenExpiry();
      const now = new Date();
      const diffMs = expiry - now;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(Math.abs(diffMs - sevenDaysMs)).toBeLessThan(1000);
    });
  });
});
