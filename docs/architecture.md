# BMAD Orchestrator - Architecture

**Generated**: 2026-01-19

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Dashboard                             │
│  (Project Cards, Agent Panel, History, Real-time Updates)       │
│  React 19 + TypeScript + TailwindCSS + Zustand                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express Server (API)                         │
│  /api/projects  /api/agents  /api/status  /api/history          │
│  /auth/login    /auth/github /auth/me                            │
├─────────────────────────────────────────────────────────────────┤
│                      Services Layer                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐     │
│  │ Orchestrator │  │ AgentRegistry │  │ SupervisorAI       │     │
│  │ (epic/story) │  │ (tracking)    │  │ (Claude 3.5 Haiku) │     │
│  └─────────────┘  └──────────────┘  └─────────────────────┘     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐     │
│  │ WebSocket   │  │ StuckDetector │  │ HistoryRecorder    │     │
│  │ (broadcast) │  │ (timeout)     │  │ (SQLite)           │     │
│  └─────────────┘  └──────────────┘  └─────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                    Claude Runner (PTY)                           │
└─────────────────────────────────────────────────────────────────┘
              │               │               │
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Claude   │   │ Claude   │   │ Claude   │
        │ Agent 1  │   │ Agent 2  │   │ Agent N  │
        │ (PTY)    │   │ (PTY)    │   │ (PTY)    │
        └──────────┘   └──────────┘   └──────────┘
              │               │               │
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Project  │   │ Project  │   │ Project  │
        │    A     │   │    B     │   │    C     │
        └──────────┘   └──────────┘   └──────────┘
```

## Backend Architecture

### Entry Points

| File | Purpose |
|------|---------|
| `src/server.js` | Main entry - `DashboardServer` class with CLI |
| `src/orchestrator.js` | Orchestration logic - parallel epic/story execution |
| `src/claude-runner.js` | PTY-based Claude CLI execution with agent tracking |

### Service Layer

| Service | File | Responsibility |
|---------|------|----------------|
| **Orchestrator** | `orchestrator.js` | Manages parallel epic/story execution batches |
| **ClaudeRunner** | `claude-runner.js` | Spawns Claude CLI via PTY, handles questions |
| **SupervisorAI** | `services/supervisorAI.js` | Claude 3.5 Haiku for complex question handling |
| **AgentRegistry** | `services/agentRegistry.js` | Tracks active agents, enables kill functionality |
| **WebSocket** | `services/websocket.js` | Broadcasts real-time events to dashboard |
| **StuckDetector** | `services/stuckDetector.js` | Detects agents with no activity |
| **HistoryRecorder** | `services/historyRecorder.js` | Records execution history to SQLite |
| **Projects** | `services/projects.js` | Discovers and manages BMAD projects |
| **Verification** | `services/verification.js` | Verifies story completion against criteria |

### API Layer

| Router | File | Endpoints |
|--------|------|-----------|
| **Projects** | `api/projects.js` | `GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects/:id/start|stop` |
| **Agents** | `api/agents.js` | `GET /api/agents`, `POST /api/agents/:id/kill` |
| **Stories** | `api/stories.js` | `POST /api/stories/:id/retry` |
| **History** | `api/history.js` | `GET /api/history`, `GET /api/history/:id` |
| **Logs** | `api/logs.js` | `GET /api/audit-logs` |
| **Auth** | `auth/routes.js` | `POST /auth/login`, `GET /auth/github/*`, `POST /auth/refresh` |

### Authentication Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Dashboard    │────▶│   /auth/login    │────▶│  JWT Token      │
│    (Browser)    │     │   (Password)     │     │  (Access+Refresh)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │
         │ OR
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub OAuth   │────▶│ /auth/github/*   │────▶│  Session        │
│  (OAuth App)    │     │                  │     │  (SQLite)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Database Layer

SQLite database (`orchestrator.db`) with tables:
- `sessions` - Authentication sessions
- `audit_log` - Security audit trail
- `verification_audit_logs` - Story verification records
- `execution_runs` - Orchestration run history
- `execution_events` - Timeline events within runs

## Dashboard Architecture

### Component Hierarchy

```
App
├── BrowserRouter
│   ├── /login → Login
│   └── ProtectedRoute
│       └── Layout
│           ├── Header
│           ├── Sidebar
│           └── Routes
│               ├── / → ProjectList
│               ├── /projects/:id → ProjectView
│               │   ├── EpicList → EpicCard
│               │   ├── StoryList → StoryDetail
│               │   └── AgentPanel → AgentRow
│               └── /history → History
│                   ├── HistoryList
│                   ├── HistoryFilters
│                   └── RunDetailPanel → EventTimeline
```

### State Management (Zustand)

| Store | Purpose |
|-------|---------|
| `authStore` | User authentication, tokens, logout |
| `projectsStore` | Projects list, selection, status |
| `agentsStore` | Active agents, kill operations |
| `logsStore` | Log entries, filtering |
| `wsStore` | WebSocket connection, real-time events |

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **ProjectCard** | `components/projects/ProjectCard.tsx` | Project status, start/stop workflow |
| **AgentPanel** | `components/agents/AgentPanel.tsx` | Active agents list with kill buttons |
| **EpicList** | `components/projects/EpicList.tsx` | Epic progress visualization |
| **StoryDetail** | `components/projects/StoryDetail.tsx` | Story status with acceptance criteria |
| **LogViewerPanel** | `components/logs/LogViewerPanel.tsx` | Real-time log streaming |
| **HistoryList** | `components/history/HistoryList.tsx` | Execution history table |

## Integration Points

### Backend → Dashboard

1. **REST API**: Standard HTTP requests for CRUD operations
2. **WebSocket**: Real-time events for:
   - `agent:spawn` - New agent started
   - `agent:output` - Agent output update
   - `agent:complete` - Agent finished
   - `agent:kill` - Agent killed
   - `agent:stuck` - Agent inactive too long
   - `project:paused` / `project:resumed` - Orchestration state
   - `state` - Full state updates
   - `log` - New log entry

### Backend → External

1. **Claude CLI**: PTY-based execution of `claude` command
2. **Anthropic API**: Claude 3.5 Haiku for Supervisor AI
3. **GitHub API**: OAuth authentication flow
4. **File System**: Project discovery, story files, config

## Key Design Decisions

See [ADR-001: Supervisor AI](./adr/ADR-001-supervisor-ai.md) for architecture decision on intelligent question handling.

### Why PTY for Claude CLI?

Claude CLI is interactive and may ask questions. PTY (pseudo-terminal) allows:
- Detecting questions in output
- Automatically answering simple y/n prompts
- Routing complex questions to Supervisor AI
- Capturing full output for logging

### Why SQLite?

- Zero configuration database
- Single file, portable
- Sufficient for orchestration history
- Better-SQLite3 for synchronous operations
