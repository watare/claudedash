/**
 * Projects API routes
 */

import express from 'express';
import { getAllProjects, getProjectById } from '../services/projects.js';
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
  console.error('Projects API error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};

/**
 * GET /api/projects
 * List all projects with summary information
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projects = await getAllProjects();
    res.json({
      data: projects,
      meta: {
        total: projects.length,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/projects/:id
 * Get single project with detailed epic/story breakdown
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const project = await getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      });
    }

    res.json({
      data: project,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  })
);

// Apply error handler
router.use(errorHandler);

export default router;
