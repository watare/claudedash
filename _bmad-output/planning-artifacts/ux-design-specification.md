---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
status: complete
inputDocuments:
  - prd.md
  - ~/optigo/_bmad-output/planning-artifacts/ux-design-specification.md
date: 2026-01-15
author: Ubuntu
project_name: bmad-orchestrator
designInheritance: optigo
---

# UX Design Specification bmad-orchestrator

**Author:** Ubuntu
**Date:** 2026-01-15

---

## Executive Summary

### Project Vision

bmad-orchestrator is a Claude Instance Lifecycle Orchestrator that automates the BMAD development workflow. The UX must embody the core promise: **"Hand off a PRD, get notified when it's done."**

The interface is a **command center** for managing multiple Claude agents working in parallel across multiple projects. You, the solo developer, are the executive - watching dashboards, approving architecture decisions when pinged, and deploying products without touching the keyboard.

### Design Inheritance

This UX specification inherits the established design language from **OptiGo** to maintain consistency across your tooling ecosystem:

| Inherited Element | Source | Application |
|-------------------|--------|-------------|
| **Dark Theme** | Binance-inspired palette | #0B0E11 background, professional feel |
| **Gold Accents** | OptiGo design system | #F0B90B for success states, active projects |
| **Tech Stack** | Radix UI + Tailwind CSS | Consistent component patterns |
| **Typography** | Inter + JetBrains Mono | Clean UI + precise metrics |

### Target User

**Primary Persona: You (Solo Developer with AI Fleet)**
- Running multiple AI-assisted projects simultaneously
- Context: Late night, laptop open, orchestrating agents
- Emotional state: Wants control without micromanagement
- Success moment: "I checked in, saw 3 projects progressing, approved one arch decision, went back to sleep"

### Key Design Challenges

1. **Information Density** - Multiple projects, multiple agents, multiple status streams. Must be scannable at a glance, not overwhelming.

2. **Status Trust** - The core innovation is status verification. UI must show verified vs claimed status clearly.

3. **Async Workflow** - User isn't constantly watching. Notifications must surface what needs attention; dashboard shows what's happening when you look.

4. **Agent Visibility** - Show what Claude agents are doing without exposing every log line. Right level of abstraction.

5. **Multi-Project Context** - Switch between projects without losing place. Each project is its own universe but dashboard unifies them.

### Design Opportunities

1. **Status-Obsessed UI** - Make verification visible. Show "verified" badges, highlight when status needs re-verification.

2. **Agent Activity Pulse** - Visual heartbeat showing agents are working. Not logs, but presence.

3. **Notification-First** - Design for "check when pinged" not "constantly monitor."

4. **Dark Mode Native** - Matches late-night work context. Easy on eyes during long sessions.

5. **One-Click Actions** - Approve, kill, retry - all from dashboard without CLI.

---

## Core User Experience

### Defining Experience

bmad-orchestrator's core experience is **watching autonomous agents execute your vision**. You don't "use a development tool" - you orchestrate a fleet of AI agents building your products in parallel.

The two primary activities are:

1. **Monitoring** - Glancing at dashboard to see progress across all projects
2. **Intervening** - Responding to pings (approve arch, kill stuck agent, retry failed story)

These activities are asynchronous. The UI is optimized for quick check-ins, not constant engagement.

### Platform Strategy

| Aspect | Decision |
|--------|----------|
| **Primary Platform** | Web dashboard (desktop browser) |
| **Input Method** | Mouse/keyboard, quick clicks |
| **Mobile Support** | Not priority - orchestration is a desktop activity |
| **Access Pattern** | Periodic check-ins, notification-driven |
| **Target Browsers** | Chrome, Firefox, Safari, Edge (modern versions) |

### Effortless Interactions

**Must Be Effortless:**

1. **Seeing Overall Status** - One glance tells you: how many projects, how many agents, anything needs attention?

2. **Approving a Decision** - Click approve, move on. No forms, no confirmation dialogs for routine approvals.

3. **Killing a Stuck Agent** - One click to terminate. Confirmation only for destructive actions.

4. **Switching Projects** - Sidebar click, context switches. No page reload.

**Can Require Effort (Acceptable Friction):**

- Initial project setup (one-time per project)
- Deep log investigation
- Configuration changes
- Secret management

### Critical Success Moments

