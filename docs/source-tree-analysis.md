# BMAD Orchestrator - Source Tree Analysis

**Generated**: 2026-01-19
**Scan Level**: Exhaustive

## Complete Directory Structure

```
bmad-orchestrator/
├── src/                           # Backend server (Node.js/Express)
│   ├── server.js                  # ★ Main entry point - DashboardServer class + CLI
│   ├── orchestrator.js            # ★ Core orchestration - parallel epic/story execution
│   ├── claude-runner.js           # ★ PTY-based Claude CLI execution
│   ├── parser.js                  # BMAD file parsers (epics.md, sprint-status.yaml)
│   ├── config.js                  # Configuration loader and validation
│   │
│   ├── api/                       # REST API route handlers
│   │   ├── projects.js            # /api/projects endpoints
│   │   ├── agents.js              # /api/agents endpoints
│   │   ├── stories.js             # /api/stories endpoints
│   │   ├── history.js             # /api/history endpoints
│   │   ├── logs.js                # /api/audit-logs endpoints
│   │   └── *.test.js              # API tests
│   │
│   ├── services/                  # Business logic services
│   │   ├── projects.js            # Project discovery and status
│   │   ├── agents.js              # Agent management (getAgentsByProject)
│   │   ├── supervisorAI.js        # Claude 3.5 Haiku for question handling
│   │   ├── agentRegistry.js       # Active agent tracking
│   │   ├── agentKiller.js         # Agent termination logic
│   │   ├── websocket.js           # WebSocket broadcast utilities
│   │   ├── stuckDetector.js       # Stuck agent detection
│   │   ├── historyRecorder.js     # Execution history recording
│   │   ├── verification.js        # Story verification service
│   │   ├── storyRetrier.js        # Failed story retry logic
│   │   ├── storyTracker.js        # Story progress tracking
│   │   ├── fileWatcher.js         # File change activity detection
│   │   ├── interactiveRunner.js   # Interactive mode runner
│   │   └── *.test.js              # Service tests
│   │
│   ├── auth/                      # Authentication modules
│   │   ├── index.js               # Auth module exports
│   │   ├── routes.js              # /auth/* route handlers
│   │   ├── login.js               # Password login logic
│   │   ├── github.js              # GitHub OAuth integration
│   │   ├── jwt.js                 # JWT token utilities
│   │   ├── session.js             # Session management
│   │   ├── middleware.js          # Express auth middleware
│   │   ├── password.js            # Password hashing (bcrypt)
│   │   ├── rate-limiter.js        # Login rate limiting
│   │   ├── audit.js               # Security audit logging
│   │   └── *.test.js              # Auth tests
│   │
│   ├── db/                        # Database layer
│   │   ├── index.js               # DB initialization
│   │   ├── sqlite.js              # SQLite connection
│   │   ├── storyLogs.js           # Story log queries
│   │   ├── agentLogs.js           # Agent log queries
│   │   └── migrations/            # SQL migration files
│   │       ├── 001_sessions.sql
│   │       ├── 002_audit_log.sql
│   │       ├── 003_verification_audit_logs.sql
│   │       └── 004_execution_history.sql
│   │
│   └── config/                    # Configuration utilities
│       ├── index.js               # Config loading
│       └── secrets.js             # Secrets file handling
│
├── dashboard/                     # React frontend (TypeScript)
│   ├── src/
│   │   ├── main.tsx               # ★ React entry point
│   │   ├── App.tsx                # ★ Main app with routing
│   │   │
│   │   ├── pages/                 # Route-level components
│   │   │   ├── Login.tsx          # Login page
│   │   │   ├── ProjectView.tsx    # Project detail page
│   │   │   └── History.tsx        # Execution history page
│   │   │
│   │   ├── components/            # Reusable UI components
│   │   │   ├── ui/                # Base UI primitives
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── alert-dialog.tsx
│   │   │   │   ├── sheet.tsx
│   │   │   │   ├── sonner.tsx
│   │   │   │   ├── StatusDot.tsx
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   └── StoryStatusBadge.tsx
│   │   │   │
│   │   │   ├── layout/            # Layout components
│   │   │   │   ├── Layout.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── MainContent.tsx
│   │   │   │
│   │   │   ├── auth/              # Authentication components
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── GitHubButton.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   │
│   │   │   ├── projects/          # Project-related components
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── EpicList.tsx
│   │   │   │   ├── EpicCard.tsx
│   │   │   │   ├── StoryList.tsx
│   │   │   │   ├── StoryDetail.tsx
│   │   │   │   └── ConfirmStopDialog.tsx
│   │   │   │
│   │   │   ├── agents/            # Agent-related components
│   │   │   │   ├── AgentPanel.tsx
│   │   │   │   ├── AgentRow.tsx
│   │   │   │   ├── KillButton.tsx
│   │   │   │   ├── ConfirmKillDialog.tsx
│   │   │   │   └── StuckAgentIndicator.tsx
│   │   │   │
│   │   │   ├── logs/              # Log viewer components
│   │   │   │   ├── LogViewerPanel.tsx
│   │   │   │   ├── LogLine.tsx
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   └── FilterBar.tsx
│   │   │   │
│   │   │   ├── history/           # History components
│   │   │   │   ├── HistoryList.tsx
│   │   │   │   ├── HistoryFilters.tsx
│   │   │   │   ├── EventTimeline.tsx
│   │   │   │   └── RunDetailPanel.tsx
│   │   │   │
│   │   │   ├── status/            # Status display components
│   │   │   │   ├── StatusIndicator.tsx
│   │   │   │   ├── VerificationBadge.tsx
│   │   │   │   └── VerificationStatus.tsx
│   │   │   │
│   │   │   └── stories/           # Story-specific components
│   │   │       └── RetryButton.tsx
│   │   │
│   │   └── stores/                # Zustand state stores
│   │       ├── authStore.ts
│   │       ├── projectsStore.ts
│   │       ├── agentsStore.ts
│   │       ├── logsStore.ts
│   │       └── wsStore.ts
│   │
│   ├── package.json               # Frontend dependencies
│   ├── tsconfig.json              # TypeScript config
│   ├── vite.config.ts             # Vite build config
│   └── eslint.config.js           # ESLint config
│
├── public/                        # Static assets
│   ├── index.html                 # Fallback HTML
│   └── dashboard/                 # Built dashboard assets (after npm run build)
│
├── docs/                          # Generated documentation
│   ├── adr/                       # Architecture Decision Records
│   │   └── ADR-001-supervisor-ai.md
│   ├── project-overview.md
│   ├── architecture.md
│   ├── api-contracts.md
│   ├── data-models.md
│   ├── source-tree-analysis.md
│   ├── development-guide.md
│   └── index.md
│
├── scripts/                       # Utility scripts
│   └── create-user.js             # Create local user accounts
│
├── _bmad/                         # BMAD configuration (installed module)
├── _bmad-output/                  # BMAD workflow outputs
│
├── package.json                   # Server dependencies
├── bmad-orchestrator.yaml         # Main configuration file
├── bmad-orchestrator.secrets.yaml # Secrets file (gitignored)
├── bmad-orchestrator.service      # systemd service file
├── CHANGELOG.md                   # Version history
└── README.md                      # Project documentation
```

