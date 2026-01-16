# Story 1.5: Password Fallback Authentication

Status: done

## Story

As a **user**,
I want **to login with email and password when GitHub OAuth is unavailable**,
So that **I can still access the dashboard offline or if GitHub is down**.

## Acceptance Criteria

1. **Given** I am on the login page
   **When** I enter valid email and password credentials
   **Then** the credentials are verified against stored hash (bcrypt)

2. **Given** valid credentials are provided
   **When** authentication succeeds
   **Then** JWT access token and refresh token are created

3. **Given** authentication succeeds
   **When** tokens are created
   **Then** I am redirected to the dashboard

4. **Given** I enter invalid credentials
   **When** I submit the login form
   **Then** I see "Invalid email or password"

5. **Given** a failed login attempt
   **When** the error is logged
   **Then** the attempt is logged in audit_log

6. **Given** multiple failed attempts
   **When** rate limit is exceeded
   **Then** rate limiting applies (5 attempts per 15 minutes)

7. **Given** no password user exists
   **When** I need to create one
   **Then** a CLI command `npm run create-user` prompts for email and password

8. **Given** a new user is being created
   **When** the password is set
   **Then** the password is hashed with bcrypt before storage

## Tasks / Subtasks

- [x] Task 1: Install bcrypt dependency
  - [x] Run `npm install bcrypt`
  - [x] Verify installation (bcrypt requires native bindings)

