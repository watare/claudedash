/**
 * Agents API routes
 */

import express from 'express';
import { getAllAgents, getAgentsByProject, getAgentById } from '../services/agents.js';
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

// Apply error handler
router.use(errorHandler);

export default router;