## Critical Entry Points

| Entry Point | File | Description |
|-------------|------|-------------|
| **Server Start** | `src/server.js` | CLI entry, creates DashboardServer |
| **Dashboard App** | `dashboard/src/main.tsx` | React app mount point |
| **Orchestration** | `src/orchestrator.js` | Orchestrator.run() method |
| **Agent Execution** | `src/claude-runner.js` | runClaude() function |

## Key Integration Points

### Backend ← → Dashboard

| Backend File | Frontend File | Integration |
|--------------|---------------|-------------|
| `src/server.js` (WebSocket) | `stores/wsStore.ts` | Real-time events |
| `api/projects.js` | `stores/projectsStore.ts` | Project CRUD |
| `api/agents.js` | `stores/agentsStore.ts` | Agent management |
| `auth/routes.js` | `stores/authStore.ts` | Authentication |

### Backend ← → External

| Backend File | External System | Integration |
|--------------|-----------------|-------------|
| `src/claude-runner.js` | Claude CLI | PTY spawn |
| `services/supervisorAI.js` | Anthropic API | Claude 3.5 Haiku |
| `auth/github.js` | GitHub API | OAuth flow |
| `services/projects.js` | File System | Project discovery |

## Test Coverage

Tests co-located with source files using `.test.js` / `.test.tsx` suffix:
- **Backend**: 30+ test files in `src/` directories
- **Dashboard**: 25+ test files in `dashboard/src/` directories
- **Test Framework**: Vitest + Testing Library

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Server dependencies |
| `dashboard/package.json` | Dashboard dependencies |
| `bmad-orchestrator.yaml` | Runtime configuration |
| `bmad-orchestrator.secrets.yaml` | API keys, OAuth credentials |
| `tsconfig.json` | Dashboard TypeScript config |
| `vite.config.ts` | Dashboard build config |
