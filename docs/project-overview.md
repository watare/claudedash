# BMAD Orchestrator - Project Overview

**Generated**: 2026-01-19
**Scan Level**: Exhaustive
**Repository Type**: Multi-part (Backend + Dashboard)

## Executive Summary

BMAD Orchestrator is a multi-project orchestration platform for coordinating Claude Code agents across multiple projects following the BMAD Method workflows. It provides a web dashboard for real-time monitoring and control of story creation, development, code review, and PR creation workflows.

## Project Purpose

The orchestrator automates the BMAD development workflow:
1. **Create Story** - Generate story files from epics
2. **Development** - Implement acceptance criteria using Claude Code CLI
3. **Code Review** - Automated review for issues
4. **Fix Issues** - Address review feedback (iterative)
5. **Create PR** - Open pull requests

## Tech Stack Summary

| Category | Backend (Server) | Dashboard (Frontend) |
|----------|------------------|---------------------|
| **Runtime** | Node.js 18+ | Browser (React 19) |
| **Framework** | Express 4.18 | Vite 7.2 |
| **Language** | JavaScript (ESM) | TypeScript 5.9 |
| **Database** | SQLite (better-sqlite3) | - |
| **Real-time** | WebSocket (ws 8.16) | WebSocket client |
| **Auth** | JWT + GitHub OAuth | Zustand store |
| **Styling** | - | TailwindCSS 4.1 |
| **Components** | - | Radix UI primitives |
| **Testing** | Vitest | Vitest + Testing Library |

## Architecture Pattern

- **Backend**: Service-oriented architecture with Express router pattern
- **Dashboard**: Component-based React SPA with Zustand state management
- **Integration**: REST API + WebSocket for real-time updates

## Key Features

1. **Multi-Project Support**: Discover and manage multiple BMAD projects from a single dashboard
2. **Batch Execution**: Run multiple epics/stories in parallel batches
3. **Real-time Monitoring**: WebSocket-powered live updates for agent status
4. **Supervisor AI**: Intelligent question answering for complex agent queries (Claude 3.5 Haiku)
5. **Agent Management**: Start, stop, and kill agents with stuck detection
6. **Execution History**: SQLite-backed history of all orchestration runs
7. **Authentication**: GitHub OAuth + password-based login with JWT sessions

## Project Structure

```
bmad-orchestrator/
├── src/                    # Backend server
│   ├── server.js           # Main entry point (DashboardServer class)
│   ├── orchestrator.js     # Core orchestration logic
│   ├── claude-runner.js    # PTY-based Claude CLI execution
│   ├── parser.js           # BMAD file parsers
│   ├── config.js           # Configuration loader
│   ├── api/                # REST API routes
│   ├── services/           # Business logic services
│   ├── auth/               # Authentication modules
│   └── db/                 # Database layer
├── dashboard/              # React frontend
│   ├── src/
│   │   ├── App.tsx         # Main app with routing
│   │   ├── pages/          # Route components
│   │   ├── components/     # UI components
│   │   └── stores/         # Zustand state stores
│   └── package.json
├── public/dashboard/       # Built dashboard assets
├── docs/                   # Generated documentation
└── package.json            # Server dependencies
```

## Getting Started

See [Development Guide](./development-guide.md) for setup instructions.

## Related Documentation

- [Architecture](./architecture.md) - Detailed system architecture
- [API Contracts](./api-contracts.md) - REST API reference
- [Data Models](./data-models.md) - Database schema
- [Source Tree Analysis](./source-tree-analysis.md) - Code organization
