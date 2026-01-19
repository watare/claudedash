# BMAD Orchestrator - API Contracts

**Generated**: 2026-01-19

## Base URL

```
http://localhost:3456
```

## Authentication

All API endpoints (except `/auth/*` and `/api/health`) require authentication via:
- **JWT Bearer Token**: `Authorization: Bearer <token>`
- **Cookie**: `access_token=<token>` (set after login)

---

## Health Check

### GET /api/health

Health check endpoint (no auth required).

**Response**
```json
{
  "status": "ok",
  "uptime": 12345.67
}
```

---

## Authentication

### POST /auth/login

Password-based login.

**Request**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response**
```json
{
  "user": {
    "userId": "local_admin",
    "username": "admin",
    "provider": "local"
  },
  "accessToken": "eyJ...",
  "expiresIn": 900
}
```

### GET /auth/github

Initiates GitHub OAuth flow. Redirects to GitHub.

### GET /auth/github/callback

OAuth callback. Returns token in redirect URL: `/?token=<jwt>`.

### GET /auth/me

Get current authenticated user.

**Response**
```json
{
  "userId": "github_12345",
  "username": "octocat",
  "provider": "github"
}
```

### POST /auth/refresh

Refresh access token using refresh token cookie.

**Response**
```json
{
  "accessToken": "eyJ...",
  "expiresIn": 900
}
```

### POST /auth/logout

Clear session and cookies.

---

## Projects

### GET /api/projects

List all discovered BMAD projects.

**Response**
```json
[
  {
    "id": "my-project",
    "name": "my-project",
    "path": "/home/user/projects/my-project",
    "status": "idle",
    "currentEpic": null,
    "currentStory": null,
    "agentCount": 0,
    "lastActivity": "2026-01-19T12:00:00.000Z"
  }
]
```

**Status Values**: `idle`, `running`, `paused`, `waiting`, `done`, `failed`

### GET /api/projects/:id

Get project details with epics and stories.

**Response**
```json
{
  "id": "my-project",
  "name": "my-project",
  "path": "/home/user/projects/my-project",
  "status": "running",
  "currentEpic": 2,
  "currentStory": "2-3",
  "agentCount": 2,
  "epics": [
    {
      "number": 1,
      "title": "Authentication",
      "status": "done",
      "stories": [
        {
          "id": "1-1",
          "title": "Login Form",
          "status": "done",
          "acceptanceCriteria": ["Given user on login page..."]
        }
      ]
    }
  ],
  "agents": [
    {
      "id": "agent-123",
      "storyId": "2-3",
      "status": "running"
    }
  ]
}
```

### POST /api/projects/:id/start

Start orchestration for a project.

**Request** (optional)
```json
{
  "batchSize": 2,
  "epicFilter": [1, 2],
  "dryRun": false
}
```

**Response**
```json
{
  "data": {
    "projectId": "my-project",
    "projectPath": "/home/user/projects/my-project",
    "status": "starting"
  },
  "meta": {
    "timestamp": "2026-01-19T12:00:00.000Z"
  }
}
```

### POST /api/projects/:id/stop

Stop orchestration for a project.

**Response**
```json
{
  "data": {
    "projectId": "my-project",
    "status": "stopped"
  },
  "meta": {
    "timestamp": "2026-01-19T12:00:00.000Z"
  }
}
```

---

## Agents

### GET /api/agents

List all active agents.

**Query Parameters**
- `projectId` (optional): Filter by project

**Response**
```json
[
  {
    "id": "agent-1705673400000-1",
    "projectId": "my-project",
    "storyId": "2-3",
    "storyTitle": "User Dashboard",
    "status": "running",
    "startedAt": "2026-01-19T12:00:00.000Z",
    "lastActivity": "2026-01-19T12:05:00.000Z",
    "lastOutput": "Implementing feature..."
  }
]
```

### POST /api/agents/:id/kill

Kill a running agent.

**Response**
```json
{
  "success": true,
  "agentId": "agent-1705673400000-1",
  "message": "Agent killed successfully"
}
```

---

## Stories

### POST /api/stories/:id/retry

Retry a failed story.

**Request**
```json
{
  "projectId": "my-project"
}
```

**Response**
```json
{
  "success": true,
  "storyId": "2-3",
  "message": "Story retry initiated"
}
```

---

## History

### GET /api/history

Get execution history.

**Query Parameters**
- `limit` (default: 50): Maximum records
- `offset` (default: 0): Pagination offset
- `project` (optional): Filter by project name
- `status` (optional): Filter by status

**Response**
```json
{
  "runs": [
    {
      "id": 1,
      "project": "my-project",
      "startedAt": "2026-01-19T10:00:00.000Z",
      "endedAt": "2026-01-19T11:30:00.000Z",
      "status": "completed",
      "storiesCompleted": 5,
      "storiesFailed": 0,
      "storiesTotal": 5,
      "durationMs": 5400000
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

### GET /api/history/:id

Get execution run details with events.

**Response**
```json
{
  "run": {
    "id": 1,
    "project": "my-project",
    "startedAt": "2026-01-19T10:00:00.000Z",
    "status": "completed",
    "config": { "batchSize": 2 }
  },
  "events": [
    {
      "id": 1,
      "runId": 1,
      "timestamp": "2026-01-19T10:00:00.000Z",
      "type": "agent:spawn",
      "agentId": "agent-123",
      "storyId": "1-1",
      "epicNumber": 1,
      "details": { "step": "starting" }
    }
  ]
}
```

---

## Logs

### GET /api/logs

Get server logs.

**Query Parameters**
- `limit` (default: 200): Maximum entries
- `offset` (default: 0): Pagination offset
- `agentId` (optional): Filter by agent
- `level` (optional): Filter by level (info, warn, error, debug)

**Response**
```json
{
  "logs": [
    {
      "id": 0,
      "time": "2026-01-19T12:00:00.000Z",
      "message": "Dashboard server started",
      "level": "info",
      "agentId": null
    }
  ],
  "total": 100
}
```

### GET /api/audit-logs

Get security audit logs.

**Response**
```json
[
  {
    "id": 1,
    "timestamp": "2026-01-19T12:00:00.000Z",
    "userId": "github_12345",
    "action": "project:start",
    "resource": "my-project",
    "details": { "options": {} }
  }
]
```

---

## WebSocket

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3456?token=<jwt>');
```

### Message Types (Server → Client)

| Type | Payload | Description |
|------|---------|-------------|
| `connection:established` | `{ userId, username }` | Auth successful |
| `state` | Full state object | Orchestration state update |
| `log` | Log entry | New log entry |
| `logs` | Array of log entries | Initial logs on connect |
| `config` | Config object | Server configuration |
| `agent:spawn` | Agent object | New agent started |
| `agent:output` | `{ agentId, output }` | Agent output update |
| `agent:complete` | `{ agent, result }` | Agent finished |
| `agent:kill` | `{ agentId, status }` | Agent killed |
| `agent:stuck` | `{ agentId, ... }` | Agent inactive alert |
| `project:paused` | `{ projectId, reason }` | Project paused |
| `project:resumed` | `{ projectId }` | Project resumed |

### Message Types (Client → Server)

| Type | Payload | Description |
|------|---------|-------------|
| `ping` | - | Keep-alive |
| `getState` | - | Request current state |
| `getLogs` | `{ limit }` | Request logs |
