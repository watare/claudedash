---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
workflowComplete: true
completedAt: 2026-01-15
inputDocuments:
  - src/orchestrator.js
  - src/server.js
  - src/claude-runner.js
  - src/story-worker.js
  - src/epic-worker.js
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 5
classification:
  projectType: developer_tool
  domain: general
  complexity: high
  projectContext: brownfield
workflowType: 'prd'
date: 2026-01-15
author: Ubuntu
project_name: bmad-orchestrator
---

# Product Requirements Document - bmad-orchestrator

**Author:** Ubuntu
**Date:** 2026-01-15
**Project:** ~/bmad-orchestrator
**Status:** Brownfield (core orchestration exists, enhancements needed)

## Executive Summary

**bmad-orchestrator** is a Claude Instance Lifecycle Orchestrator that automates the BMAD development workflow. It spawns, monitors, and closes Claude Code instances to execute development tasks in parallel - from epic creation through code review - with visual verification capabilities.

**Core Innovation:** You create the PRD, then hand off to the orchestrator. It pilots multiple Claude agents through BMAD workflows (dev-story, code-review, etc.) with 95% autonomy. You only approve architecture decisions and get notified when it's done.

**Target User:** Solo developer using AI-assisted development who wants to scale to multiple parallel projects without manual intervention.

---

## Current State (What's Already Built)

### Existing Components

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| **Core Orchestrator** | `src/orchestrator.js` | ✅ Built | Parses epics, builds execution plan, runs batches |
| **Claude Runner** | `src/claude-runner.js` | ✅ Built | Subprocess spawning with `--dangerously-skip-permissions` |
| **Epic Worker** | `src/epic-worker.js` | ✅ Built | Parallel epic execution with batch support |
| **Story Worker** | `src/story-worker.js` | ✅ Built | Parallel story execution within epics |
| **Parser** | `src/parser.js` | ✅ Built | Parses epics.md and sprint-status.yaml |
| **Config System** | `src/config.js` | ✅ Built | YAML config loading and validation |
| **Web Dashboard** | `src/server.js` | ✅ Built | Express + WebSocket + basic auth |
| **Systemd Service** | `bmad-orchestrator.service` | ✅ Ready | Production deployment |
| **Nginx Config** | `claudedash.padaw.ovh.nginx` | ✅ Ready | Reverse proxy setup |

### Existing Capabilities

- Parse epics.md to get all epics/stories
- Parse sprint-status.yaml to get current state
- Build execution plan (what needs to run)
- Run epics in parallel batches (configurable batch size)
- Run stories within epics in parallel
- Track story status transitions
- Generate execution reports
- Web dashboard with real-time WebSocket updates
- Basic authentication for dashboard

### Configuration Already Supports

```yaml
epicBatchSize: 2              # Parallel epic batches
maxParallelStories: 4         # Stories per epic
claudeCommand: claude         # CLI command
claudeModel: opus             # Model selection
claudeTimeout: 600000         # 10 min timeout
maxReviewIterations: 5        # Code review loops
baseBranch: main              # Git base branch
autoCommit: true              # Auto commit changes
autoPush: true                # Auto push to remote
dashboardPort: 3456           # Dashboard port
```

---

## What's Missing (PRD Focus)

### Critical Missing Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **Status Verification Loop** | P0 - CRITICAL | Never trust agent claims, always verify YAML |
| **Visual Verification** | P1 | Playwright screenshots → agent feedback |
| **Multi-Project Support** | P1 | Handle N projects simultaneously |
| **`bmad-orchestrator init`** | P2 | One-command project setup |
| **Better Dashboard UI** | P2 | React dashboard vs basic HTML |
| **Notification System** | P2 | Slack/webhook notifications |

---

## Success Criteria

### User Success

**Core Success Moment:** *"I handed off a PRD and got a working product back without touching the keyboard."*

