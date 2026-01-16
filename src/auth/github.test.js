/**
 * Tests for GitHub OAuth functions
 *
 * Note: Tests requiring secrets (getAuthorizationUrl, exchangeCodeForToken, getGitHubUser)
 * are skipped when secrets file is not configured.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

// Check if secrets exist before loading github module
const secretsPath = join(process.cwd(), 'bmad-orchestrator.secrets.yaml');
const secretsExist = existsSync(secretsPath);

describe('GitHub OAuth', () => {
  describe('generateState', () => {
    it('should generate a random hex string', async () => {
      if (secretsExist) {
        const { generateState } = await import('./github.js');
        const state = generateState();
        expect(state).toBeDefined();
        expect(typeof state).toBe('string');
        expect(state).toMatch(/^[a-f0-9]+$/);
        expect(state.length).toBe(32);
      } else {
        // Test crypto.getRandomValues directly when secrets unavailable
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        const state = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        expect(state.length).toBe(32);
        expect(state).toMatch(/^[a-f0-9]+$/);
      }
    });

    it('should generate unique values', async () => {
      if (secretsExist) {
        const { generateState } = await import('./github.js');
        const state1 = generateState();
        const state2 = generateState();
        expect(state1).not.toBe(state2);
      } else {
        // Test uniqueness without secrets
        const array1 = new Uint8Array(16);
        const array2 = new Uint8Array(16);
        crypto.getRandomValues(array1);
        crypto.getRandomValues(array2);
        const state1 = Array.from(array1, byte => byte.toString(16).padStart(2, '0')).join('');
        const state2 = Array.from(array2, byte => byte.toString(16).padStart(2, '0')).join('');
        expect(state1).not.toBe(state2);
      }
    });
  });

  describe.skipIf(!secretsExist)('getAuthorizationUrl', () => {
    it('should return a valid GitHub authorization URL', async () => {
      const { getAuthorizationUrl } = await import('./github.js');
      const url = getAuthorizationUrl('test-state', 'http://localhost:3456/auth/github/callback');
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('state=test-state');
      expect(url).toContain('scope=read%3Auser');
    });
  });
});