| Moment | What Happens | Why It Matters |
|--------|--------------|----------------|
| **Fleet at Work** | Dashboard shows 3 projects, 8 agents, all green status | Confidence that system is working |
| **Verified Status** | See "verified" badge on completed story | Trust that it's actually done |
| **Pinged for Approval** | Notification arrives, one-click approve | Minimal interruption, maximum value |
| **Stuck Detection** | Alert: "Agent stuck for 2h" with kill button | System is self-aware, not silent failure |

### Experience Principles

1. **Status Obsession** - Verification is visible. Claimed vs verified status is always clear.

2. **Agent Abstraction** - Show activity, not logs. Right level of detail for executive view.

3. **Notification-Driven** - Dashboard is for when you want to look. Notifications are for when it needs you.

4. **Project Isolation** - Each project is independent. Multi-project view unifies without conflating.

5. **Trust Through Verification** - Never show "done" without verification. Better to show "verifying..." than false confidence.

---

## Desired Emotional Response

### Primary Emotional Goals

bmad-orchestrator must deliver **confident delegation**. You feel like a CEO with a team of AI developers working 24/7.

| Context | Emotion | Orchestrator's Role |
|---------|---------|---------------------|
| Checking dashboard | Control + Calm | Everything is visible, nothing hidden |
| Agent completes work | Trust | "Verified" badge means actually verified |
| Approval needed | Minimal friction | Quick action, back to your life |
| Agent stuck | Informed | Alert came, action is clear |
| Project done | Satisfaction | "Deployed to staging. Done." |

The emotional arc: **Delegate → Trust → Verify → Move On**

### Emotional Journey Mapping

| Stage | User State | Desired Emotion | Design Implication |
|-------|------------|-----------------|-------------------|
| **First Setup** | Skeptical but hopeful | Intrigued + Cautious | Show first agent working, prove it works |
| **Watching Agents** | Curious about progress | Confidence + Control | Activity indicators, not overwhelming logs |
| **Getting Pinged** | Interrupted briefly | Quick resolve | One-click actions, minimal context needed |
| **Seeing "Done"** | Ready to verify | Trust | Verified badge, link to PR/deployment |
| **Coming Back Next Day** | Resume monitoring | Continuity | State preserved, progress visible |

### Micro-Emotions

**Must Create:**

| Micro-Emotion | When It Happens | How We Create It |
|---------------|-----------------|------------------|
| **Trust** | Every "verified" badge | Green checkmark, only shown when actually verified |
| **Control** | Dashboard glance | All projects visible, quick actions available |
| **Calm** | No red alerts | Absence of problems is visible (all green) |
| **Clarity** | Checking specific project | Clear status breakdown, no ambiguity |

**Must Avoid:**

| Negative Emotion | Trigger Risk | Prevention |
|------------------|--------------|------------|
| **Anxiety** | Too many alerts, unclear status | Filter noise, only alert on actionable items |
| **Distrust** | False "done" status | Always show verification state |
| **Overwhelm** | Too much information | Progressive disclosure, executive view by default |
| **Helplessness** | Agent stuck with no action | Always show what you can do (kill, retry, view logs) |

### Design Implications

**Tool, Not Companion:**

When something goes wrong, bmad-orchestrator behaves as a **reliable tool**:

| Situation | Response Style |
|-----------|----------------|
| Agent stuck | "Agent X stuck for 2h. [Kill] [View Logs]" |
| Status mismatch | "Claimed: done. Verified: in-progress. [Re-verify]" |
| Auth failure | "GitHub token expired. Configure in secrets." |
| Project error | "Epic 2 failed. Error: [message]. [Retry] [Skip]" |

**No hand-holding. No emotional coddling. Clear information. Clear actions.**

---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

#### GitHub Actions - CI/CD Monitoring

**What They Do Well:**

| Pattern | How It Works | Why It Works |
|---------|--------------|--------------|
| **Workflow List** | Show all runs, status icons, timing | Scannable at a glance |
| **Live Logs** | Streaming output during execution | Visibility without overwhelming |
| **Re-run Actions** | One-click retry from UI | Low friction recovery |
| **Status Badges** | Pass/fail/running icons | Instant status recognition |

**Emotional Impact:** Confidence in automated processes, control over failures

#### Vercel Dashboard - Deployment Status

**What They Do Well:**

| Pattern | How It Works | Why It Works |
|---------|--------------|--------------|
| **Project Cards** | Each deployment is a card with status | Multi-project at a glance |
| **Real-time Updates** | Status changes without refresh | Feels alive |
| **One-click Rollback** | Instant action when needed | Emergency response |
| **Domain Status** | Shows URL + status together | Complete picture |

