---
project_name: 'bmad-orchestrator'
user_name: 'Ubuntu'
date: '2026-01-15'
sections_completed: ['technology_stack', 'critical_rules', 'patterns', 'testing', 'anti_patterns']
existing_patterns_found: 25
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Backend (Existing)
| Technology | Version | Notes |
|------------|---------|-------|
| Node.js | 18+ | **ES Modules** (`"type": "module"`) |
| Express | 4.18.x | REST API server |
| ws | 8.16.x | WebSocket for real-time |
| execa | 8.0.x | Claude CLI subprocess spawning |
| p-queue | 8.0.x | Parallel execution management |
| js-yaml | 4.1.x | YAML parsing for status files |
| commander | 12.x | CLI argument parsing |
| chalk | 5.3.x | Terminal colors |

### Frontend (New - To Be Added)
| Technology | Version | Notes |
|------------|---------|-------|
| React | 19.x | With concurrent features |
| Vite | 6.x | Build tool with `@tailwindcss/vite` plugin |
| TypeScript | 5.7+ | Strict mode enabled |
| Tailwind CSS | 4.x | New `@import "tailwindcss"` syntax |
| shadcn/ui | Latest | Radix primitives + Tailwind |
| Zustand | 5.x | State management |
| React Router | 6.x | Client-side routing |

### Database (New - To Be Added)
| Technology | Version | Notes |
|------------|---------|-------|
| better-sqlite3 | Latest | Synchronous SQLite for Node.js |
| jsonwebtoken | Latest | JWT creation/verification |

---

## Critical Implementation Rules

### 1. ES Modules - CRITICAL

This project uses ES Modules. **NEVER use CommonJS syntax.**

```javascript
// ✅ CORRECT - ES Modules
import express from 'express';
import { WebSocketServer } from 'ws';
export const myFunction = () => {};
export default class MyClass {}

// ❌ WRONG - CommonJS (will break)
const express = require('express');
module.exports = myFunction;
```

### 2. File Extensions in Imports

When importing local files, include the `.js` extension:

```javascript
// ✅ CORRECT
import { loadConfig } from './config.js';
import { Orchestrator } from './orchestrator.js';

// ❌ WRONG (will fail in Node.js ES Modules)
import { loadConfig } from './config';
```

### 3. Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| **Backend files** | kebab-case.js | `claude-runner.js`, `epic-worker.js` |
| **React components** | PascalCase.tsx | `ProjectCard.tsx`, `AgentPanel.tsx` |
| **Zustand stores** | camelCase + Store suffix | `authStore.ts`, `projectsStore.ts` |
| **SQL tables** | snake_case, plural | `sessions`, `audit_logs` |
| **SQL columns** | snake_case | `user_id`, `created_at` |
| **API endpoints** | lowercase, plural | `/api/projects`, `/api/agents` |
| **TypeScript types** | PascalCase | `User`, `Project`, `AgentStatus` |

### 4. API Response Format - ALWAYS USE THIS

```javascript
// ✅ Success response
res.json({
  data: { /* payload */ },
  meta: { timestamp: new Date().toISOString() }
});

// ✅ List response
res.json({
  data: [ /* items */ ],
  meta: { total: 10, page: 1, limit: 20 }
});

// ✅ Error response
res.status(400).json({
  error: 'Human-readable message',
  code: 'ERROR_CODE',
  details: { /* optional */ }
});

// ❌ WRONG - inconsistent formats
res.json({ success: true, users: [...] });
res.json({ message: 'ok' });
```

### 5. Error Handling Pattern

**Backend (wrap all async routes):**
```javascript
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Usage
app.get('/api/projects', asyncHandler(async (req, res) => {
  const projects = await getProjects();
  res.json({ data: projects });
}));
```

**Frontend (Zustand stores):**
```typescript
const useProjectsStore = create<ProjectsState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    try {
      set({ isLoading: true, error: null });
      const data = await api.get('/projects');
      set({ items: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      });
    }
  }
}));
```

### 6. WebSocket Message Format

All WebSocket messages must follow this structure:

```typescript
interface WSMessage {
  type: string;      // Format: '{entity}:{action}' e.g., 'agent:spawn'
  data: unknown;     // Payload
  timestamp?: string; // ISO 8601
}

// Examples
{ type: 'agent:spawn', data: { agentId: '1-3', story: 'Setup auth' } }
{ type: 'project:update', data: { id: 'proj1', status: 'running' } }
{ type: 'story:verified', data: { id: '1-3', result: 'pass' } }
```

### 7. Authentication Flow

