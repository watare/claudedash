/**
 * Integration tests for auth routes
 * Tests the HTTP layer of authentication endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { initDb, closeDb, getDb } from '../db/index.js';
import authRoutes from './routes.js';
import { createAccessToken, createRefreshToken, getRefreshTokenExpiry } from './jwt.js';
import { createSession } from './session.js';
import { resetRateLimiter } from './rate-limiter.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRoutes);

  // Error handler for asyncHandler
  app.use((err, req, res, next) => {
    console.error('Test error:', err.message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  });

  return app;
}

// Helper to make requests with cookies
async function request(app, method, path, options = {}) {
  const { body, cookies = {} } = options;

  // Build cookie header
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const headers = {
    'Content-Type': 'application/json',
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };

  // Use native fetch with the test server
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual', // Don't follow redirects
    });

    const responseHeaders = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data = null;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    }

    return {
      status: res.status,
      headers: responseHeaders,
      data,
      cookies: parseCookies(responseHeaders['set-cookie']),
    };
  } finally {
    server.close();
  }
}

// Parse Set-Cookie header
function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return {};
  const cookies = {};
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const part of parts) {
    const [nameValue] = part.split(';');
    const [name, value] = nameValue.split('=');
    cookies[name.trim()] = value;
  }
  return cookies;
}

describe('Auth Routes', () => {
  let app;
  const testUser = { userId: 'github:testuser', username: 'testuser' };

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    // Clear sessions and rate limiter before each test
    const db = getDb();
    db.exec('DELETE FROM sessions');
    db.exec('DELETE FROM audit_log');
    resetRateLimiter();
  });

  describe('POST /auth/refresh', () => {
    it('should return 401 when no refresh token cookie', async () => {
      const res = await request(app, 'POST', '/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.data.code).toBe('NO_REFRESH_TOKEN');
    });

    it('should return 401 for invalid refresh token', async () => {
      const res = await request(app, 'POST', '/auth/refresh', {
        cookies: { refreshToken: 'invalid-token' },
      });
      expect(res.status).toBe(401);
      expect(res.data.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should return new access token for valid refresh token', async () => {
      // Create a valid session
      const refreshToken = createRefreshToken(testUser);
      const expiresAt = getRefreshTokenExpiry().toISOString();
      createSession({
        userId: testUser.userId,
        githubToken: null,
        refreshToken,
        expiresAt,
      });

      const res = await request(app, 'POST', '/auth/refresh', {
        cookies: { refreshToken },
      });

      expect(res.status).toBe(200);
      expect(res.data.data.accessToken).toBeDefined();
      expect(typeof res.data.data.accessToken).toBe('string');
    });

    it('should return 401 for expired session', async () => {
      // Create an expired session
      const refreshToken = createRefreshToken(testUser);
      const expiredAt = new Date(Date.now() - 1000).toISOString();
      createSession({
        userId: testUser.userId,
        githubToken: null,
        refreshToken,
        expiresAt: expiredAt,
      });

      const res = await request(app, 'POST', '/auth/refresh', {
        cookies: { refreshToken },
      });

      expect(res.status).toBe(401);
      expect(res.data.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should be rate limited after too many requests', async () => {
      // Make 6 requests (limit is 5)
      for (let i = 0; i < 5; i++) {
        await request(app, 'POST', '/auth/refresh');
      }

      const res = await request(app, 'POST', '/auth/refresh');
      expect(res.status).toBe(429);
      expect(res.data.code).toBe('RATE_LIMITED');
      expect(res.headers['retry-after']).toBeDefined();
    });
  });

  describe('POST /auth/logout', () => {
    it('should clear cookies and return success', async () => {
      const refreshToken = createRefreshToken(testUser);
      const expiresAt = getRefreshTokenExpiry().toISOString();
      createSession({
        userId: testUser.userId,
        githubToken: null,
        refreshToken,
        expiresAt,
      });

      const res = await request(app, 'POST', '/auth/logout', {
        cookies: { refreshToken, accessToken: 'some-token' },
      });

      expect(res.status).toBe(200);
      expect(res.data.data.message).toBe('Logged out successfully');
    });

    it('should succeed even without cookies', async () => {
      const res = await request(app, 'POST', '/auth/logout');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/login', () => {
    it('should return 400 for missing credentials', async () => {
      const res = await request(app, 'POST', '/auth/login', {
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('MISSING_CREDENTIALS');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app, 'POST', '/auth/login', {
        body: { email: 'not-an-email', password: 'password123' },
      });
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('INVALID_EMAIL');
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request(app, 'POST', '/auth/login', {
        body: { email: 'test@example.com', password: 'wrongpassword' },
      });
      expect(res.status).toBe(401);
      expect(res.data.code).toBe('INVALID_CREDENTIALS');
    });

    it('should be rate limited after too many attempts', async () => {
      // Make 6 login attempts (limit is 5)
      for (let i = 0; i < 5; i++) {
        await request(app, 'POST', '/auth/login', {
          body: { email: 'test@example.com', password: 'wrong' },
        });
      }

      const res = await request(app, 'POST', '/auth/login', {
        body: { email: 'test@example.com', password: 'wrong' },
      });
      expect(res.status).toBe(429);
      expect(res.data.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app, 'GET', '/auth/me');
      expect(res.status).toBe(401);
      expect(res.data.code).toBe('NO_TOKEN');
    });

    it('should return user info with valid access token cookie', async () => {
      const accessToken = createAccessToken(testUser);

      const res = await request(app, 'GET', '/auth/me', {
        cookies: { accessToken },
      });

      expect(res.status).toBe(200);
      expect(res.data.data.user.userId).toBe(testUser.userId);
      expect(res.data.data.user.username).toBe(testUser.username);
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(app, 'GET', '/auth/me', {
        cookies: { accessToken: 'invalid-token' },
      });
      expect(res.status).toBe(401);
      expect(res.data.code).toBe('INVALID_TOKEN');
    });

    it('should reject refresh token used as access token', async () => {
      const refreshToken = createRefreshToken(testUser);

      const res = await request(app, 'GET', '/auth/me', {
        cookies: { accessToken: refreshToken },
      });

      expect(res.status).toBe(401);
      expect(res.data.code).toBe('INVALID_TOKEN');
    });
  });

  describe('GET /auth/error', () => {
    it('should return error message from query param', async () => {
      const res = await request(app, 'GET', '/auth/error?error=Test%20error');
      expect(res.status).toBe(403);
      expect(res.data.error).toBe('Test error');
      expect(res.data.code).toBe('AUTH_ERROR');
    });

    it('should return default error without query param', async () => {
      const res = await request(app, 'GET', '/auth/error');
      expect(res.status).toBe(403);
      expect(res.data.error).toBe('Authentication failed');
    });
  });

  describe('GET /auth/github', () => {
    it('should redirect to GitHub authorization URL', async () => {
      // This test requires secrets to be configured
      // Skip if secrets not available
      try {
        const res = await request(app, 'GET', '/auth/github');
        // Should be a redirect (302 or 307)
        expect([302, 307]).toContain(res.status);
      } catch (error) {
        // Skip if secrets not configured
        if (error.message.includes('secrets')) {
          console.log('Skipping GitHub redirect test - secrets not configured');
          return;
        }
        throw error;
      }
    });
  });
});
