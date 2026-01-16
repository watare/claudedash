---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
workflowComplete: true
completedAt: '2026-01-15'
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
---

# bmad-orchestrator - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bmad-orchestrator, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Claude Instance Lifecycle (FR1-FR7):**
- FR1: System can spawn a new Claude Code instance with specified project path and workflow command
- FR2: System can monitor Claude instance stdout/stderr in real-time
- FR3: System can detect when a Claude instance completes its workflow
- FR4: System can forcibly terminate a Claude instance
- FR5: System can track all active Claude instances with their status
- FR6: System can configure timeout duration per workflow type
- FR7: System can detect stuck instances (no activity for configured duration)

**Status Verification (FR8-FR13):**
- FR8: System can read YAML status files directly from disk
- FR9: System can compare agent-claimed status against actual YAML file status
- FR10: System can detect status mismatches between agent claim and YAML
- FR11: System can trigger re-verification workflow when status mismatch detected
- FR12: System can block progression until status is verified
- FR13: System can log all status verification attempts and results

**Workflow Orchestration (FR14-FR22):**
- FR14: System can parse epics.md file to extract epic and story structure
- FR15: System can parse sprint-status.yaml to determine current state
- FR16: System can build execution plan based on pending/in-progress work
- FR17: System can execute multiple epics in parallel (configurable batch size)
- FR18: System can execute multiple stories within an epic in parallel
- FR19: System can invoke BMAD workflows (/dev-story, /code-review, etc.)
- FR20: System can track story status transitions (draft → in-progress → review → done)
- FR21: System can pause orchestration at configurable checkpoints
- FR22: System can resume orchestration from last checkpoint

**Authentication & Authorization (FR23-FR27):**
- FR23: User can authenticate via GitHub OAuth SSO
- FR24: System can restrict dashboard access to configured allowed users
- FR25: System can maintain user session across requests
- FR26: System can invalidate user session on logout
- FR27: System can redirect unauthenticated requests to OAuth flow

**Secrets Management (FR28-FR33):**
- FR28: System can load secrets from gitignored configuration file
- FR29: System can store GitHub personal access token securely
- FR30: System can store SSH key paths for VPS access
- FR31: System can store GitHub OAuth client credentials
- FR32: System can prevent secrets from appearing in logs
- FR33: System can validate that required secrets are configured before starting

**Git Operations (FR34-FR39):**
- FR34: System can create feature branches per story
- FR35: System can commit changes with structured commit messages
- FR36: System can push branches to remote repository
- FR37: System can create pull requests via GitHub API
- FR38: System can merge pull requests when approved
- FR39: System can rebase branches when conflicts detected

**Dashboard & Monitoring (FR40-FR46):**
- FR40: User can view orchestration status in web dashboard
- FR41: User can view list of all active Claude instances
- FR42: User can view real-time logs from running instances
- FR43: User can view epic/story progress with status indicators
- FR44: User can kill a specific Claude instance from dashboard
- FR45: User can trigger retry for a failed story from dashboard
- FR46: User can view execution history and reports

**Notifications & Alerting (FR47-FR51):**
- FR47: System can notify user when approval is required
- FR48: System can notify user when agent is stuck
- FR49: System can notify user when epic/project completes
- FR50: System can notify user when critical error occurs
- FR51: User can configure notification channels (console, webhook, Slack)

**Visual Verification - Phase 2 (FR52-FR57):**
- FR52: System can launch browser via Playwright
- FR53: System can capture screenshots of specified URLs/components
- FR54: System can compare screenshots against baseline images
- FR55: System can calculate visual diff confidence score
- FR56: System can feed visual diff results back to Claude agent
- FR57: System can store baseline screenshots for comparison

**Multi-Project Support - Phase 3 (FR58-FR61):**
- FR58: System can track multiple projects simultaneously
- FR59: System can maintain isolated state per project
- FR60: User can view all projects in unified dashboard
- FR61: User can start/stop orchestration per project independently

### NonFunctional Requirements

**Performance (NFR-P1 to NFR-P5):**
- NFR-P1: Claude instance spawns within 5 seconds
- NFR-P2: Status verification completes within 2 seconds
- NFR-P3: Dashboard updates via WebSocket within 500ms
- NFR-P4: Log streaming has < 1 second latency
- NFR-P5: System handles 10+ concurrent Claude instances

**Security (NFR-S1 to NFR-S7):**
- NFR-S1: All dashboard access requires GitHub OAuth SSO
- NFR-S2: Only configured GitHub users can access dashboard
- NFR-S3: Secrets never appear in logs or stdout
- NFR-S4: Secrets file is gitignored and excluded from backup
- NFR-S5: OAuth sessions expire after 24 hours of inactivity
- NFR-S6: SSH connections use key-based auth only, no passwords
- NFR-S7: GitHub tokens use minimum required scopes

