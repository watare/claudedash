/**
 * Tests for secrets module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  sanitizeForLogging,
  isUserAllowed,
  loadSecrets,
  resetSecretsCache,
} from './secrets.js';

// We need to test in a temporary directory to avoid affecting real secrets
const TEST_DIR = join(tmpdir(), 'secrets-test-' + Date.now());

describe('secrets module', () => {
  beforeEach(() => {
    // Create test directory
    mkdirSync(TEST_DIR, { recursive: true });
    // Reset cached secrets before each test
    resetSecretsCache();
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    // Reset cache
    resetSecretsCache();
  });

  describe('sanitizeForLogging', () => {
    it('should redact secret fields', () => {
      const obj = {
        github: {
          client_id: 'abc123',
          client_secret: 'super-secret-value',
        },
        allowed_users: ['user1'],
      };

      const sanitized = sanitizeForLogging(obj);

      expect(sanitized.github.client_id).toBe('abc123');
      expect(sanitized.github.client_secret).toBe('[REDACTED]');
      expect(sanitized.allowed_users).toEqual(['user1']);
    });

    it('should redact password fields', () => {
      const obj = {
        password: 'my-password',
        password_hash: '$2b$10$...',
        user_password: 'secret',
      };

      const sanitized = sanitizeForLogging(obj);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.password_hash).toBe('[REDACTED]');
      expect(sanitized.user_password).toBe('[REDACTED]');
    });

    it('should redact token fields', () => {
      const obj = {
        access_token: 'token123',
        refresh_token: 'refresh456',
        api_token: 'api789',
      };

      const sanitized = sanitizeForLogging(obj);

      expect(sanitized.access_token).toBe('[REDACTED]');
      expect(sanitized.refresh_token).toBe('[REDACTED]');
      expect(sanitized.api_token).toBe('[REDACTED]');
    });

    it('should redact key fields but not paths', () => {
      const obj = {
        api_key: 'key123',
        key_path: '/path/to/key', // Paths are NOT secrets
        ssh_key: 'ssh-rsa ...',
        private_key: 'BEGIN PRIVATE KEY...',
      };

      const sanitized = sanitizeForLogging(obj);

      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.key_path).toBe('/path/to/key'); // Path should NOT be redacted
      expect(sanitized.ssh_key).toBe('[REDACTED]');
      expect(sanitized.private_key).toBe('[REDACTED]');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeForLogging(null)).toBeNull();
      expect(sanitizeForLogging(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(sanitizeForLogging('string')).toBe('string');
      expect(sanitizeForLogging(123)).toBe(123);
      expect(sanitizeForLogging(true)).toBe(true);
    });

    it('should handle arrays', () => {
      const arr = [{ password: 'secret1' }, { password: 'secret2' }];

      const sanitized = sanitizeForLogging(arr);

      expect(sanitized[0].password).toBe('[REDACTED]');
      expect(sanitized[1].password).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const obj = {
        level1: {
          level2: {
            client_secret: 'nested-secret',
            safe_field: 'visible',
          },
        },
      };

      const sanitized = sanitizeForLogging(obj);

      expect(sanitized.level1.level2.client_secret).toBe('[REDACTED]');
      expect(sanitized.level1.level2.safe_field).toBe('visible');
    });
  });

  describe('isUserAllowed', () => {
    it('should return true for allowed users when secrets loaded', () => {
      // Create a valid secrets file
      const secretsPath = join(TEST_DIR, 'bmad-orchestrator.secrets.yaml');
      writeFileSync(
        secretsPath,
        `
github:
  client_id: "test-id"
  client_secret: "test-secret"
allowed_users:
  - "allowed-user"
  - "another-user"
`
      );

      // Load secrets from test directory
      loadSecrets(TEST_DIR);

      expect(isUserAllowed('allowed-user')).toBe(true);
      expect(isUserAllowed('another-user')).toBe(true);
      expect(isUserAllowed('unknown-user')).toBe(false);
    });
  });
});