**Emotional Impact:** Trust in deployment pipeline, quick action when needed

#### Binance (Inherited from OptiGo)

**What We're Adopting:**

| Pattern | Application to Orchestrator |
|---------|----------------------------|
| **Dark Theme** | #0B0E11 background, professional command center feel |
| **Gold Accents** | Active/success states, primary actions |
| **Dense but Clear** | Multiple projects, clear hierarchy |
| **Monospace Numbers** | Agent counts, timing, metrics |

### Transferable UX Patterns

#### Navigation Patterns

| Pattern | Source | Orchestrator Application |
|---------|--------|-------------------------|
| **Project Sidebar** | Vercel | List all projects, click to switch |
| **Status Summary** | GitHub Actions | Top bar: X projects, Y agents, Z alerts |
| **Collapsible Details** | Both | Epic → Story → Agent expandable |

#### Interaction Patterns

| Pattern | Source | Orchestrator Application |
|---------|--------|-------------------------|
| **One-click Actions** | Both | Approve, kill, retry without modals |
| **Live Updates** | Both | WebSocket status changes |
| **Log Streaming** | GitHub Actions | Real-time agent output on demand |

#### Visual Patterns

| Pattern | Source | Orchestrator Application |
|---------|--------|-------------------------|
| **Dark Theme Default** | Binance/OptiGo | #0B0E11 canvas |
| **Status Colors** | Both | Green=done, Yellow=running, Red=failed |
| **Gold for Success** | Binance/OptiGo | #F0B90B for verified/complete |
| **Verification Badge** | Custom | Checkmark icon when status verified |

### Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Prevention |
|--------------|--------------|------------|
| **Log Overload** | Agent logs are verbose, overwhelming | Show activity indicator, logs on demand |
| **False Confidence** | Showing "done" without verification | Always show verification state |
| **Alert Fatigue** | Too many notifications | Only actionable alerts |
| **Modal Hell** | Blocking dialogs for routine actions | One-click where possible |
| **Hidden Status** | Status buried in details | Status visible in list view |

---

## Design System Foundation

### Design System Choice

**Primary Stack: Radix UI Primitives + Tailwind CSS** (Inherited from OptiGo)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Primitives** | Radix UI | Headless, accessible components |
| **Styling** | Tailwind CSS | Utility-first, Binance aesthetic |
| **Icons** | Lucide React | Clean, consistent icon set |
| **Real-time** | WebSocket | Live status updates |

### Color System (Binance-Inspired)

**Primary Palette:**

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | #0B0E11 | App background |
| `--bg-secondary` | #1E2329 | Cards, panels |
| `--bg-tertiary` | #2B3139 | Elevated surfaces, hover states |
| `--accent-gold` | #F0B90B | Success, verified, primary actions |
| `--accent-green` | #0ECB81 | Running, positive status |
| `--accent-red` | #F6465D | Failed, error, destructive |
| `--accent-yellow` | #FCD535 | Warning, pending verification |
| `--accent-blue` | #1E90FF | In progress, informational |
| `--text-primary` | #EAECEF | Headings, primary content |
| `--text-secondary` | #848E9C | Labels, secondary content |
| `--text-muted` | #5E6673 | Disabled, placeholder |
| `--border-default` | #2B3139 | Subtle borders |
| `--border-focus` | #F0B90B | Focus rings |

**Status Color Mapping:**

| Status | Color | Icon |
|--------|-------|------|
| **Verified Complete** | `--accent-gold` | Checkmark with badge |
| **Running** | `--accent-green` | Spinning indicator |
| **Pending** | `--text-secondary` | Clock |
| **In Progress** | `--accent-blue` | Progress bar |
| **Needs Attention** | `--accent-yellow` | Alert triangle |
| **Failed** | `--accent-red` | X mark |
| **Stuck** | `--accent-red` | Warning |

### Typography System

**Font Stack:**

| Role | Font | Fallback | Usage |
|------|------|----------|-------|
| **Numbers** | JetBrains Mono | monospace | Agent counts, timing, metrics |
| **UI** | Inter | system-ui, sans-serif | Headings, body, labels |

