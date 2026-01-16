# Story 1.7: Protected Routes & Session Management

Status: done

## Story

As a **user**,
I want **my session maintained across requests with automatic refresh**,
So that **I don't have to re-login frequently** (FR25, FR26, FR27).

## Acceptance Criteria

1. **Given** I am authenticated
   **When** my access token expires (15min)
   **Then** the frontend automatically uses the refresh token to get a new access token

2. **Given** automatic token refresh
   **When** refresh succeeds
   **Then** my session continues seamlessly

3. **Given** my refresh token is expired or invalid
   **When** I try to access the dashboard
   **Then** I am redirected to the login page (FR27)

4. **Given** refresh token is invalid
   **When** redirect happens
   **Then** my session is invalidated in SQLite

5. **Given** I click "Logout"
   **When** the logout action completes
   **Then** my session is removed from SQLite (FR26)

6. **Given** logout completes
   **When** cookies are processed
   **Then** HTTP-only cookies are cleared

7. **Given** logout completes
   **When** the redirect happens
   **Then** I am redirected to the login page

8. **Given** I am on a protected route
   **When** I am not authenticated
   **Then** a `<ProtectedRoute>` component redirects me to login

## Tasks / Subtasks

- [x] Task 1: Implement token refresh endpoint (backend) (AC: #1, #2)
  - [x] Create `POST /auth/refresh` endpoint
  - [x] Read refresh token from HTTP-only cookie
  - [x] Verify refresh token is valid JWT
  - [x] Lookup session in SQLite by refresh token
  - [x] If valid: create new access token, return it
  - [x] If invalid: return 401, clear cookie

- [x] Task 2: Implement logout endpoint (backend) (AC: #5, #6, #7)
  - [x] Create `POST /auth/logout` endpoint
  - [x] Read refresh token from cookie
  - [x] Delete session from SQLite
  - [x] Clear HTTP-only cookie
  - [x] Return success response

- [x] Task 3: Implement session invalidation (AC: #4)
  - [x] Create `deleteSessionByRefreshToken(token)` in session.js
  - [x] Call on refresh failure
  - [x] Clear cookie on invalidation

- [x] Task 4: Create auth middleware (backend)
  - [x] Create `src/auth/middleware.js`
  - [x] Extract access token from Authorization header
  - [x] Verify token and attach user to request
  - [x] Return 401 if token missing or invalid
  - [x] Export `requireAuth` middleware function

- [x] Task 5: Create ProtectedRoute component (frontend) (AC: #8)
  - [x] Create `dashboard/src/components/auth/ProtectedRoute.tsx`
  - [x] Check if user is authenticated
  - [x] If not authenticated: redirect to /login
  - [x] If authenticated: render children
  - [x] Show loading state while checking auth

- [x] Task 6: Implement automatic token refresh (frontend) (AC: #1, #2)
  - [x] Create API interceptor in `dashboard/src/services/api.ts`
  - [x] On 401 response: attempt token refresh
  - [x] If refresh succeeds: retry original request
  - [x] If refresh fails: redirect to login

- [x] Task 7: Update authStore with session management
  - [x] Add `checkAuth()` action to verify current session
  - [x] Add `refreshToken()` action to refresh access token
  - [x] Add `logout()` action to call logout endpoint
  - [x] Persist auth state appropriately

- [x] Task 8: Implement getCurrentUser endpoint (backend)
  - [x] Create `GET /auth/me` endpoint
  - [x] Require authentication (use middleware)
  - [x] Return current user info from token
  - [x] Used by frontend to verify auth state on app load

- [x] Task 9: Set up React Router with protected routes
  - [x] Configure routes in `App.tsx`
  - [x] Wrap dashboard routes with ProtectedRoute
  - [x] Keep /login as public route
  - [x] Handle OAuth callback route `/auth/callback`

- [x] Task 10: Implement session cleanup
  - [x] Create background job to delete expired sessions
  - [x] Run on server startup and periodically (every hour)
  - [x] Delete sessions where `expires_at < now()`

- [x] Task 11: Create tests
  - [x] Create `dashboard/src/components/auth/ProtectedRoute.test.tsx`
  - [x] Test redirect when not authenticated
  - [x] Test render children when authenticated
  - [x] Test loading state

## Dev Notes

### Critical Implementation Rules

1. **ES Modules (Backend)** - Use ES Module syntax in all backend files.
2. **TypeScript (Frontend)** - All frontend components in TypeScript.
3. **HTTP-Only Cookies** - Refresh tokens ONLY in HTTP-only cookies, never in JS.
4. **Authorization Header** - Access tokens sent in `Authorization: Bearer {token}` header.

### Token Flow Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐   │
│  │  authStore  │────▶│  api.ts     │────▶│  Requests    │   │
│  │             │     │ (interceptor)│     │              │   │
│  └─────────────┘     └──────┬──────┘     └──────────────┘   │
│                             │                                │
│                             │ 401?                           │
│                             ▼                                │
│                      POST /auth/refresh                      │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐   │
│  │ /auth/refresh│────▶│  session.js │────▶│   SQLite     │   │
│  │             │     │             │     │  sessions    │   │
│  └─────────────┘     └─────────────┘     └──────────────┘   │
│                                                              │
│  Reads refresh_token from HTTP-only cookie                   │
│  Returns new access_token in response body                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Auth Middleware Pattern

```javascript
// src/auth/middleware.js
import { verifyToken } from './jwt.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authorization required',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
}
```

### Refresh Endpoint Pattern

```javascript
// POST /auth/refresh
export async function refreshHandler(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      error: 'No refresh token',
      code: 'NO_REFRESH_TOKEN'
    });
  }

  try {
    // Verify JWT
    const payload = verifyToken(refreshToken);
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Lookup session in DB
    const session = await getSessionByRefreshToken(refreshToken);
    if (!session || new Date(session.expires_at) < new Date()) {
      throw new Error('Session expired');
    }

    // Create new access token
    const accessToken = createAccessToken({
      userId: payload.userId,
      username: payload.username
    });

    return res.json({
      data: { accessToken },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    // Clear invalid cookie
    res.clearCookie('refreshToken', { path: '/auth' });

    // Delete session from DB if exists
    if (refreshToken) {
      await deleteSessionByRefreshToken(refreshToken);
    }

    return res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
}
```

### ProtectedRoute Component

```tsx
// dashboard/src/components/auth/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B0E11]">
        <div className="animate-spin h-8 w-8 border-2 border-[#F0B90B] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

### API Interceptor Pattern

```typescript
// dashboard/src/services/api.ts
const API_URL = import.meta.env.VITE_API_URL || '';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  // If 401, try to refresh token
  if (response.status === 401 && endpoint !== '/auth/refresh') {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry original request with new token
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
      });
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  return response;
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) return false;

    const data = await response.json();
    accessToken = data.data.accessToken;
    return true;
  } catch {
    return false;
  }
}
```

### Route Configuration

```tsx
// dashboard/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* OAuth callback handled by backend, redirects to / */}
      </Routes>
    </BrowserRouter>
  );
}
```

### Session Cleanup Job

```javascript
// src/auth/session.js
import { getDb } from '../db/index.js';