1. Primary: GitHub OAuth SSO
2. Fallback: Email/password with JWT
3. Tokens stored in HTTP-only cookies (not localStorage)
4. Access token: 15min expiry
5. Refresh token: 7 days, stored in SQLite

```javascript
// Check auth in middleware
const authMiddleware = async (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};
```

---

## Code Organization Rules

### Backend Structure
```
src/
├── server.js          # Entry point - Express + WebSocket setup
├── orchestrator.js    # Core orchestration logic
├── auth/              # Auth module (GitHub OAuth + password)
│   ├── index.js       # Exports
│   ├── github.js      # OAuth handler
│   ├── password.js    # Password fallback
│   ├── jwt.js         # Token management
│   └── middleware.js  # Auth middleware
├── db/                # Database module
│   ├── sqlite.js      # Connection
│   └── migrations/    # Schema files
└── api/               # REST routes
    ├── index.js       # Route aggregator
    └── *.js           # Individual route files
```

### Frontend Structure
```
dashboard/src/
├── components/
│   ├── ui/            # shadcn/ui primitives (don't modify)
│   ├── layout/        # Header, Sidebar, Layout
│   ├── auth/          # LoginForm, GitHubButton
│   ├── projects/      # Project-related components
│   └── agents/        # Agent-related components
├── stores/            # One Zustand store per domain
├── services/          # API clients
├── hooks/             # Custom React hooks
├── types/             # TypeScript types
└── pages/             # Route pages
```

### Test Co-location

Tests live next to their source files:

```
components/
├── ProjectCard.tsx
├── ProjectCard.test.tsx    # ✅ Co-located
└── ...

# NOT in a separate __tests__ folder
```

---

## Patterns from Optigo to Reuse

When implementing auth components, reference these Optigo files:

| Optigo File | Purpose | Adapt For |
|-------------|---------|-----------|
| `frontend/src/services/auth.ts` | Auth service with refresh | `dashboard/src/services/auth.ts` |
| `frontend/src/stores/authStore.ts` | Zustand auth state | `dashboard/src/stores/authStore.ts` |
| `frontend/src/components/auth/LoginForm.tsx` | Login UI | `dashboard/src/components/auth/LoginForm.tsx` |

**Key patterns to preserve:**
- Rate limiting on auth endpoints (5 req/15min)
- HTTP-only cookies for refresh tokens
- Automatic token refresh on 401
- Loading/error state pattern in stores

---

## Anti-Patterns - DO NOT DO THESE

### 1. CommonJS in this project
```javascript
// ❌ NEVER
const x = require('x');
module.exports = y;
```

### 2. localStorage for auth tokens
```javascript
// ❌ Security risk
localStorage.setItem('token', jwt);
```

### 3. Inconsistent API responses
```javascript
// ❌ Don't mix formats
res.json({ success: true, data: [...] });
res.json({ users: [...] });
res.json({ result: 'ok' });
```

### 4. Missing file extension in imports
```javascript
// ❌ Will fail in Node.js ES Modules
import { foo } from './utils';
```

### 5. Direct state mutation in Zustand
```typescript
// ❌ WRONG
set((state) => { state.items.push(item); });

// ✅ CORRECT - immutable update
set((state) => ({ items: [...state.items, item] }));
```

### 6. Hardcoded URLs
```javascript
// ❌ WRONG
fetch('http://localhost:3456/api/projects');

// ✅ CORRECT - use environment variable
fetch(`${import.meta.env.VITE_API_URL}/api/projects`);
```

---

## Development Commands

```bash
# Backend development
npm run dev              # Start with file watching

# Dashboard development (after setup)
npm run dev:dashboard    # Vite dev server with HMR

# Build for production
npm run build:dashboard  # Build React app to public/

# Production
npm start               # NODE_ENV=production

# Systemd service
npm run start:service   # Start daemon
npm run logs:service    # View logs
```

---

## Quick Reference Card

| When You Need To... | Do This |
|---------------------|---------|
| Import local file | `import { x } from './file.js'` (with .js) |
| Create API response | `{ data: ..., meta: { timestamp } }` |
| Handle async route | Wrap with `asyncHandler()` |
| Store auth token | HTTP-only cookie via `res.cookie()` |
| Send WebSocket msg | `{ type: 'entity:action', data: ... }` |
| Create Zustand store | `use{Domain}Store` with `isLoading`, `error` |
| Name SQL table | snake_case, plural: `audit_logs` |
| Name React component | PascalCase: `ProjectCard.tsx` |
| Write test file | Co-locate: `Component.test.tsx` |

---

**Document Maintenance:** Update this file when new critical patterns emerge during implementation.