**Type Scale:**

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-xs` | 12px | 400 | Timestamps, minor labels |
| `--text-sm` | 14px | 400 | Body text, status text |
| `--text-base` | 16px | 400 | Primary body |
| `--text-lg` | 18px | 500 | Section headers |
| `--text-xl` | 20px | 600 | Page titles |
| `--text-mono-sm` | 14px | 500 | Metrics, counts |
| `--text-mono-lg` | 20px | 500 | Featured numbers |

### Spacing & Layout Foundation

**Spacing Scale (8px base):**

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight padding |
| `--space-2` | 8px | Default internal padding |
| `--space-3` | 12px | Component internal spacing |
| `--space-4` | 16px | Between related elements |
| `--space-6` | 24px | Section spacing |
| `--space-8` | 32px | Major section gaps |

**Layout Structure:**

```
+-----------------------------------------------------------+
|  HEADER (48px) - Logo, Status Summary, User Menu          |
+----------+------------------------------------------------+
|          |                                                |
| SIDEBAR  |              MAIN CONTENT                      |
| (200px)  |                                                |
|          |  Project Dashboard / Agent View / Logs         |
| Projects |                                                |
|          |                                                |
| + New    |                                                |
|          |                                                |
+----------+------------------------------------------------+
```

---

## Dashboard Layout & Components

### Main Dashboard View

**Layout: Multi-Project Overview**

```
+-----------------------------------------------------------+
| bmad-orchestrator          [3 Projects] [8 Agents] [!1]   |
+----------+------------------------------------------------+
|          |                                                |
| PROJECTS | PROJECT CARDS                                  |
| -------- |                                                |
| > projA  | +-------------------+  +-------------------+   |
|   projB  | | Project A         |  | Project B         |   |
|   projC  | | E2.S3 in progress |  | E1.S4 in review   |   |
|          | | 4 agents          |  | 2 agents          |   |
| -------- | | [View] [Logs]     |  | [View] [Logs]     |   |
| + New    | +-------------------+  +-------------------+   |
|          |                                                |
|          | +-------------------+                          |
|          | | Project C         |                          |
|          | | WAITING: Approval |                          |
|          | | [Approve] [View]  |                          |
|          | +-------------------+                          |
|          |                                                |
+----------+------------------------------------------------+
```

### Header Component

**Specifications:**

| Aspect | Specification |
|--------|---------------|
| **Height** | 48px |
| **Background** | `--bg-secondary` |
| **Position** | Fixed top |

**Sections:**

| Section | Content | Position |
|---------|---------|----------|
| **Logo** | "bmad-orchestrator" | Left |
| **Summary** | "[X Projects] [Y Agents] [Z Alerts]" | Center |
| **User Menu** | GitHub avatar, dropdown | Right |

### Sidebar Component

**Specifications:**

| Aspect | Specification |
|--------|---------------|
| **Width Expanded** | 200px |
| **Width Collapsed** | 48px |
| **Background** | `--bg-primary` with border-right |

**Contents:**

| Element | Behavior |
|---------|----------|
| **Project List** | Scrollable, current highlighted with gold |
| **Status Indicator** | Dot: green=running, yellow=waiting, red=failed |
| **+ New Project** | Opens project setup |
| **Collapse Toggle** | `[<]` at bottom |

### Project Card Component

**Anatomy:**

```
+---------------------------------------------+
| [Status Dot] Project Name           [3 agents]
|---------------------------------------------|
| Current: Epic 2, Story 3 - "Add OAuth"       |
| Status: In Progress (verified 2m ago)        |
|---------------------------------------------|
| [View Details]  [View Logs]  [Kill All]      |
+---------------------------------------------+
```

**Specifications:**

| Aspect | Specification |
|--------|---------------|
| **Min Width** | 280px |
| **Max Width** | 400px |
| **Background** | `--bg-secondary` |
| **Border** | 1px `--border-default`, gold left border when active |
| **Border Radius** | 8px |

**Status States:**

| State | Appearance |
|-------|------------|
| **Running** | Green dot, "X agents working" |
| **Waiting Approval** | Yellow dot, "[Approve]" button prominent |
| **Failed** | Red dot, error message, "[Retry]" button |
| **Done** | Gold checkmark, "Verified complete" |
| **Paused** | Gray dot, "Paused" label |

### Agent Activity Panel

**Purpose:** Show what agents are doing without log overload

**Anatomy:**

```
+---------------------------------------------+
| AGENTS (4 active)                            |
|---------------------------------------------|
| [*] Agent 1 - Story 2.3    [Running 5m]     |
|     Last: "Running tests..."                 |
|                                              |
| [*] Agent 2 - Story 2.4    [Running 12m]    |
|     Last: "Implementing auth..."             |
|                                              |
| [*] Agent 3 - Code Review  [Running 3m]     |
|     Last: "Reviewing PR #42..."              |
|                                              |
| [!] Agent 4 - Story 2.5    [Stuck 45m]      |
|     Last: "Waiting for response..."          |
|     [Kill] [View Logs]                       |
+---------------------------------------------+
```

**Specifications:**

| Aspect | Specification |
|--------|---------------|
| **Activity Indicator** | Pulsing green dot when active |
| **Stuck Indicator** | Yellow/red exclamation after threshold |
| **Last Activity** | Truncated last output line, not full log |
| **Timing** | Monospace, "Xm" or "Xh Xm" format |

### Verification Status Component

**Purpose:** Show claimed vs verified status

**Anatomy:**

```
Status: Done
[x] Agent claimed: done
[?] YAML verification: pending...
```

or

```
Status: Done (verified)
[x] Agent claimed: done
[✓] YAML verified: done (2m ago)
```

or

```
Status: MISMATCH
[x] Agent claimed: done
[!] YAML verified: in-progress
    [Re-verify] [View Details]