- [x] Task 2: Create password auth module (AC: #1)
  - [x] Create `src/auth/password.js` with functions:
    - `hashPassword(password)` - hash with bcrypt (cost factor 10)
    - `verifyPassword(password, hash)` - compare password to hash
    - `getUserByEmail(email)` - lookup user from secrets file
  - [x] Load password_users from secrets file

- [x] Task 3: Implement login route (AC: #1, #2, #3, #4)
  - [x] Create `POST /auth/login` route:
    - Accept JSON body: `{ email, password }`
    - Validate email format
    - Look up user by email
    - Verify password with bcrypt
    - If valid: create tokens, set cookies, return success
    - If invalid: return error (same message for email/password to prevent enumeration)

- [x] Task 4: Implement rate limiting (AC: #6)
  - [x] Create in-memory rate limiter for login attempts
  - [x] Track attempts by IP address
  - [x] Limit: 5 attempts per 15 minutes
  - [x] Return `429 Too Many Requests` when exceeded
  - [x] Include `Retry-After` header

- [x] Task 5: Implement audit logging (AC: #5)
  - [x] Log successful logins: `action: 'login', details: { method: 'password', email }`
  - [x] Log failed logins: `action: 'login_failed', details: { method: 'password', email, reason }`
  - [x] Log rate limit hits: `action: 'rate_limited', details: { ip, endpoint }`

- [x] Task 6: Create user CLI command (AC: #7, #8)
  - [x] Create `scripts/create-user.js` CLI script
  - [x] Prompt for email (validate format)
  - [x] Prompt for password (minimum 8 characters)
  - [x] Confirm password (must match)
  - [x] Hash password with bcrypt
  - [x] Output YAML snippet to add to secrets file
  - [x] Add `create-user` script to package.json: `"create-user": "node scripts/create-user.js"`

- [x] Task 7: Implement session creation for password auth
  - [x] Reuse session creation from Story 1.4
  - [x] Use `password:email` as user_id format
  - [x] Set `github_token` to null for password auth
  - [x] Store refresh token in SQLite

- [x] Task 8: Integrate with auth routes
  - [x] Add login route to auth router
  - [x] Ensure consistent error response format
  - [x] Test both success and failure paths

## Dev Notes

### Critical Implementation Rules

1. **ES Modules** - Use ES Module syntax (`import`/`export`).
2. **File Extensions** - Include `.js` extension in all local imports.
3. **Same Error Message** - Return same error for invalid email AND invalid password to prevent enumeration.
4. **bcrypt Cost Factor** - Use cost factor 10 (balance of security and performance).

### Password Users in Secrets File

Password users are defined in `bmad-orchestrator.secrets.yaml`:

```yaml
password_users:
  - email: "admin@example.com"
    password_hash: "$2b$10$..."  # bcrypt hash
  - email: "user@example.com"
    password_hash: "$2b$10$..."
```

### bcrypt Usage Pattern

```javascript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Hash password (during user creation)
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password (during login)
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
```

### Login Request/Response

**Request:**
```json
POST /auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "secretpassword"
}
```

**Success Response:**
```json
{
  "data": {
    "user": {
      "userId": "password:admin@example.com",
      "email": "admin@example.com"
    },
    "accessToken": "eyJhbGc..."
  },
  "meta": { "timestamp": "2026-01-15T12:00:00Z" }
}
```

**Error Response:**
```json
{
  "error": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

### Rate Limiting Implementation

```javascript
// Simple in-memory rate limiter
const attempts = new Map(); // IP -> { count, resetAt }

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}
```

### Create User CLI Script

```javascript
// scripts/create-user.js
import { createInterface } from 'readline';
import bcrypt from 'bcrypt';

const rl = createInterface({ input: process.stdin, output: process.stdout });

const prompt = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  console.log('Create Password User for bmad-orchestrator\n');

  const email = await prompt('Email: ');
  if (!email.includes('@')) {
    console.error('Invalid email format');
    process.exit(1);
  }

  const password = await prompt('Password (min 8 chars): ');
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const confirm = await prompt('Confirm password: ');
  if (password !== confirm) {
    console.error('Passwords do not match');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  console.log('\nAdd this to bmad-orchestrator.secrets.yaml under password_users:\n');
  console.log(`  - email: "${email}"`);
  console.log(`    password_hash: "${hash}"`);

  rl.close();
}

main();
```

### User ID Format

| Auth Method | user_id Format | Example |
|-------------|----------------|---------|
| GitHub OAuth | `github:{username}` | `github:octocat` |
| Password | `password:{email}` | `password:admin@example.com` |

This allows distinguishing between auth methods in sessions and audit logs.

### Security Considerations

1. **Never log passwords** - Not even hashes in most cases
2. **Same error message** - Don't reveal if email exists or password is wrong
3. **bcrypt async** - Use async bcrypt functions (not sync) to avoid blocking
4. **Rate limiting** - Essential to prevent brute force attacks
5. **Strong passwords** - Minimum 8 characters (CLI enforces this)

### Audit Log Events

| Event | action | details |
|-------|--------|---------|
| Successful login | `login` | `{ method: 'password', email }` |
| Failed login | `login_failed` | `{ method: 'password', email, reason: 'invalid_credentials' }` |
| Rate limited | `rate_limited` | `{ ip, endpoint: '/auth/login', attempts }` |
| User created | `user_created` | `{ email }` (via CLI) |

### Dependencies on Previous Stories

- **Story 1.2 (SQLite)** - Sessions table for storing refresh tokens
- **Story 1.3 (Secrets)** - Loading password_users from secrets file
- **Story 1.4 (JWT)** - Reuse token creation functions

### References

- [Source: architecture.md#Authentication & Security]
- [Source: architecture.md#Fallback Auth]
- [Source: prd.md#FR25 Session Management]
- [Source: project-context.md#Authentication Flow]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Implemented complete password fallback authentication system
- All 8 acceptance criteria satisfied with tests
- Created bcrypt-based password hashing with cost factor 10
- Implemented POST /auth/login route with email/password authentication
- Added in-memory rate limiting (5 attempts per 15 minutes per IP)
- Added audit logging for login success, failure, and rate limiting
- Created CLI script `npm run create-user` for creating password users
- Session creation reuses Story 1.4 infrastructure with `githubToken: null`
- Same error message returned for invalid email AND invalid password (prevents enumeration)
- 33 tests total (30 core + 3 scripts/create-user.test.js)

### File List

**New Files:**
- src/auth/password.js - Password hashing and user lookup
- src/auth/password.test.js - Tests for password module
- src/auth/login.js - Authentication logic (authenticatePassword, isValidEmail)
- src/auth/login.test.js - Tests for login logic
- src/auth/rate-limiter.js - In-memory rate limiter (checkRateLimit, rateLimitMiddleware)
- src/auth/rate-limiter.test.js - Tests for rate limiter
- src/auth/audit.js - Audit logging functions
- src/auth/audit.test.js - Tests for audit logging
- scripts/create-user.js - CLI script for creating password users
- scripts/create-user.test.js - Tests for create-user helpers
- vitest.config.js - Vitest test configuration

**Modified Files:**
- package.json - Added bcrypt, vitest, test scripts, create-user script
- src/auth/routes.js - Added login route using login.js and rate-limiter.js modules
- src/auth/index.js - Exports for password, login, rate-limiter, audit modules

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Add production warning for JWT_SECRET fallback [src/auth/jwt.js:8]

## Change Log

- 2026-01-15: Implemented password fallback authentication (Story 1.5)
- 2026-01-15: Code review fixes - refactored routes.js to use login.js and rate-limiter.js modules, updated index.js exports, fixed vitest config to include scripts tests

