/**
 * Agents API routes
 *
 * Story 4.1: Added POST /api/agents/:id/kill endpoint for terminating agents
 */

import express from 'express';
import { getAllAgents, getAgentsByProject, getAgentById, killAgentById } from '../services/agents.js';
import { requireAuth } from '../auth/middleware.js';

const router = express.Router();

/**
 * Async error handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Agents API error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};

/**
 * GET /api/agents
 * List all active agents, optionally filtered by projectId
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    let { projectId } = req.query;

    // Validate projectId - handle array case and sanitize
    if (Array.isArray(projectId)) {
      projectId = projectId[0]; // Take first value if array
    }
    if (projectId && typeof projectId !== 'string') {
      return res.status(400).json({
        error: 'Invalid projectId parameter',
        code: 'INVALID_PROJECT_ID',
      });
    }

    const agents = projectId
      ? await getAgentsByProject(projectId)
      : await getAllAgents();

    res.json({
      data: agents,
      meta: {
        total: agents.length,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/agents/:id
 * Get single agent details including output history
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const agent = await getAgentById(req.params.id);

    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        code: 'AGENT_NOT_FOUND',
      });
    }

    res.json({
      data: agent,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * POST /api/agents/:id/kill
 * Kill an agent's subprocess with graceful termination
 *
 * Story 4.1: Kill Agent API & Backend
 *
 * AC1: Sends SIGTERM, waits 5s, falls back to SIGKILL
 * AC2: Returns 404 if agent not found
 * AC3: Broadcasts WebSocket event on success (handled in service)
 */
router.post(
  '/:id/kill',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};

    const result = await killAgentById(id, {
      userId: req.user?.userId,
      username: req.user?.username,
      reason: reason || 'User requested kill',
    });

    if (!result.success && result.error === 'Agent not found') {
      return res.status(404).json({
        error: 'Agent not found',
        code: 'AGENT_NOT_FOUND',
      });
    }

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Failed to kill agent',
        code: 'KILL_FAILED',
      });
    }

    res.json({
      data: {
        agentId: result.agentId,
        status: 'killed',
        method: result.method,
      },
      meta: {
        timestamp: result.timestamp,
      },
    });
  })
);

// Apply error handler
router.use(errorHandler);

export default router;