| Metric | Target | Rationale |
|--------|--------|-----------|
| Autonomy Rate | 95%+ | Workflows complete without intervention |
| Intervention Type | Architecture approval only | No debugging, no manual fixes |
| Parallel Projects | 3+ simultaneously | Scale without context switching |
| Notification-based | 100% | Never poll for status - get pinged when needed |

**Emotional Arc:** Hand off PRD → Occasional "approve?" ping → "It's done" notification

### Business Success

| Timeline | Metric | Target |
|----------|--------|--------|
| Per Project | Time to working product | 10x faster than manual |
| Per Day | Projects in flight | 3-5 concurrent |
| Per Week | PRDs → Deployed products | 2-3 complete |

**Leading Indicators:**
- Stories completed per day (autonomous)
- % of PRs passing CI on first attempt
- Epic completion rate without human intervention

### Technical Success

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Claude instance reliability | 99%+ spawn/close success | Can't have orphan processes |
| BMAD compliance | 100% | Branch per dev, merge at epic, review workflow |
| Visual verification accuracy | Catches 90%+ of UI regressions | Agents must "see" correctly |
| Cross-project isolation | Zero conflicts | Parallel projects don't interfere |
| Notification latency | <1 min | Know immediately when approval needed |

### Measurable Outcomes

**MVP Validation Questions:**
1. ✅ Can it spawn and close Claude instances reliably? (EXISTS)
2. ✅ Do agents follow BMAD workflows correctly? (EXISTS)
3. ❌ Does visual feedback enable self-correction? (MISSING)
4. ❌ Can you run 3+ projects without conflicts? (MISSING)
5. ❌ Does "call me when done" actually work? (PARTIAL - needs notifications)

---

## Product Scope (Updated for Brownfield)

### Already Built (MVP Core)

1. ✅ **Claude Lifecycle Manager** - Spawn, monitor, close instances
2. ✅ **Workflow Invoker** - Launch BMAD workflows via subprocess
3. ✅ **Basic Status Monitor** - Watch YAML files for state transitions
4. ✅ **Sequential Phase Execution** - Epics → Stories → Review
5. ✅ **Single Project Support** - Works for one project
6. ✅ **Basic Dashboard** - WebSocket real-time updates

### Phase 1: Critical Enhancements (Next)

1. **Status Verification Loop** (P0)
   - Never trust agent's status claim
   - Read YAML directly after agent completion
   - Relaunch verification workflow if mismatch
   - Only proceed when 100% confirmed

2. **Visual Verification** (P1)
   - Playwright integration for screenshots
   - Visual diff engine (baseline comparison)
   - Feed results back to agent via MCP or file
   - Agent self-correction based on visual feedback

### Phase 2: Multi-Project & UX

- **Multi-project parallel execution** - Handle N projects simultaneously
- **`bmad-orchestrator init`** - One-command project setup
- **Notification system** - Slack/webhook for approvals and completion
- **React Dashboard** - Better UI using existing component patterns

### Vision (Future)

- **Fully autonomous** - 99% no-touch from PRD to deployed
- **Self-healing** - Detect stuck agents, restart, recover
- **Learning** - Remember your preferences, reduce approval requests over time
- **Portfolio mode** - Manage 10+ projects simultaneously
- **CI/CD native** - Integrate with GitHub Actions, deploy automatically

---

## User Journeys

### Journey 1: The Handoff — "PRD to Working Product"

**Opening Scene:**
It's Monday morning. You've just finished the PRD for a new SaaS tool over the weekend using the BMAD workflow. You have 3 other projects in various stages. You don't want to spend 2 weeks implementing this one manually.

**Rising Action:**
You open bmad-orchestrator's dashboard (or CLI). You point it at the project:
```bash
cd ~/my-project
bmad-orchestrator start
```

The orchestrator reads the epics, spawns dev Claudes in parallel. You get a terminal notification:
> "Project X: Epic 1 in progress. 4 agents working. ETA: ~3 hours."

You switch to another project. Three hours later:
> "Project X: Epic 1 complete. 4 stories done. Code review starting."

