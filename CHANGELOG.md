# Changelog

All notable changes to the BMAD Orchestrator project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Supervisor AI Service** (`src/services/supervisorAI.js`)
  - Lightweight AI-powered question answering for complex agent queries
  - Uses Claude 3.5 Haiku for fast, cost-effective responses (~$0.15/day for 1000 questions)
  - Implements full BMAD methodology for structured responses
  - Question classification: routes simple y/n to regex, complex questions to AI
  - Fallback to regex patterns if API unavailable
  - See ADR-001 for architecture decision

- **Anthropic API Key Configuration**
  - Added `anthropic.api_key` to secrets configuration
  - Updated `src/config/secrets.js` with `getAnthropicApiKey()` function
  - Updated `bmad-orchestrator.secrets.example.yaml` with template

### Fixed
- **Project Status Bug** - Projects showing "running" with Stop button when no agents were actually running
  - Root cause: Status was derived from `sprint-status.yaml` file content, not actual running agents
  - Fix: `src/services/projects.js` now checks `agentCount === 0` and overrides stale "running" status to "idle"
  - Impact: Start Workflow button now correctly appears when no agents are running

### Changed
- **Agent Question Handling** (`src/claude-runner.js`)
  - Complex questions (multi-choice, architecture, clarification) now route to Supervisor AI
  - Simple y/n questions still use fast regex patterns
  - Added async handling for AI responses in PTY data handler

### Dependencies
- Added `@anthropic-ai/sdk` for Supervisor AI API calls

## [0.1.0] - 2026-01-17

### Added
- Initial release of BMAD Orchestrator
- Multi-project orchestration support
- React dashboard with project cards, agent monitoring
- WebSocket real-time updates
- GitHub OAuth and password authentication
- Story workflow: create -> dev -> review -> fix -> PR
- Agent tracking and stuck detection
- Execution history with SQLite persistence
