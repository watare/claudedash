# Story 1.3: Secrets Configuration System

Status: done

## Story

As a **developer**,
I want **secrets loaded from a gitignored configuration file**,
So that **sensitive credentials are never committed to source control** (FR28, FR32).

## Acceptance Criteria

1. **Given** a `bmad-orchestrator.secrets.yaml` file exists in the project root
   **When** the server starts
   **Then** GitHub OAuth client_id and client_secret are loaded from secrets file

2. **Given** the secrets file exists
   **When** the server loads configuration
   **Then** the allowed_users list is loaded from secrets file

3. **Given** the secrets file has SSH configuration
   **When** the server loads configuration
   **Then** SSH key paths are loaded if configured (FR30)

4. **Given** the project repository
   **When** I inspect `.gitignore`
   **Then** the secrets file is listed in .gitignore

5. **Given** any server operation
   **When** logs are output
   **Then** secrets never appear in console logs or stdout (FR32)

6. **Given** required secrets are missing
   **When** the server starts
   **Then** the server logs a clear error and exits (FR33)

7. **Given** a new developer setup
   **When** they need to configure secrets
   **Then** an example file `bmad-orchestrator.secrets.example.yaml` documents the required format

## Tasks / Subtasks

- [x] Task 1: Create secrets example file (AC: #7)
  - [x] Create `bmad-orchestrator.secrets.example.yaml` with documented format:
    ```yaml
    # GitHub OAuth Configuration
    github:
      client_id: "your_github_oauth_app_client_id"
      client_secret: "your_github_oauth_app_client_secret"

    # Allowed users (GitHub usernames)
    allowed_users:
      - "your_github_username"

    # Optional: SSH configuration for VPS deployment
    ssh:
      key_path: "~/.ssh/id_ed25519"
      host: "your-vps-hostname"
      user: "deploy"

    # Optional: Password authentication users
    password_users:
      - email: "admin@example.com"
        password_hash: "$2b$10$..." # bcrypt hash

    # Optional: Notification webhooks
    notifications:
      webhook_url: "https://your-webhook-endpoint.com/notify"
      slack_webhook_url: "https://hooks.slack.com/services/..."
    ```

- [x] Task 2: Add secrets file to .gitignore (AC: #4)
  - [x] Add `bmad-orchestrator.secrets.yaml` to `.gitignore`
  - [x] Verify `.env.production` is also gitignored

- [x] Task 3: Create secrets loader module
  - [x] Create `src/config/secrets.js` module
  - [x] Use `js-yaml` (already installed) to parse YAML
  - [x] Load from project root `bmad-orchestrator.secrets.yaml`

- [x] Task 4: Implement secrets validation (AC: #6)
  - [x] Define required secrets: `github.client_id`, `github.client_secret`, `allowed_users`
  - [x] Validate all required secrets are present on startup
  - [x] Log clear, actionable error message if missing
  - [x] Exit with non-zero code if validation fails

- [x] Task 5: Load GitHub OAuth credentials (AC: #1)
  - [x] Extract `github.client_id` from secrets
  - [x] Extract `github.client_secret` from secrets
  - [x] Export via `getGitHubCredentials()` function

- [x] Task 6: Load allowed users list (AC: #2)
  - [x] Extract `allowed_users` array from secrets
  - [x] Export via `getAllowedUsers()` function
  - [x] Provide `isUserAllowed(username)` helper function

- [x] Task 7: Load SSH configuration (AC: #3)
  - [x] Extract `ssh.key_path`, `ssh.host`, `ssh.user` if present
  - [x] Expand `~` in paths to actual home directory
  - [x] Export via `getSSHConfig()` function (returns null if not configured)

- [x] Task 8: Implement log sanitization (AC: #5)
  - [x] Create `sanitizeForLogging(obj)` function
  - [x] Redact known secret fields: `client_secret`, `password`, `token`, `key`
  - [x] Replace values with `[REDACTED]`
  - [x] Use sanitization in all logging that might contain config

- [x] Task 9: Integrate with existing config system
  - [x] Update `src/config.js` to use secrets module
  - [x] Ensure secrets are loaded before server starts
  - [x] Make secrets available to auth modules

### Review Follow-ups (AI)

- [ ] [AI-Review][MEDIUM] Add unit tests for `loadSecrets()` - file loading, caching behavior [src/config/secrets.test.js]
- [ ] [AI-Review][MEDIUM] Add unit tests for `validateSecrets()` - error message validation [src/config/secrets.test.js]
- [ ] [AI-Review][MEDIUM] Add unit tests for `getGitHubCredentials()` [src/config/secrets.test.js]
- [ ] [AI-Review][MEDIUM] Add unit tests for `getSSHConfig()` - especially `~` path expansion [src/config/secrets.test.js]
- [ ] [AI-Review][MEDIUM] Add unit tests for `getPasswordUsers()` and `getNotificationConfig()` [src/config/secrets.test.js]
- [ ] [AI-Review][LOW] Improve JSDoc return types for nullable functions [src/config/secrets.js]

## Dev Notes

### Critical Implementation Rules

1. **ES Modules** - Use ES Module syntax (`import`/`export`).
2. **File Extensions** - Include `.js` extension in all local imports.
3. **Never Log Secrets** - Always sanitize before logging any configuration.

### Secrets File Location

The secrets file should be at the project root:
```
bmad-orchestrator/
├── bmad-orchestrator.secrets.yaml      # Actual secrets (gitignored)
├── bmad-orchestrator.secrets.example.yaml  # Template (committed)
└── src/
    └── config/
        └── secrets.js                   # Secrets loader module
```

### Secrets Loading Pattern

```javascript
// ✅ CORRECT - ES Modules, proper error handling
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'js-yaml';
import { join } from 'path';

const SECRETS_PATH = join(process.cwd(), 'bmad-orchestrator.secrets.yaml');

let secrets = null;

export function loadSecrets() {
  if (secrets) return secrets;

  try {
    const content = readFileSync(SECRETS_PATH, 'utf8');
    secrets = parseYaml(content);
    validateSecrets(secrets);
    return secrets;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('ERROR: Secrets file not found: bmad-orchestrator.secrets.yaml');
      console.error('Copy bmad-orchestrator.secrets.example.yaml and fill in your values.');
      process.exit(1);
    }
    throw error;
  }
}
```

### Log Sanitization Pattern

```javascript
// Sanitize objects before logging
const REDACT_KEYS = ['secret', 'password', 'token', 'key', 'credential'];

export function sanitizeForLogging(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (REDACT_KEYS.some(k => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Usage
console.log('Loaded config:', sanitizeForLogging(config));
// Output: { github: { client_id: 'xxx', client_secret: '[REDACTED]' } }
```

### Required vs Optional Secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `github.client_id` | Yes | OAuth app identification |
| `github.client_secret` | Yes | OAuth app authentication |
| `allowed_users` | Yes | User authorization whitelist |
| `ssh.key_path` | No | VPS deployment |
| `password_users` | No | Fallback authentication |
| `notifications.webhook_url` | No | External notifications |
| `notifications.slack_webhook_url` | No | Slack notifications |

### Validation Error Messages

Provide clear, actionable error messages:

```
ERROR: Missing required secret: github.client_id
       Please add this to bmad-orchestrator.secrets.yaml
       Example:
         github:
           client_id: "your_client_id_here"
```

### Security Considerations

1. **Never commit secrets** - Verify `.gitignore` includes the secrets file
2. **Validate before use** - Always validate secrets exist before accessing
3. **Sanitize all logs** - Never log raw config that might contain secrets
4. **Minimum privilege** - Only load secrets that are actually needed

### References

- [Source: architecture.md#Secrets & Security]
- [Source: architecture.md#Environment Files]
- [Source: prd.md#FR28-FR33 Secrets Management]
- [Source: project-context.md#Critical Implementation Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 9 unit tests pass for secrets module

### Completion Notes List

- Created `bmad-orchestrator.secrets.example.yaml` with comprehensive documentation for GitHub OAuth, allowed users, SSH config, password users, and notification webhooks
- Updated `.gitignore` to exclude `bmad-orchestrator.secrets.yaml` and `.env.production`
- Implemented `src/config/secrets.js` module with:
  - `loadSecrets()` - Loads and caches secrets from YAML file
  - `validateSecrets()` - Validates required secrets with clear error messages
  - `getGitHubCredentials()` - Returns GitHub OAuth client_id and client_secret
  - `getAllowedUsers()` - Returns array of allowed GitHub usernames
  - `isUserAllowed(username)` - Checks if a user is in the allowed list
  - `getSSHConfig()` - Returns SSH config with expanded home directory paths
  - `getPasswordUsers()` - Returns password authentication users
  - `getNotificationConfig()` - Returns notification webhook configuration
  - `sanitizeForLogging(obj)` - Recursively redacts sensitive fields (secret, password, token, key, credential, hash)
- Created `src/config/index.js` for convenient re-exports
- Updated `src/config.js` to import and re-export all secrets functions
- All acceptance criteria satisfied:
  - AC1: GitHub OAuth credentials loaded via `getGitHubCredentials()`
  - AC2: Allowed users loaded via `getAllowedUsers()` and `isUserAllowed()`
  - AC3: SSH config loaded with `~` expansion via `getSSHConfig()`
  - AC4: Secrets file added to `.gitignore`
  - AC5: Log sanitization via `sanitizeForLogging()` redacts all sensitive fields
  - AC6: Clear error messages and `process.exit(1)` when required secrets missing
  - AC7: Example file created with documented format

### File List

- bmad-orchestrator.secrets.example.yaml (new)
- .gitignore (modified)
- src/config/secrets.js (new)
- src/config/secrets.test.js (new)
- src/config/index.js (new)
- src/config.js (modified)
- src/server.js (modified) - Added sanitizeForLogging to config endpoints
- package.json (modified) - Added better-sqlite3 dependency
- package-lock.json (modified)

## Change Log

- 2026-01-15: Implemented secrets configuration system (Story 1.3)
- 2026-01-15: Code Review - Fixed H2 (sanitizeForLogging not used in server.js), Fixed M3 (key_path incorrectly redacted), Updated File List, Added 6 action items for test coverage
