# Story 1.6: Auth Frontend Components

Status: done

## Story

As a **user**,
I want **a login page with GitHub OAuth button and password form**,
So that **I can choose my preferred authentication method**.

## Acceptance Criteria

1. **Given** I visit the dashboard unauthenticated
   **When** the login page loads
   **Then** I see a "Sign in with GitHub" button (primary, gold)

2. **Given** I am on the login page
   **When** I look for alternatives
   **Then** I see an email/password form below as alternative

3. **Given** I am on the login page
   **When** I inspect the styling
   **Then** the page uses the dark theme (#0B0E11 background)

4. **Given** the login page
   **When** I view on different screen sizes
   **Then** the layout is centered and responsive

5. **Given** I click "Sign in with GitHub"
   **When** the button is pressed
   **Then** I am redirected to GitHub OAuth flow

6. **Given** I am entering credentials
   **When** validation fails (empty fields, invalid email format)
   **Then** inline error messages appear without page reload

## Tasks / Subtasks

- [x] Task 1: Create Login page component (AC: #1, #2, #3, #4)
  - [x] Create `dashboard/src/pages/Login.tsx`
  - [x] Implement centered layout with dark background
  - [x] Add bmad-orchestrator logo/title at top
  - [x] Use Tailwind for responsive design
  - [x] Apply Binance-inspired styling

- [x] Task 2: Create GitHubButton component (AC: #1, #5)
  - [x] Create `dashboard/src/components/auth/GitHubButton.tsx`
  - [x] Style as primary button (gold background, dark text)
  - [x] Include GitHub icon from Lucide
  - [x] On click: redirect to `/auth/github` backend endpoint
  - [x] Add loading state during redirect

- [x] Task 3: Create LoginForm component (AC: #2, #6)
  - [x] Create `dashboard/src/components/auth/LoginForm.tsx`
  - [x] Include email input field with validation
  - [x] Include password input field
  - [x] Include submit button (secondary styling)
  - [x] Implement client-side validation before submit

- [x] Task 4: Implement form validation (AC: #6)
  - [x] Validate email format (contains @)
  - [x] Validate password not empty
  - [x] Show inline error messages below fields
  - [x] Use red text for errors (#F6465D)
  - [x] Clear errors when user starts typing

- [x] Task 5: Create auth service (AC: #5)
  - [x] Create `dashboard/src/services/auth.ts`
  - [x] Implement `login(email, password)` function
  - [x] Implement `getGitHubAuthUrl()` function
  - [x] Handle API responses and errors
  - [x] Store access token on successful login

- [x] Task 6: Create authStore (Zustand)
  - [x] Create `dashboard/src/stores/authStore.ts`
  - [x] State: `user`, `isAuthenticated`, `isLoading`, `error`
  - [x] Actions: `login`, `logout`, `clearError`, `setUser`
  - [x] Follow Zustand pattern from project-context.md

- [x] Task 7: Style components with Tailwind
  - [x] Apply dark theme background to login page
  - [x] Style form inputs (dark backgrounds, light borders)
  - [x] Add focus states with gold accent
  - [x] Add hover states for buttons
  - [x] Ensure WCAG 2.1 AA contrast compliance

- [x] Task 8: Add form loading/error states
  - [x] Show spinner on submit button during API call
  - [x] Disable form while loading
  - [x] Show API error message on failure
  - [x] Handle rate limiting (429) with user-friendly message

- [x] Task 9: Create test file
  - [x] Create `dashboard/src/components/auth/LoginForm.test.tsx`
  - [x] Test form validation
  - [x] Test error display
  - [x] Test submit handling

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Update File List to include `dashboard/src/services/api.ts` - critical dependency used by authStore [authStore.ts:2]
- [x] [AI-Review][MEDIUM] Update File List to include `dashboard/src/components/auth/ProtectedRoute.tsx` - undocumented new component
- [x] [AI-Review][MEDIUM] Update File List to include `dashboard/src/components/auth/ProtectedRoute.test.tsx` - undocumented test file
- [x] [AI-Review][MEDIUM] Refactor authStore.login to delegate to authService.login instead of reimplementing fetch logic (DRY violation) [authStore.ts:37-67, auth.ts:17-34]
- [x] [AI-Review][MEDIUM] Add error handling/timeout for GitHubButton redirect - loading state never clears if redirect fails [GitHubButton.tsx:10-12]
- [x] [AI-Review][LOW] Add test for GitHubButton loading spinner visibility [GitHubButton.test.tsx]
- [x] [AI-Review][LOW] Update comment in GitHubButton to be more accurate about OAuth endpoint source [GitHubButton.tsx:11]

## Dev Notes

### Critical Implementation Rules

1. **TypeScript** - All components must be TypeScript (.tsx)
2. **PascalCase** - Component files use PascalCase naming
3. **Co-located Tests** - Test files next to source files
4. **Zustand Pattern** - Follow established store pattern with isLoading/error
5. **No localStorage Tokens** - Tokens are stored in HTTP-only cookies by backend

### Component File Structure

```
dashboard/src/
├── components/
│   └── auth/
│       ├── GitHubButton.tsx
│       ├── GitHubButton.test.tsx
│       ├── LoginForm.tsx
│       └── LoginForm.test.tsx
├── pages/
│   └── Login.tsx
├── services/
│   └── auth.ts
└── stores/
    └── authStore.ts
```

### Login Page Layout

```
+-----------------------------------------------+
|                                               |
|        bmad-orchestrator                      |
|        [logo/title]                           |
|                                               |
|    +-----------------------------------+      |
|    |  [ Sign in with GitHub ]  (gold)  |      |
|    +-----------------------------------+      |
|                                               |
|    ─────────── or ───────────                 |
|                                               |
|    +-----------------------------------+      |
|    |  Email                            |      |
|    |  [_________________________]      |      |
|    |                                   |      |
|    |  Password                         |      |
|    |  [_________________________]      |      |
|    |                                   |      |
|    |  [    Sign In    ]  (secondary)   |      |
|    +-----------------------------------+      |
|                                               |
+-----------------------------------------------+
```

### GitHubButton Component

```tsx
// dashboard/src/components/auth/GitHubButton.tsx
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function GitHubButton() {
  const handleClick = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = '/auth/github';
  };

  return (
    <Button
      onClick={handleClick}
      className="w-full bg-[#F0B90B] text-[#0B0E11] hover:bg-[#F0B90B]/90"
    >
      <Github className="mr-2 h-5 w-5" />
      Sign in with GitHub
    </Button>
  );
}
```

### LoginForm Component Pattern

```tsx
// dashboard/src/components/auth/LoginForm.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login, isLoading, error } = useAuthStore();

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!email.includes('@')) newErrors.email = 'Invalid email format';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await login(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form fields */}
    </form>
  );
}
```

### authStore Pattern (Zustand)

```typescript
// dashboard/src/stores/authStore.ts
import { create } from 'zustand';
import { authService } from '@/services/auth';

interface User {
  userId: string;
  username?: string;
  email?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authService.login(email, password);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false
      });
    }
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user, isAuthenticated: true }),
  clearError: () => set({ error: null })
}));
```

### Auth Service Pattern

```typescript
// dashboard/src/services/auth.ts
const API_URL = import.meta.env.VITE_API_URL || '';

export const authService = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'  // Include cookies
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    return response.json();
  },

  async logout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  },

  getGitHubAuthUrl() {
    return `${API_URL}/auth/github`;
  }
};
```

### Styling Guidelines

| Element | Style |
|---------|-------|
| Page background | `bg-[#0B0E11]` |
| Card/form background | `bg-[#1E2329]` |
| Input background | `bg-[#2B3139]` |
| Input border | `border-[#2B3139]` |
| Input focus border | `border-[#F0B90B]` |
| Primary button | `bg-[#F0B90B] text-[#0B0E11]` |
| Secondary button | `bg-transparent border-[#F0B90B] text-[#F0B90B]` |
| Error text | `text-[#F6465D]` |
| Primary text | `text-[#EAECEF]` |
| Secondary text | `text-[#848E9C]` |

### Validation Rules

| Field | Validation |
|-------|------------|
| Email | Required, must contain `@` |
| Password | Required, no minimum length on frontend (backend enforces) |

### Error Messages

| Error | Message |
|-------|---------|
| Email empty | "Email is required" |
| Email invalid | "Invalid email format" |
| Password empty | "Password is required" |
| API error | "Invalid email or password" |
| Rate limited | "Too many attempts. Please try again later." |

### Dependencies on Previous Stories

- **Story 1.1 (Dashboard Scaffolding)** - Vite, React, Tailwind, shadcn components
- **Story 1.4 (GitHub OAuth)** - Backend `/auth/github` endpoint
- **Story 1.5 (Password Auth)** - Backend `/auth/login` endpoint

### References

- [Source: architecture.md#Frontend Architecture]
- [Source: architecture.md#Zustand Stores]
- [Source: ux-design-specification.md#Color System (Binance-Inspired)]
- [Source: ux-design-specification.md#Button Hierarchy]
- [Source: project-context.md#Naming Conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Added `noValidate` to form to allow custom validation to work with `type="email"` inputs

### Completion Notes List

- Implemented Login page with centered layout, dark theme (#0B0E11), and responsive design
- Created GitHubButton component with Lucide icon, gold styling, and loading state on redirect
- Created LoginForm component with email/password fields, client-side validation, and error handling
- Created authStore using Zustand with user state, isAuthenticated, isLoading, error, and actions
- Created authService with login(), logout(), checkAuth(), and getGitHubAuthUrl() methods
- Updated Button component to support isLoading prop and Binance theme colors
- Updated Input component to support error prop for validation state
- All tests passing (13 tests across 2 test files)
- Form uses `noValidate` to allow custom validation before browser validation

### File List

- dashboard/src/pages/Login.tsx (new)
- dashboard/src/components/auth/GitHubButton.tsx (new)
- dashboard/src/components/auth/GitHubButton.test.tsx (new)
- dashboard/src/components/auth/LoginForm.tsx (new)
- dashboard/src/components/auth/LoginForm.test.tsx (new)
- dashboard/src/components/auth/ProtectedRoute.tsx (new) [added by review]
- dashboard/src/components/auth/ProtectedRoute.test.tsx (new) [added by review]
- dashboard/src/services/auth.ts (new)
- dashboard/src/services/api.ts (new) [added by review - token management]
- dashboard/src/stores/authStore.ts (new)
- dashboard/src/components/ui/button.tsx (modified - added isLoading, Binance theme)
- dashboard/src/components/ui/input.tsx (modified - added error prop)
- dashboard/src/test/setup.ts (new)
- dashboard/vitest.config.ts (new)
- dashboard/tsconfig.app.json (modified - added path aliases)
- dashboard/package.json (modified - added test scripts)

## Change Log

- 2026-01-15: Implemented auth frontend components including Login page, GitHubButton, LoginForm, authStore, and authService with full test coverage
- 2026-01-15: Code review completed - 7 action items created (1 HIGH, 4 MEDIUM, 2 LOW). File List updated with 3 missing files. Status → in-progress
- 2026-01-15: All review items fixed - refactored authStore to use authService (DRY), added GitHubButton timeout handling, added loading spinner test. 47 tests passing. Status → done

