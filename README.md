# BMAD Orchestrator

Multi-project orchestration dashboard for BMAD Method workflows. Coordinates Claude Code agents across multiple projects, handling story creation, development, code review, and PR creation.

## Features

- **Multi-Project Support**: Discover and manage multiple BMAD projects from a single dashboard
- **Batch Execution**: Run multiple epics/stories in parallel batches
- **Real-time Monitoring**: WebSocket-powered live updates for agent status
- **Supervisor AI**: Intelligent question answering for complex agent queries (optional)
- **Agent Management**: Start, stop, and kill agents with stuck detection
- **Execution History**: SQLite-backed history of all orchestration runs

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Dashboard                             │
│  (Project Cards, Agent Panel, History, Real-time Updates)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express Server (API)                         │
│  /api/projects  /api/agents  /api/status  /api/history          │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
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

## Quick Start

### Prerequisites

- Node.js 20+
- Claude Code CLI installed and authenticated
- Projects with BMAD installed (`_bmad` folder)

### Installation

```bash
# Clone and install
git clone <repo-url>
cd bmad-orchestrator
npm install

# Configure secrets
cp bmad-orchestrator.secrets.example.yaml bmad-orchestrator.secrets.yaml
# Edit secrets with your GitHub OAuth credentials

# Build dashboard
cd dashboard && npm install && npm run build && cd ..

# Start server
node src/server.js
```

### Configuration

#### Required: `bmad-orchestrator.secrets.yaml`

```yaml
github:
  client_id: "your_github_oauth_app_client_id"
  client_secret: "your_github_oauth_app_client_secret"

allowed_users:
  - "your_github_username"

# Optional: Supervisor AI for intelligent question handling
anthropic:
  api_key: "sk-ant-api03-..."
```

#### Optional: `bmad-orchestrator.yaml`

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
```

## Dashboard Usage

1. Navigate to `http://localhost:3456`
2. Log in with GitHub OAuth or password
3. Click **Start Workflow** on a project card
4. Monitor progress in real-time
5. View agent output and manage stuck agents

## Workflow Steps

For each story, the orchestrator runs:

1. **Create Story** - Generate story file from epic
2. **Development** - Implement acceptance criteria
3. **Code Review** - Automated review for issues
4. **Fix Issues** - Address review feedback (loops until clean)
5. **Create PR** - Open pull request

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List all discovered projects |
| `/api/projects/:id` | GET | Get project details |
| `/api/projects/:id/start` | POST | Start orchestration |
| `/api/projects/:id/stop` | POST | Stop orchestration |
| `/api/agents` | GET | List active agents |
| `/api/agents/:id/kill` | POST | Kill an agent |
| `/api/status` | GET | Current orchestration status |
| `/api/history` | GET | Execution history |

## Supervisor AI (Optional)

When configured with an Anthropic API key, the orchestrator uses Claude 3.5 Haiku to intelligently answer complex agent questions:

- **Simple questions** (y/n, continue?) → Fast regex patterns
- **Complex questions** (which issues to fix?) → Supervisor AI

Cost: ~$0.15/day for 1000 questions

See [ADR-001](docs/adr/ADR-001-supervisor-ai.md) for architecture details.

## Project Discovery

The orchestrator discovers projects by scanning the parent directory for folders with `_bmad` installed. Each project must have:

- `_bmad/` folder with BMAD configuration
- `sprint-status.yaml` for tracking (optional)
- Epics and stories defined

## Development

```bash
# Run tests
npm test

# Run dashboard in dev mode
cd dashboard && npm run dev

# Run server with auto-reload
npm run dev
```

## Documentation

- [CHANGELOG.md](CHANGELOG.md) - Version history
- [docs/adr/](docs/adr/) - Architecture Decision Records

## License

MIT