**Scalability/Workload (NFR-W1 to NFR-W4):**
- NFR-W1: System supports 3+ projects running simultaneously
- NFR-W2: Each project can run 4+ Claude instances in parallel
- NFR-W3: System gracefully handles resource exhaustion
- NFR-W4: Adding new project doesn't impact running projects

**Integration (NFR-I1 to NFR-I5):**
- NFR-I1: Works with Claude Code CLI via subprocess
- NFR-I2: Supports `--dangerously-skip-permissions` flag
- NFR-I3: Parses BMAD YAML frontmatter correctly
- NFR-I4: GitHub API calls handle rate limits gracefully
- NFR-I5: SSH connections support standard key formats (RSA, Ed25519)

**Reliability (NFR-R1 to NFR-R6):**
- NFR-R1: Orchestrator survives individual Claude instance crashes
- NFR-R2: System cleans up orphan processes on restart
- NFR-R3: Dashboard remains accessible even during heavy orchestration
- NFR-R4: System can resume from checkpoint after crash
- NFR-R5: All state is persisted to disk, not just in-memory
- NFR-R6: Systemd service auto-restarts on failure

### Additional Requirements

**From Architecture - Starter Template:**
- Dashboard scaffolding with Vite + React + TypeScript + Tailwind v4 + shadcn/ui
- SQLite database setup with better-sqlite3 for sessions and audit_log tables
- GitHub OAuth flow implementation in backend (src/auth/github.js)
- Password fallback authentication in backend (src/auth/password.js)
- JWT-based session management with HTTP-only cookies
- Auth UI components adapted from Optigo patterns (LoginForm, GitHubButton, ProtectedRoute)
- Zustand stores for frontend state management (authStore, projectsStore, agentsStore)
- REST API endpoints structure (/api/projects, /api/agents, /api/logs, /auth/*)
- WebSocket integration for real-time updates with JSON message format

**From Architecture - Implementation Patterns:**
- Naming conventions: camelCase (JavaScript/TypeScript), snake_case (SQL), PascalCase (React components)
- API response format: `{ data: {...}, meta: {...} }` for success, `{ error, code, details }` for errors
- Co-located tests pattern (Component.tsx → Component.test.tsx)
- Feature-based folder structure in dashboard/src/components/
- Environment-based config with .env files (dev) and .env.production (gitignored)

**From Architecture - Existing Components to Preserve:**
- Core orchestrator (src/orchestrator.js) - parses epics, builds execution plan, runs batches
- Claude runner (src/claude-runner.js) - subprocess spawning with --dangerously-skip-permissions
- Epic worker (src/epic-worker.js) - parallel epic execution with batch support
- Story worker (src/story-worker.js) - parallel story execution within epics
- Parser (src/parser.js) - parses epics.md and sprint-status.yaml
- Config system (src/config.js) - YAML config loading and validation
- WebSocket server (src/server.js) - Express + WebSocket + basic auth (to be enhanced)

**From UX Design - Dashboard Components:**
- Dark theme foundation with Binance-inspired palette (#0B0E11 background, #F0B90B gold accents)
- Header component (48px) with logo, status summary, user menu
- Sidebar component (200px) with project list, status indicators, collapse toggle
- Project card component with status dot, current work, agent count, action buttons
- Agent activity panel showing active agents with pulsing indicators and last activity
- Verification status component showing claimed vs verified status with badges
- Log viewer component as slide-in panel with streaming output, search, filter
- Toast notifications positioned bottom-right, stack max 3, with type-based styling

**From UX Design - Interaction Patterns:**
- One-click actions for approve, kill, retry operations
- Status colors: Gold (verified), Green (running), Red (failed), Yellow (warning), Blue (in-progress)
- Loading states: full-screen spinner, card skeletons, inline "verifying..." indicators
- Keyboard shortcuts: Cmd+K (command palette), Cmd+N (new project), R (retry), K (kill), L (logs)
- Accessibility: WCAG 2.1 AA compliance, 4.5:1 text contrast, visible focus indicators

**From UX Design - Critical Success Moments:**
- Fleet at Work: Dashboard shows all projects and agents with green status
- Verified Status: Gold checkmark badge only shown when actually verified
- Pinged for Approval: Notification with one-click approve action
- Stuck Detection: Alert with "Agent stuck for Xh" and kill button

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1-FR7 | Existing | Claude Instance Lifecycle (already built) |
| FR8 | Epic 3 | Read YAML status files |
| FR9 | Epic 3 | Compare claimed vs actual status |
| FR10 | Epic 3 | Detect status mismatches |
| FR11 | Epic 3 | Trigger re-verification workflow |
| FR12 | Epic 3 | Block progression until verified |
| FR13 | Epic 3 | Log verification attempts |
| FR14-FR22 | Existing | Workflow Orchestration (already built) |
| FR23 | Epic 1 | GitHub OAuth SSO |
| FR24 | Epic 1 | Restrict access to allowed users |
| FR25 | Epic 1 | Maintain user session |
| FR26 | Epic 1 | Invalidate session on logout |
| FR27 | Epic 1 | Redirect to OAuth flow |
| FR28 | Epic 1 | Load secrets from gitignored file |
| FR29 | Epic 1 | Store GitHub token securely |
| FR30 | Epic 1 | Store SSH key paths |
| FR31 | Epic 1 | Store OAuth client credentials |
| FR32 | Epic 1 | Prevent secrets in logs |
| FR33 | Epic 1 | Validate required secrets |
| FR34-FR39 | Existing | Git Operations (already built) |
| FR40 | Epic 2 | View orchestration status |
| FR41 | Epic 2 | View active Claude instances |
| FR42 | Epic 2 | View real-time logs |
| FR43 | Epic 2 | View epic/story progress |
| FR44 | Epic 4 | Kill Claude instance |
| FR45 | Epic 4 | Retry failed story |
| FR46 | Epic 4 | View execution history |
| FR47 | Epic 5 | Notify on approval required |
| FR48 | Epic 5 | Notify on stuck agent |
| FR49 | Epic 5 | Notify on project complete |
| FR50 | Epic 5 | Notify on critical error |
| FR51 | Epic 5 | Configure notification channels |
| FR52-FR57 | Epic 6 | Visual Verification (Phase 2) |
| FR58-FR61 | Epic 7 | Multi-Project Support (Phase 3) |

## Epic List

### Epic 1: Secure Dashboard Foundation
User can securely access a modern React dashboard with GitHub OAuth authentication and password fallback.
**FRs covered:** FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33

### Epic 2: Real-Time Project Monitoring
User can view all projects and agents in a real-time dashboard, seeing status at a glance.
**FRs covered:** FR40, FR41, FR42, FR43

### Epic 3: Status Verification System
User can trust that displayed status is verified against YAML files, not just agent claims.
**FRs covered:** FR8, FR9, FR10, FR11, FR12, FR13

### Epic 4: Agent Control & Recovery
User can kill stuck agents, retry failed stories, and investigate issues from the dashboard.
**FRs covered:** FR7 (enhancement), FR44, FR45, FR46

### Epic 5: Notifications & Alerts
User gets notified when approval is needed, agents are stuck, or projects complete without constantly monitoring.
**FRs covered:** FR47, FR48, FR49, FR50, FR51

### Epic 6: Visual Verification (Phase 2 - Deferred)
Agents can "see" what they built and self-correct visual issues automatically.
**FRs covered:** FR52, FR53, FR54, FR55, FR56, FR57

### Epic 7: Multi-Project Support (Phase 3 - Deferred)
User can orchestrate multiple projects simultaneously with isolated state.
**FRs covered:** FR58, FR59, FR60, FR61

---

## Epic 1: Secure Dashboard Foundation

User can securely access a modern React dashboard with GitHub OAuth authentication and password fallback.

### Story 1.1: Dashboard Scaffolding

As a **developer**,
I want **the React dashboard initialized with Vite, TypeScript, Tailwind v4, and shadcn/ui**,
So that **I have a modern, consistent foundation for building dashboard components**.

**Acceptance Criteria:**

**Given** the bmad-orchestrator project exists
**When** I run `npm run dev:dashboard`
**Then** the Vite dev server starts and serves the React app at localhost:5173
**And** Tailwind CSS is configured with the Binance-inspired dark theme (#0B0E11 background)
**And** shadcn/ui is initialized with the "new-york" style
**And** the following base components are available: Button, Card, Badge, Toast
**And** the dashboard folder structure matches Architecture spec (components/, stores/, services/, hooks/, types/)

### Story 1.2: SQLite Database Setup

As a **system**,
I want **a SQLite database initialized with sessions and audit_log tables**,
So that **authentication state and user actions can be persisted securely**.

**Acceptance Criteria:**

**Given** the orchestrator server starts
**When** the database module initializes
**Then** a SQLite database file is created at `data/orchestrator.db`
**And** the `sessions` table exists with columns: id, user_id, github_token, refresh_token, expires_at, created_at
**And** the `audit_log` table exists with columns: id, timestamp, user, action, project, details
**And** the database connection uses better-sqlite3 synchronous API
**And** migrations run automatically on startup if schema changes

### Story 1.3: Secrets Configuration System

As a **developer**,
I want **secrets loaded from a gitignored configuration file**,
So that **sensitive credentials are never committed to source control** (FR28, FR32).

**Acceptance Criteria:**

**Given** a `bmad-orchestrator.secrets.yaml` file exists in the project root
**When** the server starts
**Then** GitHub OAuth client_id and client_secret are loaded from secrets file
**And** the allowed_users list is loaded from secrets file
**And** SSH key paths are loaded if configured (FR30)
**And** the secrets file is listed in .gitignore
**And** secrets never appear in console logs or stdout (FR32)
**And** if required secrets are missing, the server logs a clear error and exits (FR33)
**And** an example file `bmad-orchestrator.secrets.example.yaml` documents the required format

### Story 1.4: GitHub OAuth Authentication

As a **user**,
I want **to authenticate via GitHub OAuth**,
So that **I can securely access the dashboard using my GitHub identity** (FR23).

**Acceptance Criteria:**

**Given** I am not authenticated
**When** I visit the dashboard
**Then** I am redirected to GitHub OAuth authorization page
**And** after authorizing, I am redirected back to `/auth/github/callback`

**Given** the OAuth callback is received
**When** my GitHub username is in the allowed_users list (FR24)
**Then** a JWT access token (15min expiry) is created
**And** a refresh token (7 days expiry) is stored in SQLite and HTTP-only cookie
**And** I am redirected to the dashboard

**Given** the OAuth callback is received
**When** my GitHub username is NOT in the allowed_users list
**Then** I see "Access denied: user not authorized"
**And** no session is created

### Story 1.5: Password Fallback Authentication

As a **user**,
I want **to login with email and password when GitHub OAuth is unavailable**,
So that **I can still access the dashboard offline or if GitHub is down**.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I enter valid email and password credentials
**Then** the credentials are verified against stored hash (bcrypt)
**And** JWT access token and refresh token are created
**And** I am redirected to the dashboard

**Given** I enter invalid credentials
**When** I submit the login form
**Then** I see "Invalid email or password"
**And** the attempt is logged in audit_log
**And** rate limiting applies (5 attempts per 15 minutes)

**Given** no password user exists
**When** I need to create one
**Then** a CLI command `npm run create-user` prompts for email and password
**And** the password is hashed with bcrypt before storage

### Story 1.6: Auth Frontend Components

As a **user**,
I want **a login page with GitHub OAuth button and password form**,
So that **I can choose my preferred authentication method**.

**Acceptance Criteria:**

**Given** I visit the dashboard unauthenticated
**When** the login page loads
**Then** I see a "Sign in with GitHub" button (primary, gold)
**And** I see an email/password form below as alternative
**And** the page uses the dark theme (#0B0E11 background)
**And** the layout is centered and responsive

**Given** I click "Sign in with GitHub"
**When** the button is pressed
**Then** I am redirected to GitHub OAuth flow

**Given** I am entering credentials
**When** validation fails (empty fields, invalid email format)
**Then** inline error messages appear without page reload

### Story 1.7: Protected Routes & Session Management

As a **user**,
I want **my session maintained across requests with automatic refresh**,
So that **I don't have to re-login frequently** (FR25, FR26, FR27).

**Acceptance Criteria:**

**Given** I am authenticated
**When** my access token expires (15min)
**Then** the frontend automatically uses the refresh token to get a new access token
**And** if refresh succeeds, my session continues seamlessly

**Given** my refresh token is expired or invalid
**When** I try to access the dashboard
**Then** I am redirected to the login page (FR27)
**And** my session is invalidated in SQLite

**Given** I click "Logout"
**When** the logout action completes
**Then** my session is removed from SQLite (FR26)
**And** HTTP-only cookies are cleared
**And** I am redirected to the login page

**Given** I am on a protected route
**When** I am not authenticated
**Then** a `<ProtectedRoute>` component redirects me to login

---

## Epic 2: Real-Time Project Monitoring

User can view all projects and agents in a real-time dashboard, seeing status at a glance.

### Story 2.1: Dashboard Layout & Navigation

As a **user**,
I want **a dashboard layout with header, sidebar, and main content area**,
So that **I can navigate between projects and see overall status at a glance**.

**Acceptance Criteria:**

**Given** I am authenticated
**When** I access the dashboard
**Then** I see a header (48px) with logo "bmad-orchestrator" on the left
**And** the header shows status summary: "[X Projects] [Y Agents] [Z Alerts]" in center
**And** my GitHub avatar and dropdown menu appear on the right
**And** a sidebar (200px) shows the project list on the left
**And** the main content area displays project cards

**Given** the sidebar is expanded
**When** I click the collapse toggle
**Then** the sidebar collapses to 48px showing only icons
**And** my preference is persisted in localStorage

### Story 2.2: Projects Zustand Store & API

As a **system**,
I want **a Zustand store for projects state with REST API endpoints**,
So that **project data flows consistently between server and dashboard**.

**Acceptance Criteria:**

**Given** the dashboard loads
**When** the projectsStore initializes
**Then** it fetches projects from `GET /api/projects`
**And** the store contains: projects array, isLoading boolean, error string

**Given** projects exist on the server
**When** `GET /api/projects` is called
**Then** it returns `{ data: [...projects], meta: { total: N } }`
**And** each project includes: id, name, path, status, currentEpic, currentStory, agentCount

**Given** I want to view a specific project
**When** `GET /api/projects/:id` is called
**Then** it returns full project details including epic/story breakdown

### Story 2.3: Project Cards Display

As a **user**,
I want **to see project cards showing current status, work in progress, and agent count**,
So that **I can understand each project's state at a glance** (FR40, FR43).

**Acceptance Criteria:**

**Given** projects exist
**When** the dashboard main area renders
**Then** each project displays as a card (280-400px width)
**And** cards show: status dot (colored), project name, current epic/story, agent count
**And** cards have action buttons: [View Details] [View Logs]
**And** the active project has a gold left border

**Given** a project has different states
**When** the state changes
**Then** status dot colors match: green=running, yellow=waiting, red=failed, gold=done, gray=paused
**And** waiting projects show an [Approve] button prominently

### Story 2.4: Agents Zustand Store & API

As a **system**,
I want **a Zustand store for agents state with REST API endpoints**,
So that **active Claude instances are tracked and displayed** (FR41).

**Acceptance Criteria:**

**Given** the dashboard loads
**When** the agentsStore initializes
**Then** it fetches agents from `GET /api/agents`
**And** the store contains: agents array, isLoading boolean, error string

**Given** agents are running
**When** `GET /api/agents` is called
**Then** it returns all active Claude instances
**And** each agent includes: id, projectId, storyId, status, startedAt, lastActivity, lastOutput

**Given** I want agents for a specific project
**When** `GET /api/agents?projectId=X` is called
**Then** only agents for that project are returned

### Story 2.5: Agent Activity Panel

As a **user**,
I want **to see active agents with their current activity and duration**,
So that **I know what Claude instances are working on** (FR41).

**Acceptance Criteria:**

**Given** I am viewing a project
**When** agents are active for that project
**Then** an Agent Activity Panel shows all agents
**And** each agent row shows: pulsing indicator, agent ID, story reference, duration (e.g., "Running 5m")
**And** last activity text shows truncated last output line (not full log)

**Given** an agent has been running longer than threshold (configurable, default 45min)
**When** the panel renders
**Then** the agent shows a yellow/red warning indicator
**And** [Kill] and [View Logs] buttons appear for that agent

### Story 2.6: WebSocket Real-Time Updates

As a **user**,
I want **the dashboard to update in real-time without page refresh**,
So that **I see current status as agents progress** (FR40).

**Acceptance Criteria:**

**Given** I am viewing the dashboard
**When** a WebSocket connection is established
**Then** the connection authenticates using my JWT token
**And** I receive real-time events for all projects I have access to

**Given** an agent spawns, completes, or updates
**When** the server broadcasts a WebSocket event
**Then** the dashboard receives `{ type: "agent:spawn|complete|output", data: {...} }`
**And** the relevant Zustand store updates automatically
**And** UI re-renders within 500ms (NFR-P3)

**Given** the WebSocket connection drops
**When** reconnection is attempted
**Then** the client automatically reconnects with exponential backoff
**And** state is re-synced on reconnection

### Story 2.7: Epic/Story Progress Display

As a **user**,
I want **to see epic and story progress with status indicators**,
So that **I understand how far along each project is** (FR43).

**Acceptance Criteria:**

**Given** I click [View Details] on a project card
**When** the project detail view opens
**Then** I see all epics listed with completion status
**And** each epic shows story count: "3/7 stories complete"
**And** a progress bar visualizes completion percentage

**Given** I expand an epic
**When** stories are displayed
**Then** each story shows: number, title, status badge (draft/in-progress/review/done)
**And** the current active story is highlighted
**And** clicking a story shows its acceptance criteria

---

## Epic 3: Status Verification System

User can trust that displayed status is verified against YAML files, not just agent claims.

### Story 3.1: YAML Status Reader Service

As a **system**,
I want **to read YAML status files directly from disk**,
So that **I can verify agent claims against actual file state** (FR8).

**Acceptance Criteria:**

**Given** a project has a sprint-status.yaml file
**When** the verification service reads it
**Then** the current status of each story is extracted
**And** the file is parsed correctly including YAML frontmatter
**And** read errors are caught and logged without crashing

**Given** the YAML file is malformed
**When** parsing fails
**Then** an error is logged with file path and parse error
**And** the story status returns "unknown" instead of crashing

### Story 3.2: Status Comparison Engine

As a **system**,
I want **to compare agent-claimed status against YAML file status**,
So that **mismatches are detected before proceeding** (FR9, FR10).

**Acceptance Criteria:**

**Given** an agent claims a story is "done"
**When** the verification service compares with YAML
**Then** it reads the actual status from sprint-status.yaml
**And** returns: { claimed: "done", actual: "done", match: true } or { claimed: "done", actual: "in-progress", match: false }

**Given** a status mismatch is detected
**When** the comparison completes
**Then** the mismatch is logged with story ID, claimed status, actual status, timestamp
**And** the verification result is stored for UI display

### Story 3.3: Re-Verification Workflow Trigger

As a **system**,
I want **to trigger a re-verification workflow when status mismatch is detected**,
So that **agents correct their status before proceeding** (FR11).

**Acceptance Criteria:**

**Given** a status mismatch is detected
**When** the orchestrator processes the mismatch
**Then** it spawns a new Claude instance with a verification prompt
**And** the prompt asks the agent to verify and correct the story status
**And** the verification attempt is logged

**Given** re-verification completes
**When** the new status is checked
**Then** if match: proceed to next step
**And** if still mismatch: alert user and block progression

### Story 3.4: Verification Blocking Logic

As a **system**,
I want **progression blocked until status is verified**,
So that **wrong status never cascades to subsequent steps** (FR12).

**Acceptance Criteria:**

**Given** an agent claims completion
**When** the orchestrator receives the claim
**Then** it does NOT proceed to the next story/epic
**And** instead, it triggers status verification first

**Given** verification confirms the status
**When** match is true
**Then** the orchestrator proceeds to the next step
**And** logs "Status verified, proceeding"

**Given** verification fails after max retries (configurable, default 3)
**When** mismatch persists
**Then** the story is marked as "verification_failed"
**And** user is alerted via notification
**And** orchestration pauses for that project

### Story 3.5: Verification Logging & Audit

As a **system**,
I want **all verification attempts logged**,
So that **I can audit status verification history** (FR13).

**Acceptance Criteria:**

**Given** any verification attempt occurs
**When** the verification completes
**Then** a record is inserted into audit_log table
**And** the record includes: timestamp, story_id, claimed_status, actual_status, result (match/mismatch), action_taken

**Given** I want to review verification history
**When** I query the audit log
**Then** I can filter by project, story, date range, or result type

### Story 3.6: Verification Status UI Components

As a **user**,
I want **to see claimed vs verified status clearly in the dashboard**,
So that **I know which statuses are trustworthy**.

**Acceptance Criteria:**

**Given** a story status is displayed
**When** verification is pending
**Then** I see a gray spinner with "Verifying..."

**Given** verification completed successfully
**When** claimed matches actual
**Then** I see a gold checkmark badge with "Verified Xm ago"

**Given** a status mismatch was detected
**When** the UI renders
**Then** I see a red warning badge
**And** the display shows: "Claimed: done | Verified: in-progress"
**And** action buttons appear: [Re-verify] [View Details]

---

## Epic 4: Agent Control & Recovery

User can kill stuck agents, retry failed stories, and investigate issues from the dashboard.

### Story 4.1: Kill Agent API & Backend

As a **system**,
I want **an API endpoint to forcibly terminate a Claude instance**,
So that **stuck agents can be stopped without SSH access** (FR44).

**Acceptance Criteria:**

**Given** an agent is running
**When** `POST /api/agents/:id/kill` is called
**Then** the Claude subprocess is terminated via SIGTERM
**And** if not terminated within 5 seconds, SIGKILL is sent
**And** the agent status is updated to "killed"
**And** the action is logged in audit_log

**Given** the agent ID doesn't exist
**When** the kill endpoint is called
**Then** a 404 error is returned with message "Agent not found"

### Story 4.2: Kill Agent Dashboard Button

As a **user**,
I want **to kill a stuck agent with one click from the dashboard**,
So that **I can quickly recover from stuck situations** (FR44).

**Acceptance Criteria:**

**Given** I see an agent in the activity panel
**When** I click the [Kill] button
**Then** a confirmation dialog appears: "Kill agent working on Story X.Y?"
**And** the dialog has [Cancel] and [Kill Agent] (red) buttons

**Given** I confirm the kill action
**When** the API call completes
**Then** the agent disappears from the active list
**And** a toast notification confirms "Agent terminated"
**And** the story status updates to show it can be retried

### Story 4.3: Retry Story API & Backend

As a **system**,
I want **an API endpoint to retry a failed or killed story**,
So that **work can resume without manual intervention** (FR45).

**Acceptance Criteria:**

**Given** a story is in failed/killed state
**When** `POST /api/stories/:id/retry` is called
**Then** the story status is reset to "pending"
**And** a new Claude agent is spawned for that story
**And** the retry is logged in audit_log

**Given** the story is already in progress
**When** retry is called
**Then** a 400 error is returned: "Story already in progress"

**Given** max retries exceeded (configurable, default 3)
**When** retry is called
**Then** a warning is returned but retry proceeds
**And** the user is warned: "This story has failed X times"

### Story 4.4: Retry Story Dashboard Button

As a **user**,
I want **to retry a failed story with one click**,
So that **I can quickly recover from failures** (FR45).

**Acceptance Criteria:**

**Given** a story is in failed state
**When** I view the project details
**Then** a [Retry] button appears next to the failed story

**Given** I click [Retry]
**When** the API call succeeds
**Then** the story status changes to "pending" then "in-progress"
**And** a new agent appears in the activity panel
**And** a toast confirms "Retrying Story X.Y"

### Story 4.5: Log Viewer Panel

As a **user**,
I want **to view streaming logs from an agent**,
So that **I can investigate issues when something goes wrong** (FR42).

**Acceptance Criteria:**

**Given** I click [View Logs] on an agent or project
**When** the log viewer opens
**Then** a slide-in panel appears from the right (50% width)
**And** the panel has a dark background (#0B0E11) for contrast
**And** logs display in JetBrains Mono font, 13px

**Given** the agent is still running
**When** new output is produced
**Then** logs stream in real-time via WebSocket
**And** auto-scroll keeps the latest logs visible (toggle available)

**Given** I want to search logs
**When** I press Cmd/Ctrl+F
**Then** a search box appears
**And** I can filter by level: error, warn, info

**Given** I want to close the panel
**When** I press Escape or click outside
**Then** the panel closes

### Story 4.6: Stuck Agent Detection & Alerts

As a **system**,
I want **to detect when an agent is stuck and alert the user**,
So that **problems are surfaced before wasting too much time** (FR7 enhancement).

**Acceptance Criteria:**

**Given** an agent has been running
**When** no output is received for the stuck threshold (configurable, default 30 minutes)
**Then** the agent is marked as "stuck"
**And** the stuckAt timestamp is recorded

**Given** an agent becomes stuck
**When** the status changes
**Then** a WebSocket event broadcasts `{ type: "agent:stuck", data: { agentId, duration } }`
**And** the UI shows a warning indicator on that agent
**And** [Kill] and [View Logs] buttons become prominent

### Story 4.7: Execution History View

As a **user**,
I want **to view execution history and reports**,
So that **I can review what happened across past runs** (FR46).

**Acceptance Criteria:**

**Given** I navigate to execution history
**When** the history view loads
**Then** I see a list of past orchestration runs
**And** each run shows: date, project, stories completed, stories failed, duration

**Given** I click on a past run
**When** the detail view opens
**Then** I see the timeline of events: agent spawns, completions, verifications, errors
**And** I can expand any event to see details

**Given** I want to filter history
**When** I use the filter controls
**Then** I can filter by: project, date range, status (success/failed)

---

## Epic 5: Notifications & Alerts

User gets notified when approval is needed, agents are stuck, or projects complete without constantly monitoring.

### Story 5.1: Notification Service Backend

As a **system**,
I want **a notification service that routes events to configured channels**,
So that **important events reach the user regardless of dashboard state** (FR51).

**Acceptance Criteria:**

**Given** a notifiable event occurs (approval needed, stuck agent, completion, error)
**When** the notification service receives it
**Then** it routes to all configured channels
**And** channels include: console (always), dashboard (always), webhook (if configured), Slack (if configured)

**Given** notification configuration exists in secrets file
**When** the service initializes
**Then** it reads webhook_url and slack_webhook_url if present
**And** validates URLs are reachable

### Story 5.2: Toast Notification UI

As a **user**,
I want **toast notifications for important events in the dashboard**,
So that **I see alerts even if not looking at the relevant project**.

**Acceptance Criteria:**

**Given** an event requires user attention
**When** a notification is triggered
**Then** a toast appears in the bottom-right corner
**And** toasts stack (max 3 visible)

**Given** different notification types
**When** toasts render
**Then** styling matches type: yellow (approval), red (stuck/error), gold (complete), gray (info)
**And** approval/error toasts persist until dismissed
**And** info/success toasts auto-dismiss after 5-10 seconds

**Given** a toast has an action
**When** I click the action button (e.g., [Approve], [View])
**Then** I am taken to the relevant view
**And** the toast dismisses

### Story 5.3: Approval Required Notification

As a **user**,
I want **to be notified when an agent needs my approval**,
So that **I can unblock work quickly** (FR47).

**Acceptance Criteria:**

**Given** an agent reaches an approval checkpoint
**When** approval is needed
**Then** a toast notification appears: "Project X: Approval needed"
**And** the toast has an [Approve] action button
**And** clicking [Approve] opens the approval modal

**Given** webhook is configured
**When** approval is needed
**Then** a POST request is sent to webhook_url
**And** payload includes: project, story, approval_type, timestamp

**Given** Slack is configured
**When** approval is needed
**Then** a message is sent to the Slack channel
**And** message includes project name and link to dashboard

### Story 5.4: Stuck Agent Notification

As a **user**,
I want **to be notified when an agent is stuck**,
So that **I can kill and retry before wasting hours** (FR48).

**Acceptance Criteria:**

**Given** an agent is detected as stuck
**When** the stuck event fires
**Then** a red toast appears: "Agent stuck on Story X.Y for Zh Zm"
**And** the toast has [Kill] and [View Logs] action buttons

**Given** webhook is configured
**When** agent is stuck
**Then** webhook is called with: agentId, storyId, duration, project

**Given** Slack is configured
**When** agent is stuck
**Then** Slack message says: "⚠️ Agent stuck: [Project] Story X.Y - no activity for Zh Zm"

### Story 5.5: Project/Epic Completion Notification

As a **user**,
I want **to be notified when a project or epic completes**,
So that **I know my work is done without checking constantly** (FR49).

**Acceptance Criteria:**

**Given** all stories in an epic complete and verify
**When** the epic is marked done
**Then** a gold toast appears: "Epic X complete: [Epic Title]"
**And** the toast auto-dismisses after 10 seconds

**Given** all epics in a project complete
**When** the project is marked done
**Then** a persistent gold toast appears: "Project complete: [Project Name]"
**And** the toast has a [View Summary] action button
**And** webhook/Slack are notified with completion details

### Story 5.6: Critical Error Notification

As a **user**,
I want **to be notified immediately when a critical error occurs**,
So that **I can investigate and recover quickly** (FR50).

**Acceptance Criteria:**

**Given** a critical error occurs (orchestrator crash, database error, auth failure)
**When** the error is caught
**Then** a red toast persists until dismissed: "Critical error: [message]"
**And** the toast has [View Logs] action

**Given** webhook is configured
**When** critical error occurs
**Then** webhook is called immediately with error details

**Given** Slack is configured
**When** critical error occurs
**Then** Slack message uses alert emoji and includes error message and timestamp

### Story 5.7: Notification Preferences Configuration

As a **user**,
I want **to configure which notifications I receive on which channels**,
So that **I'm not overwhelmed but don't miss important events** (FR51).

**Acceptance Criteria:**

**Given** I access settings
**When** I view notification preferences
**Then** I see a matrix of event types vs channels
**And** I can toggle each combination on/off

**Given** I change a preference
**When** I save settings
**Then** preferences are persisted to the database
**And** take effect immediately without restart

**Given** default preferences
**When** no customization is made
**Then** all events go to console + dashboard
**And** critical/approval events go to webhook/Slack if configured

---

## Epic 6: Visual Verification (Phase 2 - Deferred)

Agents can "see" what they built and self-correct visual issues automatically.

**FRs covered:** FR52, FR53, FR54, FR55, FR56, FR57

_Stories to be defined when Phase 2 begins._

---

## Epic 7: Multi-Project Support (Phase 3 - Deferred)

User can orchestrate multiple projects simultaneously with isolated state.

**FRs covered:** FR58, FR59, FR60, FR61

_Stories to be defined when Phase 3 begins._