```

**Visual Treatment:**

| State | Appearance |
|-------|------------|
| **Verified Match** | Gold checkmark, "verified Xm ago" |
| **Pending** | Gray spinner, "verifying..." |
| **Mismatch** | Red warning, action buttons |

### Log Viewer Component

**Purpose:** On-demand deep dive into agent output

**Specifications:**

| Aspect | Specification |
|--------|---------------|
| **Trigger** | Click "View Logs" on agent or project |
| **Display** | Slide-in panel from right, 50% width |
| **Content** | Streaming log output, auto-scroll |
| **Font** | JetBrains Mono, 13px |
| **Background** | `--bg-primary` (true black for contrast) |

**Features:**

| Feature | Behavior |
|---------|----------|
| **Search** | Cmd+F to search logs |
| **Filter** | Filter by level (error, warn, info) |
| **Auto-scroll** | Toggle to follow or freeze |
| **Copy** | Copy selection or all |
| **Close** | Escape or click outside |

### Notification Toast Component

**Purpose:** Surface what needs attention

**Types:**

| Type | Style | Auto-dismiss |
|------|-------|--------------|
| **Approval Needed** | Yellow background, action button | No |
| **Agent Stuck** | Red background, action buttons | No |
| **Project Complete** | Gold background, "View" link | 10 seconds |
| **Error** | Red background, "Retry" button | No |
| **Info** | Gray background | 5 seconds |

**Position:** Bottom-right, stack max 3

---

## User Journey Flows

### Journey 1: First Project Setup

**Goal:** Get first project orchestrated and see it work

```
Entry: User has PRD complete, runs orchestrator

1. User visits dashboard
2. Dashboard shows: "No projects configured"
3. User clicks [+ New Project]
4. Modal: "Project path: ~/my-project"
5. Orchestrator scans: finds epics.md, sprint-status.yaml
6. Shows: "Found 3 epics, 12 stories. Ready to start."
7. User clicks [Start Orchestration]
8. Dashboard shows first agents spawning
9. First agent completes, shows "verified" badge
10. User sees it's working, closes laptop
```

**Key Moments:**

| Step | What Happens | Design Note |
|------|--------------|-------------|
| **Scan Results** | Show what was found | Build confidence |
| **First Agent** | Show it spawn, show output snippet | Prove it works |
| **First Verification** | Show "verified" badge | Trust established |

### Journey 2: Daily Check-In

**Goal:** Glance at progress, handle anything urgent

```
Entry: User opens dashboard next morning

1. Dashboard loads, shows all projects
2. Header: "3 Projects | 6 Agents | 1 Alert"
3. User sees alert: Project B has stuck agent
4. Clicks [View], sees agent stuck on tests
5. Clicks [Kill], agent terminated
6. Clicks [Retry Story], new agent spawns
7. User checks Project A: Epic 1 complete, Epic 2 at 50%
8. No approvals needed, user closes browser
```

**Time Investment:** < 2 minutes

### Journey 3: Architecture Approval

**Goal:** Respond to approval request with minimal context switching

```
Entry: Notification arrives (browser/Slack)