You didn't touch the keyboard once.

**Resolution:**
By end of day, you get:
> "Project X: DONE. All tests passing. Deployed to staging."

You review the PRs, merge to main. One project done. Four more in flight.

**Capabilities Revealed:**
- ✅ Parallel agent spawning (EXISTS)
- ✅ Progress tracking (EXISTS)
- ❌ Approval routing with notification (NEEDS ENHANCEMENT)
- ❌ Completion notification (NEEDS ENHANCEMENT)

---

### Journey 2: Multi-Project Juggling — "Portfolio Mode"

**Opening Scene:**
You have 5 projects in different states:
- Project A: Architecture review pending (your approval needed)
- Project B: Epic 2, Story 3 in dev
- Project C: Code review in progress
- Project D: Waiting for PRD (you haven't finished it)
- Project E: Done, deployed yesterday

**Rising Action:**
You open the dashboard:
```
┌─────────────────────────────────────────────────────────────┐
│ bmad-orchestrator Dashboard                                  │
├─────────────────────────────────────────────────────────────┤
│ Project A    ⏸️  WAITING: Arch approval     [Approve] [View] │
│ Project B    🔄 IN PROGRESS: E2.S3 dev      3/7 stories     │
│ Project C    🔍 REVIEW: E1.S4 code-review   2 issues found  │
│ Project D    ⬜ NOT STARTED: No PRD                          │
│ Project E    ✅ DONE: Deployed 2026-01-14                    │
└─────────────────────────────────────────────────────────────┘
```

**Capabilities Revealed:**
- ✅ Basic dashboard (EXISTS)
- ❌ Multi-project view (MISSING)
- ❌ One-click approvals (MISSING)
- ❌ Project lifecycle visibility (MISSING)

---

### Journey 3: The Stuck Agent — "Recovery Mode"

**Opening Scene:**
It's 2am. An agent working on Project B, Story 2.4 has been "in progress" for 3 hours. Normal stories take 30-45 minutes.

**Rising Action:**
The orchestrator detects the anomaly and pings you (or handles automatically based on config):
> "⚠️ Project B: Agent stuck on Story 2.4. Last activity: 2h ago. Options: [Kill & Retry] [View Logs] [Escalate to Human]"

**Capabilities Revealed:**
- ✅ Log viewing (EXISTS - via journalctl)
- ❌ Stuck agent detection (NEEDS ENHANCEMENT)
- ❌ Alert/notification system (MISSING)
- ❌ Kill & retry from dashboard (MISSING)

---

### Journey 4: Visual Verification — "The Agent That Can See"

**Opening Scene:**
A dev agent finishes implementing a React component per the story acceptance criteria. The code compiles, tests pass. But does it actually look right?

**Rising Action:**
The orchestrator triggers visual verification:
1. Spins up the dev server
2. Playwright captures screenshots of the new component
3. Compares against baseline (or UX spec wireframes if available)
4. Feeds diff back to the agent

The agent receives:
> "Visual diff detected: Button is gold (#F0B90B) but spec says primary blue (#3B82F6). Confidence: 92%"

**Climax:**
The agent self-corrects:
> "Updating button color to match spec. Re-running visual check..."

Screenshot matches. Agent marks story as ready for review.

**Capabilities Revealed:**
- ❌ Playwright/browser integration (MISSING)
- ❌ Screenshot capture (MISSING)
- ❌ Visual diff engine (MISSING)
- ❌ Feedback loop to agent (MISSING)
- ❌ Self-correction capability (MISSING)

---

### Journey Requirements Summary

| Journey | Key Capabilities | Status |
|---------|------------------|--------|
| **Handoff** | Parallel agents, progress tracking | ✅ Mostly built |
| **Multi-Project** | Dashboard, multi-project view | ❌ Missing |
| **Stuck Agent** | Anomaly detection, alerting | ❌ Missing |
| **Visual Verification** | Playwright, screenshots, diff | ❌ Missing |

---

## Innovation & Novel Patterns

### Core Innovation: AI-Orchestrated AI Development

**The Gap Being Filled:**
- **Manual Claude Code**: One Claude, manual guidance, slow
- **Existing CI/CD**: Runs tests, doesn't write code
- **AI coding assistants**: Write code, can't see results
- **bmad-orchestrator**: N Claude agents + BMAD workflows + visual verification + status obsession

### Innovation Areas

| Innovation | Description | Status |
|------------|-------------|--------|
| **Multi-Claude Orchestration** | Spawn, monitor, close N instances in parallel | ✅ Built |
| **BMAD-Native** | Understands methodology, not just commands | ✅ Built |
| **Visual Feedback Loop** | Screenshots → agent → self-correction | ❌ Missing |
| **Status-Obsessed Verification** | Never trust, always verify YAML status | ❌ Missing (CRITICAL) |
| **Human-out-of-loop** | 95% autonomous with defensive verification | 🔄 Partial |

### Status Verification Pattern (CRITICAL - NOT YET IMPLEMENTED)

**Critical Principle:**
> "Better to relaunch and verify than continue if unsure. We gain time on parallelization, not by having wrong status or skipping tests."

```
Agent completes work
    ↓
Agent claims: "Story done, status=review"
    ↓
Orchestrator: DON'T TRUST - VERIFY
    ↓
┌─────────────────────────────────────┐
│ Verification Loop:                   │
│ 1. Read YAML file directly           │
│ 2. Check status matches claim        │
│ 3. If mismatch → relaunch workflow   │
│ 4. Ask Claude to re-verify           │
│ 5. Only proceed when 100% confirmed  │
└─────────────────────────────────────┘
    ↓
Status verified → Close agent → Launch next
```

**Key Rules:**

| Rule | Rationale |
|------|-----------|
| **Never trust agent's claim** | Always read YAML directly |
| **If unsure, verify** | Relaunch verification workflow |
| **No skipping tests** | Tests are part of status verification |
| **Defensive over fast** | Speed comes from parallelization, not shortcuts |

### Risk Mitigation

| Risk | Mitigation | Status |
|------|------------|--------|
| **Wrong status cascades** | Verify every status transition, relaunch if unsure | ❌ Not implemented |
| **Agent gets stuck** | Timeout detection, kill & retry | 🔄 Partial (timeout exists) |
| **Visual diff false positive** | Confidence threshold, human escalation | ❌ Not implemented |
| **Parallel conflicts** | Branch isolation, rebase before merge | ✅ Built |

---

## Developer Tool Specific Requirements

### Technical Architecture (Already Established)

| Component | Technology | Status |
|-----------|------------|--------|
| **CLI/Orchestrator** | Node.js (ES Modules) | ✅ Built |
| **Dashboard** | Express + WebSocket | ✅ Built (basic) |
| **Process Management** | execa + child_process | ✅ Built |
| **Queue Management** | p-queue | ✅ Built |
| **Config** | js-yaml | ✅ Built |

### Claude Integration (Already Implemented)

```javascript
// From claude-runner.js - spawns with --dangerously-skip-permissions
const claude = spawn('claude', [
  '--dangerously-skip-permissions',
  '--project', projectPath,
  ...args
]);
```

### Installation Methods

**Current (works):**
```bash
git clone https://github.com/your-org/bmad-orchestrator.git
cd bmad-orchestrator
npm install
npm start
```

**Needed: `bmad-orchestrator init`**
```bash
bmad-orchestrator init my-project
# Creates: folder, git init, bmad install, config
```

### CLI Command Structure (Current)

```bash
# Current
npm start                    # Start dashboard + orchestrator
npm run cli                  # CLI mode

# Needed additions
bmad-orchestrator init <name>    # Project setup
bmad-orchestrator status         # Multi-project status
bmad-orchestrator logs <agent>   # View agent logs
```

---

## Implementation Priority

### P0 - Critical (Do First)

1. **Status Verification Loop**
   - Add verification step after every agent completion
   - Read YAML directly, compare with agent's claim
   - Relaunch if mismatch
   - This is the difference between working and broken orchestration

2. **GitHub OAuth SSO**
   - Replace basic auth with GitHub OAuth
   - Single allowed user (you)
   - Session-based authentication

3. **Secrets Management**
   - Secure credential storage (gitignored)
   - GitHub token, SSH keys, API keys
   - Environment-based configuration

### P1 - Important (Do Next)

4. **Visual Verification Integration**
   - Add Playwright as dependency
   - Create screenshot capture module
   - Build simple diff comparison
   - Feed results back to agent

5. **Multi-Project Support**
   - Track multiple project roots
   - Independent orchestration per project
   - Dashboard shows all projects

6. **Stuck Agent Detection**
   - Timeout monitoring
   - Alert on stuck agents
   - Kill & retry capability

### P2 - Nice to Have (Later)

7. **Project Init Command**
8. **Notification System (Slack/Webhook)**
9. **Better Dashboard UI (React)**
10. **VPS Deployment via SSH**
11. **OVH DNS Automation**

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP - Make what exists actually reliable and secure

**Key Insight:** Core orchestration is built but fragile. Without status verification, one wrong status = cascading failures. Without proper auth, full infrastructure access is behind a basic password.

### Infrastructure & Secrets Management

**What the orchestrator needs access to:**

| Service | Access Type | Use Case |
|---------|-------------|----------|
| **GitHub** | Personal Access Token | Create repos, branches, PRs, merge |
| **VPS (SSH)** | SSH key | Deploy apps, run servers |
| **OVH (future)** | API key | Create DNS records, map domains |
| **Claude API** | Via CLI | Spawn Claude instances |

**Secrets Configuration:**
```yaml
# bmad-orchestrator.secrets.yaml (gitignored)
github:
  token: ghp_xxxxxxxxxxxx
  username: your-username

vps:
  host: your-vps.padaw.ovh
  user: ubuntu
  ssh_key: ~/.ssh/id_rsa

auth:
  provider: github
  github_client_id: xxx
  github_client_secret: xxx
  allowed_users:
    - your-github-username

ovh: # future
  application_key: xxx
  application_secret: xxx
  consumer_key: xxx
```

### Authentication: GitHub OAuth SSO

**Required:** SSO authentication, not basic password

```
Login Flow:
1. User visits claudedash.padaw.ovh
2. Redirect to GitHub OAuth
3. User authorizes app
4. Verify user = allowed user
5. Create session, redirect to dashboard
```

### Phase 1: "Make It Reliable & Secure" (MVP)

**Goal:** Core orchestration that doesn't break and is properly secured

| Feature | Priority | Status |
|---------|----------|--------|
| Status Verification Loop | P0 | Not implemented |
| GitHub OAuth SSO | P0 | Not implemented (has basic auth) |
| Secrets management | P0 | Partial |
| Stuck agent timeout + alert | P1 | Not implemented |
| GitHub integration (branch, PR) | P1 | Partial |

**Success criteria:**
- Run full epic → all stories complete → no false status transitions
- Dashboard secured with GitHub SSO
- Secrets properly managed and gitignored

### Phase 2: "Give Agents Eyes"

**Goal:** Visual feedback enables self-correction

| Feature | Status |
|---------|--------|
| Playwright integration | Not implemented |
| Screenshot capture | Not implemented |
| Visual diff comparison | Not implemented |
| Feed results to agent | Not implemented |

**Success criteria:** Agent builds component → sees it looks wrong → fixes it

### Phase 3: "Scale Up"

**Goal:** Multiple projects, better UX, deployment automation

| Feature | Status |
|---------|--------|
| Multi-project support | Not implemented |
| React dashboard | Not implemented |
| Slack notifications | Not implemented |
| VPS deployment via SSH | Not implemented |
| `bmad-orchestrator init` | Not implemented |

**Success criteria:** 3 projects running simultaneously, auto-deploy to VPS

### Phase 4: "Fully Autonomous" (Vision)

- OVH DNS automation (create URLs, map to nginx)
- Self-healing (auto-restart stuck agents)
- Learning from failures
- Portfolio mode (10+ projects)
- CI/CD integration

### Full Autonomous Flow (Vision)

```
PRD → Orchestrator → Claude agents build code
                   → Git push to branch
                   → Create PR
                   → Code review passes
                   → Merge to main
                   → SSH to VPS
                   → Pull latest, restart service
                   → Create DNS record via OVH
                   → Configure nginx
                   → "Done! https://my-app.padaw.ovh is live"
```

### Risk Mitigation Strategy

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Status verification adds latency | Medium | Low | Verify async, don't block |
| Playwright flaky in CI | High | Medium | Retry logic, confidence thresholds |
| Multi-project conflicts | Medium | High | Full isolation per project |
| Secrets exposure | Low | Critical | Gitignore, env vars, no logging |
| GitHub OAuth token expiry | Low | Medium | Refresh token handling |

---

## Functional Requirements

### 1. Claude Instance Lifecycle

- **FR1:** System can spawn a new Claude Code instance with specified project path and workflow command
- **FR2:** System can monitor Claude instance stdout/stderr in real-time
- **FR3:** System can detect when a Claude instance completes its workflow
- **FR4:** System can forcibly terminate a Claude instance
- **FR5:** System can track all active Claude instances with their status
- **FR6:** System can configure timeout duration per workflow type
- **FR7:** System can detect stuck instances (no activity for configured duration)

### 2. Status Verification

- **FR8:** System can read YAML status files directly from disk
- **FR9:** System can compare agent-claimed status against actual YAML file status
- **FR10:** System can detect status mismatches between agent claim and YAML
- **FR11:** System can trigger re-verification workflow when status mismatch detected
- **FR12:** System can block progression until status is verified
- **FR13:** System can log all status verification attempts and results

### 3. Workflow Orchestration

- **FR14:** System can parse epics.md file to extract epic and story structure
- **FR15:** System can parse sprint-status.yaml to determine current state
- **FR16:** System can build execution plan based on pending/in-progress work
- **FR17:** System can execute multiple epics in parallel (configurable batch size)
- **FR18:** System can execute multiple stories within an epic in parallel
- **FR19:** System can invoke BMAD workflows (/dev-story, /code-review, etc.)
- **FR20:** System can track story status transitions (draft → in-progress → review → done)
- **FR21:** System can pause orchestration at configurable checkpoints
- **FR22:** System can resume orchestration from last checkpoint

### 4. Authentication & Authorization

- **FR23:** User can authenticate via GitHub OAuth SSO
- **FR24:** System can restrict dashboard access to configured allowed users
- **FR25:** System can maintain user session across requests
- **FR26:** System can invalidate user session on logout
- **FR27:** System can redirect unauthenticated requests to OAuth flow

### 5. Secrets Management

- **FR28:** System can load secrets from gitignored configuration file
- **FR29:** System can store GitHub personal access token securely
- **FR30:** System can store SSH key paths for VPS access
- **FR31:** System can store GitHub OAuth client credentials
- **FR32:** System can prevent secrets from appearing in logs
- **FR33:** System can validate that required secrets are configured before starting

### 6. Git Operations

- **FR34:** System can create feature branches per story
- **FR35:** System can commit changes with structured commit messages
- **FR36:** System can push branches to remote repository
- **FR37:** System can create pull requests via GitHub API
- **FR38:** System can merge pull requests when approved
- **FR39:** System can rebase branches when conflicts detected

### 7. Dashboard & Monitoring

- **FR40:** User can view orchestration status in web dashboard
- **FR41:** User can view list of all active Claude instances
- **FR42:** User can view real-time logs from running instances
- **FR43:** User can view epic/story progress with status indicators
- **FR44:** User can kill a specific Claude instance from dashboard
- **FR45:** User can trigger retry for a failed story from dashboard
- **FR46:** User can view execution history and reports

### 8. Notifications & Alerting

- **FR47:** System can notify user when approval is required
- **FR48:** System can notify user when agent is stuck
- **FR49:** System can notify user when epic/project completes
- **FR50:** System can notify user when critical error occurs
- **FR51:** User can configure notification channels (console, webhook, Slack)

### 9. Visual Verification (Phase 2)

- **FR52:** System can launch browser via Playwright
- **FR53:** System can capture screenshots of specified URLs/components
- **FR54:** System can compare screenshots against baseline images
- **FR55:** System can calculate visual diff confidence score
- **FR56:** System can feed visual diff results back to Claude agent
- **FR57:** System can store baseline screenshots for comparison

### 10. Multi-Project Support (Phase 3)

- **FR58:** System can track multiple projects simultaneously
- **FR59:** System can maintain isolated state per project
- **FR60:** User can view all projects in unified dashboard
- **FR61:** User can start/stop orchestration per project independently

---

## Non-Functional Requirements

### Performance

| NFR | Requirement | Rationale |
|-----|-------------|-----------|
| **NFR-P1** | Claude instance spawns within 5 seconds | Fast agent startup for throughput |
| **NFR-P2** | Status verification completes within 2 seconds | Don't bottleneck orchestration |
| **NFR-P3** | Dashboard updates via WebSocket within 500ms | Real-time feel |
| **NFR-P4** | Log streaming has < 1 second latency | Debugging visibility |
| **NFR-P5** | System handles 10+ concurrent Claude instances | Parallel execution target |

### Security

| NFR | Requirement | Rationale |
|-----|-------------|-----------|
| **NFR-S1** | All dashboard access requires GitHub OAuth SSO | No basic passwords |
| **NFR-S2** | Only configured GitHub users can access dashboard | Whitelist enforcement |
| **NFR-S3** | Secrets never appear in logs or stdout | Prevent credential leaks |
| **NFR-S4** | Secrets file is gitignored and excluded from backup | Source control protection |
| **NFR-S5** | OAuth sessions expire after 24 hours of inactivity | Session hygiene |
| **NFR-S6** | SSH connections use key-based auth only, no passwords | VPS access security |
| **NFR-S7** | GitHub tokens use minimum required scopes | Principle of least privilege |

### Scalability (Workload)

| NFR | Requirement | Rationale |
|-----|-------------|-----------|
| **NFR-W1** | System supports 3+ projects running simultaneously | Multi-project goal |
| **NFR-W2** | Each project can run 4+ Claude instances in parallel | Configurable parallelism |
| **NFR-W3** | System gracefully handles resource exhaustion | Don't crash, queue or reject |
| **NFR-W4** | Adding new project doesn't impact running projects | Isolation |

### Integration

| NFR | Requirement | Rationale |
|-----|-------------|-----------|
| **NFR-I1** | Works with Claude Code CLI via subprocess | Core integration |
| **NFR-I2** | Supports `--dangerously-skip-permissions` flag | Autonomous execution |
| **NFR-I3** | Parses BMAD YAML frontmatter correctly | Status tracking |
| **NFR-I4** | GitHub API calls handle rate limits gracefully | Don't fail on throttle |
| **NFR-I5** | SSH connections support standard key formats (RSA, Ed25519) | VPS compatibility |

### Reliability

| NFR | Requirement | Rationale |
|-----|-------------|-----------|
| **NFR-R1** | Orchestrator survives individual Claude instance crashes | Fault isolation |
| **NFR-R2** | System cleans up orphan processes on restart | No zombie agents |
| **NFR-R3** | Dashboard remains accessible even during heavy orchestration | UX availability |
| **NFR-R4** | System can resume from checkpoint after crash | Don't lose progress |
| **NFR-R5** | All state is persisted to disk, not just in-memory | Crash recovery |
| **NFR-R6** | Systemd service auto-restarts on failure | Production resilience |
