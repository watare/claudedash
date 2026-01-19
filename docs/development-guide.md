# BMAD Orchestrator - Development Guide

**Generated**: 2026-01-19

## Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Claude Code CLI**: Installed and authenticated
- **Git**: For version control

Optional:
- **GitHub OAuth App**: For OAuth login
- **Anthropic API Key**: For Supervisor AI feature

## Quick Start

```bash
# Clone repository
git clone <repo-url>
cd bmad-orchestrator

# Install server dependencies
npm install

# Install dashboard dependencies
cd dashboard && npm install && cd ..

# Configure secrets (optional but recommended)
cp bmad-orchestrator.secrets.example.yaml bmad-orchestrator.secrets.yaml
# Edit with your credentials

# Build dashboard
cd dashboard && npm run build && cd ..

# Start server
npm start
```

Server will be available at: http://localhost:3456

## Development Mode

### Server with Auto-reload

```bash
npm run dev
```

### Dashboard Dev Server

```bash
cd dashboard
npm run dev
```

Dashboard dev server runs on port 5173 with HMR.

## Configuration

### Main Configuration: `bmad-orchestrator.yaml`

```yaml
# Batch size for parallel epic execution
batchSize: 2

# Base branch for PRs
baseBranch: main

# Claude settings
claudeModel: opus
claudeTimeout: 600000  # 10 minutes

# Stuck detection threshold
stuckThresholdMinutes: 30

# Max parallel stories per epic
maxParallelStories: 3
```

### Secrets: `bmad-orchestrator.secrets.yaml`

```yaml
# GitHub OAuth (for OAuth login)
github:
  client_id: "your_github_oauth_app_client_id"
  client_secret: "your_github_oauth_app_client_secret"

# Allowed GitHub usernames (OAuth whitelist)
allowed_users:
  - "your_github_username"

# Supervisor AI (optional)
anthropic:
  api_key: "sk-ant-api03-..."
```

## Running Tests

### All Tests

```bash
# Server tests
npm test

# Dashboard tests
cd dashboard && npm test
```

### Watch Mode

```bash
# Server
npm run test:watch

# Dashboard
cd dashboard && npm run test:watch
```

## Project Structure Overview

```
bmad-orchestrator/
├── src/                    # Backend server
│   ├── server.js           # Main entry point
│   ├── api/                # REST API routes
│   ├── services/           # Business logic
│   ├── auth/               # Authentication
│   └── db/                 # Database layer
├── dashboard/              # React frontend
│   └── src/
│       ├── pages/          # Route components
│       ├── components/     # UI components
│       └── stores/         # Zustand stores
└── docs/                   # Documentation
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create route handler in `src/api/<resource>.js`
2. Register router in `src/server.js`
3. Add tests in `src/api/<resource>.test.js`

```javascript
// src/api/example.js
import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ data: [] });
});

export default router;
```

### Adding a New Service

1. Create service in `src/services/<service>.js`
2. Export functions for business logic
3. Add tests in `src/services/<service>.test.js`

### Adding a Dashboard Component

1. Create component in `dashboard/src/components/<category>/<Name>.tsx`
2. Add tests in `dashboard/src/components/<category>/<Name>.test.tsx`
3. Use existing UI primitives from `components/ui/`

### Adding a Zustand Store

1. Create store in `dashboard/src/stores/<name>Store.ts`
2. Follow existing store patterns

```typescript
import { create } from 'zustand';

interface ExampleState {
  items: string[];
  fetchItems: () => Promise<void>;
}

export const useExampleStore = create<ExampleState>((set) => ({
  items: [],
  fetchItems: async () => {
    const response = await fetch('/api/example');
    const data = await response.json();
    set({ items: data.items });
  },
}));
```

## Database Migrations

Migrations are in `src/db/migrations/` and run automatically on startup.

To add a new migration:
1. Create `src/db/migrations/XXX_description.sql`
2. Use sequential numbering (e.g., `005_new_table.sql`)
3. Restart server to apply

## Building for Production

```bash
# Build dashboard
cd dashboard && npm run build && cd ..

# The built files go to public/dashboard/
# Server serves them automatically
```

## Running as systemd Service

```bash
# Install service file
npm run install:service

# Enable and start
npm run enable:service
npm run start:service

# View logs
npm run logs:service

# Check status
npm run status:service
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3456 | Server port |
| `DASH_USER` | admin | Basic auth username |
| `DASH_PASS` | bmad2024 | Basic auth password |
| `NODE_ENV` | development | Environment mode |
| `SUPERVISOR_TIMEOUT_MS` | 30000 | Supervisor AI timeout |

## Debugging

### Server Logs

Logs are output to console and can be viewed:
- In terminal when running `npm run dev`
- Via `journalctl` when running as service
- In dashboard Log Viewer panel

### Agent Output

Agent output is captured and available via:
- WebSocket events (`agent:output`)
- REST API (`GET /api/logs?agentId=<id>`)
- Dashboard Log Viewer

### Database

SQLite database file: `orchestrator.db`

Use any SQLite client to inspect:
```bash
sqlite3 orchestrator.db
.tables
SELECT * FROM execution_runs;
```

## Code Style

- **Backend**: JavaScript (ESM), no TypeScript
- **Dashboard**: TypeScript with strict mode
- **Linting**: ESLint configured for both
- **Formatting**: Standard formatting (no Prettier)

## Testing Guidelines

- Co-locate tests with source files
- Use `.test.js` / `.test.tsx` suffix
- Mock external dependencies (API, file system)
- Test both success and error paths

## Contributing

1. Create feature branch from `main`
2. Make changes with tests
3. Run `npm test` in both server and dashboard
4. Submit PR with description of changes
