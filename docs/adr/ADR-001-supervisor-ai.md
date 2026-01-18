# ADR-001: Supervisor AI for Agent Question Handling

## Status
Accepted

## Date
2026-01-18

## Context

The BMAD Orchestrator spawns Claude Code CLI agents to execute development workflows (create story, dev, review, fix, PR). These agents sometimes ask questions that require intelligent responses:

- **Simple questions**: "Continue? (y/n)", "Overwrite file?" - can be answered with regex patterns
- **Complex questions**: "Which issues should I fix: 1, 2, or 3?", "What approach for the database migration?" - require contextual understanding

The previous implementation used only regex pattern matching, which:
1. Always answered "1" for any multi-choice question
2. Couldn't handle clarification requests
3. Couldn't make intelligent priority decisions

This led to suboptimal workflow execution and potential errors when agents asked complex questions.

## Decision

Implement a **lightweight Supervisor AI** service that:

1. **Classifies questions** as simple or complex using pattern matching
2. **Routes simple questions** to fast regex handlers (no API cost, instant response)
3. **Routes complex questions** to Claude 3.5 Haiku API with BMAD methodology prompt
4. **Falls back to regex** if API is unavailable or fails

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BMAD Orchestrator                         │
├─────────────────────────────────────────────────────────────┤
│  claude-runner.js (spawns Claude CLI for project work)      │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐    Complex?     ┌───────────────────┐  │
│  │ PTY Output      │ ─────────────▶  │ Supervisor AI     │  │
│  │ Monitor         │                 │ (Haiku API)       │  │
│  └─────────────────┘                 └───────────────────┘  │
│         │                                    │               │
│         │ Simple                             │               │
│         ▼                                    ▼               │
│  ┌─────────────────┐              ┌───────────────────┐     │
│  │ Regex Patterns  │              │ Structured        │     │
│  │ (yes/no/1)      │              │ BMAD Response     │     │
│  └─────────────────┘              └───────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Model Selection

**Claude 3.5 Haiku** was chosen for:
- Fast response time (< 1 second)
- Low cost (~$0.25/M input, $1.25/M output)
- Sufficient capability for routing/coordination tasks
- ~100-200 tokens per question/answer = ~$0.15/day for 1000 questions

### BMAD System Prompt

The Supervisor AI uses a comprehensive system prompt implementing BMAD methodology:
- Move forward every turn with explicit next steps
- Always document decisions
- Commit after dev tasks
- Update status correctly
- Answer quickly and precisely
- Route to correct BMAD role when needed

## Consequences

### Positive
- Complex questions get intelligent, context-aware answers
- Workflow execution is more reliable
- Follows BMAD methodology consistently
- Low cost impact (~$0.15/day)
- Graceful fallback if API unavailable

### Negative
- Adds external API dependency (Anthropic)
- Requires API key configuration
- ~1 second latency for complex questions (vs instant regex)
- Additional code complexity

### Neutral
- Simple questions still use regex (no change in behavior)
- API key is optional (falls back to regex-only mode)

## Alternatives Considered

1. **Expand regex patterns**: Would require hundreds of patterns, still couldn't handle open-ended questions
2. **Use local LLM**: Higher latency, more resource usage, harder to maintain
3. **Use Claude Opus**: Higher quality but 10x cost, overkill for routing decisions
4. **Always use AI**: Higher cost, slower for simple y/n questions

## Implementation Files

- `src/services/supervisorAI.js` - Main service with system prompt and API calls
- `src/config/secrets.js` - API key loading
- `src/claude-runner.js` - Integration with PTY output handler
- `bmad-orchestrator.secrets.yaml` - API key storage (gitignored)

## Related

- CHANGELOG.md - Documents the feature addition
- bmad-orchestrator.secrets.example.yaml - Configuration template
