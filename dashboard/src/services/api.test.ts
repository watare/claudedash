import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken, getAccessToken, apiFetch, apiGet, apiPost } from './api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location
const originalLocation = window.location;

describe('api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('setAccessToken / getAccessToken', () => {
    it('stores and retrieves access token', () => {
      expect(getAccessToken()).toBeNull();

      setAccessToken('test-token-123');
      expect(getAccessToken()).toBe('test-token-123');

      setAccessToken(null);
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('apiFetch', () => {
    it('adds Authorization header when token is set', async () => {
      setAccessToken('my-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      });

      await apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer my-token',
          }),
        })
      );
    });

    it('does not add Authorization header when no token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      });

      await apiFetch('/api/test');

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['Authorization']).toBeUndefined();
    });

    it('includes credentials for cookies', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('attempts token refresh on 401 response', async () => {
      setAccessToken('expired-token');

      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Refresh call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { accessToken: 'new-token' } }),
      });

      // Retry with new token succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await apiFetch('/api/protected');

      // Should have made 3 calls: original, refresh, retry
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/auth/refresh', expect.any(Object));
      expect(getAccessToken()).toBe('new-token');
    });

    it('redirects to login when refresh fails', async () => {
      setAccessToken('expired-token');

      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Refresh call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(apiFetch('/api/protected')).rejects.toThrow('Session expired');
      expect(window.location.href).toBe('/login');
      expect(getAccessToken()).toBeNull();
    });

    it('does not attempt refresh for /auth/refresh endpoint', async () => {
      setAccessToken('some-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const response = await apiFetch('/auth/refresh');

      // Should only make 1 call, no refresh attempt
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(401);
    });
  });

  describe('apiGet', () => {
    it('returns data from successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 1, name: 'test' } }),
      });

      const result = await apiGet('/api/items/1');

      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('throws error on failed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      await expect(apiGet('/api/items/999')).rejects.toThrow('Not found');
    });
  });

  describe('apiPost', () => {
    it('sends body as JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { created: true } }),
      });

      await apiPost('/api/items', { name: 'new item' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'new item' }),
        })
      );
    });

    it('handles POST without body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { triggered: true } }),
      });

      await apiPost('/api/trigger');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/trigger',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });
  });
});