export function deleteExpiredSessions() {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM sessions
    WHERE datetime(expires_at) < datetime('now')
  `);
  const result = stmt.run();
  console.log(`Cleaned up ${result.changes} expired sessions`);
}

// Run on startup and every hour
export function startSessionCleanup() {
  deleteExpiredSessions();
  setInterval(deleteExpiredSessions, 60 * 60 * 1000); // 1 hour
}
```

### API Endpoints Summary

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/auth/github` | GET | No | Start GitHub OAuth |
| `/auth/github/callback` | GET | No | OAuth callback |
| `/auth/login` | POST | No | Password login |
| `/auth/refresh` | POST | Cookie only | Refresh access token |
| `/auth/logout` | POST | Cookie only | Logout, clear session |
| `/auth/me` | GET | Yes | Get current user |

### Cookie Configuration Summary

| Cookie | Path | HttpOnly | Secure | SameSite | MaxAge |
|--------|------|----------|--------|----------|--------|
| `refreshToken` | `/auth` | Yes | Prod only | Lax | 7 days |

### Dependencies on Previous Stories

- **Story 1.2 (SQLite)** - Sessions table for session storage
- **Story 1.4 (JWT)** - Token creation and verification functions
- **Story 1.6 (Auth Components)** - authStore and Login page

### References

- [Source: architecture.md#Authentication Flow Pattern]
- [Source: architecture.md#API & Communication Patterns]
- [Source: prd.md#FR25 Session Management]
- [Source: prd.md#FR26 Session Invalidation]
- [Source: prd.md#FR27 Redirect to OAuth]
- [Source: project-context.md#Authentication Flow]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- No errors encountered during implementation

### Completion Notes List

- Created comprehensive auth routes module (`src/auth/routes.js`) with POST /auth/refresh, POST /auth/logout, POST /auth/login, GET /auth/github, GET /auth/github/callback, and GET /auth/me endpoints
- Implemented auth middleware (`src/auth/middleware.js`) with requireAuth and optionalAuth functions
- Added cookie-parser dependency for HTTP-only cookie handling
- Updated server.js to mount auth routes at /auth and start session cleanup job
- Created ProtectedRoute component with loading state and redirect logic
- Implemented API service (`dashboard/src/services/api.ts`) with automatic token refresh interceptor
- Enhanced authStore with refreshToken, handleOAuthCallback, and improved checkAuth actions
- Updated App.tsx with protected routes and OAuth callback handling
- Created ProtectedRoute.test.tsx with 5 comprehensive tests
- All tests pass (46 dashboard tests, 30 backend vitest tests, 29 node:test tests)

### File List

**New Files:**
- src/auth/routes.js - Auth endpoints (refresh, logout, login, github, me)
- src/auth/middleware.js - requireAuth and optionalAuth middleware
- src/auth/jwt.js - JWT token creation and verification
- src/auth/jwt.test.js - JWT tests
- src/auth/session.js - SQLite session management
- src/auth/session.test.js - Session tests
- src/auth/github.js - GitHub OAuth implementation
- src/auth/github.test.js - GitHub OAuth tests
- src/auth/password.js - Password authentication
- src/auth/password.test.js - Password auth tests
- src/auth/login.js - Login helper module
- src/auth/login.test.js - Login tests
- src/auth/audit.js - Audit logging for auth events
- src/auth/audit.test.js - Audit tests
- src/auth/rate-limiter.js - Rate limiting with cleanup
- src/auth/rate-limiter.test.js - Rate limiter tests
- src/config/secrets.js - Secrets management module
- src/db/sqlite.js - SQLite database wrapper
- src/db/index.js - Database exports
- scripts/create-user.js - Password user creation script
- scripts/create-user.test.js - Script tests
- bmad-orchestrator.secrets.example.yaml - Secrets template
- dashboard/src/components/auth/ProtectedRoute.tsx - Protected route component
- dashboard/src/components/auth/ProtectedRoute.test.tsx - ProtectedRoute tests
- dashboard/src/components/auth/GitHubButton.tsx - GitHub auth button
- dashboard/src/components/auth/GitHubButton.test.tsx - GitHub button tests
- dashboard/src/components/auth/LoginForm.tsx - Login form component
- dashboard/src/components/auth/LoginForm.test.tsx - Login form tests
- dashboard/src/services/api.ts - API service with token refresh
- dashboard/src/services/api.test.ts - API service tests
- dashboard/src/test/setup.test.ts - Test framework setup
- vitest.config.js - Vitest configuration

**Modified Files:**
- src/auth/index.js - Added exports for all auth modules
- src/server.js - Added auth routes, cookie-parser, session cleanup
- src/config.js - Configuration updates
- dashboard/src/stores/authStore.ts - Enhanced with session management
- dashboard/src/App.tsx - Protected routes and OAuth handling
- package.json - Added dependencies (cookie-parser, bcrypt, better-sqlite3, jsonwebtoken)
- package-lock.json - Updated lockfile
- .gitignore - Added secrets and data files

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Clarify test count in Completion Notes: 28 setup tests + 30 component tests = 58 dashboard total [story:456]
- [ ] [AI-Review][LOW] Refactor /auth/error endpoint to avoid duplicate info in error and details.message [src/auth/routes.js:357-361]
- [ ] [AI-Review][LOW] Extract hardcoded hex colors (#0B0E11, #F0B90B, #848E9C, #EAECEF) to Tailwind theme tokens [dashboard/src/App.tsx, ProtectedRoute.tsx]

## Change Log

- 2026-01-15: Implemented all 11 tasks for protected routes and session management. Added token refresh, logout, auth middleware, ProtectedRoute component, automatic token refresh interceptor, and comprehensive tests. All acceptance criteria satisfied.
- 2026-01-15: [Code Review] Fixed: Added rate limiter memory cleanup interval. Fixed: JWT_SECRET now required in production. Added: api.ts service tests (11 tests). Updated: File List to include all 32 new files. Created: 3 LOW action items for future cleanup.