1. Notification: "Project C: Architecture approval needed"
2. User clicks notification, opens dashboard to Project C
3. Panel shows: "Architecture Decision: Database choice"
4. Shows: Option A (PostgreSQL) vs Option B (SQLite)
5. Shows: Agent's recommendation with rationale
6. User clicks [Approve Recommended]
7. Agent resumes, notification clears
8. User returns to previous task
```

**Key Design:**
- Show decision context clearly
- One-click for recommended option
- Two-click for alternative
- No navigation required from notification

### Journey 4: Handling Failure

**Goal:** Recover from failed story without deep investigation

```
Entry: Dashboard shows red status on Project A

1. User clicks Project A card
2. Sees: Story 2.4 failed, error: "Test timeout"
3. Sees options: [Retry] [Skip] [View Logs]
4. User clicks [Retry]
5. New agent spawns, retries story
6. If fails again, user clicks [View Logs]
7. Sees test that's flaky, clicks [Skip with Note]
8. Orchestrator continues, user notes to fix later
```

### Journey 5: Project Completion

**Goal:** Verify completion and deploy

```
Entry: Notification: "Project B: All epics complete"

1. User opens dashboard, sees Project B with gold badge
2. Card shows: "5 epics, 18 stories, all verified"
3. User clicks [View Summary]
4. Panel shows: all PRs, test results, code review status
5. User clicks [Deploy to Staging]
6. Orchestrator triggers deployment via SSH
7. Status updates: "Deployed. URL: https://project-b.padaw.ovh"
8. User clicks URL, verifies it works
9. Project moves to "Done" state
```

---

## Component Strategy

### Core Components (Build Order)

**Phase 1: MVP Dashboard**

| Component | Purpose | Priority |
|-----------|---------|----------|
| **Header** | Status summary, navigation | P0 |
| **Sidebar** | Project list, navigation | P0 |
| **ProjectCard** | Project status at a glance | P0 |
| **AgentList** | Show active agents per project | P0 |
| **StatusBadge** | Verified/running/failed indicators | P0 |
| **Toast** | Notifications | P0 |

**Phase 2: Detail Views**

| Component | Purpose | Priority |
|-----------|---------|----------|
| **ProjectDetail** | Full project view with epics/stories | P1 |
| **AgentDetail** | Single agent view with activity | P1 |
| **LogViewer** | Streaming logs | P1 |
| **VerificationPanel** | Show claimed vs verified status | P1 |

**Phase 3: Actions & Approvals**

| Component | Purpose | Priority |
|-----------|---------|----------|
| **ApprovalModal** | Architecture decision UI | P1 |
| **ActionButtons** | Kill, retry, skip actions | P1 |
| **ProjectSetup** | New project configuration | P2 |

### Button Hierarchy

**Three-tier button system:**

| Tier | Style | Usage |
|------|-------|-------|
| **Primary** | Solid gold | Main action per context |
| **Secondary** | Ghost with border | Alternative actions |
| **Destructive** | Red text/border | Kill, skip, destructive |

**Button States:**

| State | Primary | Secondary | Destructive |
|-------|---------|-----------|-------------|
| **Default** | Gold bg, dark text | Transparent, gold border | Red text |
| **Hover** | Lighter gold | Gold bg at 10% | Red bg at 10% |
| **Active** | Darker gold | Gold bg at 20% | Red bg at 20% |
| **Disabled** | Muted, 50% opacity | Muted border | Muted red |

### Real-Time Update Patterns

**WebSocket Events:**

| Event | UI Update |
|-------|-----------|
| `agent:spawn` | Add agent to list with "starting" state |
| `agent:output` | Update "last activity" text |
| `agent:complete` | Show completion, trigger verification |
| `agent:stuck` | Show warning indicator, add to alerts |
| `story:verified` | Show gold checkmark |
| `story:mismatch` | Show red warning with actions |
| `project:approval` | Show toast + highlight project |
| `project:complete` | Show gold badge + toast |

**Animation Guidelines:**

| Transition | Duration | Easing |
|------------|----------|--------|
| **Status change** | 200ms | ease-out |
| **Toast appear** | 300ms | ease-out |
| **Panel slide** | 250ms | ease-in-out |
| **Badge pulse** | 1s | ease-in-out (loop) |

---

## UX Consistency Patterns

### Feedback Patterns

**Feedback Types:**

| Type | Trigger | Display | Duration |
|------|---------|---------|----------|
| **Agent Activity** | Agent output | Pulsing dot + last line | Continuous |
| **Status Change** | Verification complete | Badge animation | 200ms |
| **Success** | Story/epic complete | Gold toast | 5s auto-dismiss |
| **Error** | Failure | Red toast with action | Until dismissed |
| **Alert** | Needs attention | Yellow toast | Until dismissed |

### Empty States

**No Projects:**
```
+-------------------------------------------+
|                                           |
|    [Orchestrator icon]                    |
|                                           |
|    No projects configured                 |
|                                           |
|    Point the orchestrator at a project    |
|    with a PRD and epics.md                |
|                                           |
|    [+ Add Project]                        |
|                                           |
+-------------------------------------------+
```

**No Agents Running:**
```
+-------------------------------------------+
|                                           |
|    All agents idle                        |
|                                           |
|    No work in progress. Start a project   |
|    or agents will spawn when needed.      |
|                                           |
+-------------------------------------------+
```

### Loading States

| Context | Loading Style |
|---------|---------------|
| **Initial load** | Full-screen spinner with logo |
| **Project loading** | Card skeleton |
| **Agent spawning** | "Starting..." with spinner |
| **Verification** | "Verifying..." inline |
| **Log loading** | Skeleton lines |

### Keyboard Shortcuts

**Global:**

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick search / command palette |
| `Cmd/Ctrl + N` | New project |
| `Escape` | Close panel / modal |
| `?` | Show shortcuts |

**Project Context:**

| Shortcut | Action |
|----------|--------|
| `R` | Retry failed stories |
| `K` | Kill all agents |
| `L` | Open logs |
| `A` | Approve pending (if any) |

---

## Responsive Design & Accessibility

### Responsive Strategy

**Platform Priority: Desktop-First**

| Platform | Priority | Support Level |
|----------|----------|---------------|
| **Desktop (1024px+)** | Primary | Full feature parity |
| **Large Desktop (1440px+)** | Enhanced | More space for panels |
| **Tablet** | Deferred | Basic viewing only |
| **Mobile** | Not Supported | "Use desktop" message |

### Accessibility

**Target Compliance: WCAG 2.1 Level AA**

**Color & Contrast:**

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| **Text contrast** | 4.5:1 | All text passes on dark background |
| **UI contrast** | 3:1 | All interactive elements pass |
| **Focus indicators** | Visible | 2px gold outline |

**Status Indicators:**

| Indicator | Color | Additional Cue |
|-----------|-------|----------------|
| **Success** | Gold | Checkmark icon |
| **Running** | Green | Pulsing animation |
| **Error** | Red | X icon |
| **Warning** | Yellow | Triangle icon |

Colors are never the only indicator - always paired with icon or text.

**Keyboard Navigation:**

| Area | Implementation |
|------|----------------|
| **Sidebar** | Arrow keys navigate, Enter selects |
| **Cards** | Tab moves between, Enter opens |
| **Actions** | All buttons keyboard accessible |
| **Modals** | Focus trapped, Escape closes |

**Screen Reader Support:**

| Element | ARIA Implementation |
|---------|---------------------|
| **Status** | `aria-live="polite"` for changes |
| **Alerts** | `role="alert"` for notifications |
| **Actions** | Descriptive `aria-label` |

---

## Implementation Priorities

### Phase 1: Core Dashboard (MVP)

| Component | Status |
|-----------|--------|
| Dark theme foundation | Implement |
| Header with summary | Implement |
| Sidebar with projects | Implement |
| Project cards | Implement |
| Status badges | Implement |
| WebSocket integration | Exists, enhance |
| Basic toasts | Implement |

### Phase 2: Detail & Actions

| Component | Status |
|-----------|--------|
| Agent activity panel | Implement |
| Log viewer | Implement |
| Verification display | Implement |
| Action buttons (kill, retry) | Implement |
| Approval modal | Implement |

### Phase 3: Polish & Multi-Project

| Component | Status |
|-----------|--------|
| Multi-project view | Implement |
| Project setup wizard | Implement |
| Notification system | Implement |
| Keyboard shortcuts | Implement |
| Command palette | Implement |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| **Time to understand status** | < 5 seconds |
| **Time to approve decision** | < 30 seconds |
| **Time to kill stuck agent** | < 10 seconds |
| **False confidence (showing done when not)** | 0% |
| **Missed alerts** | 0% (all actionable items surfaced) |
