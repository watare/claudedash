/**
 * History API routes
 * Story 4.7: Execution History View
 *
 * Provides endpoints for querying execution history and run details.
 */

import express from 'express';
import { queryRuns, getRunWithEvents } from '../services/historyRecorder.js';
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
  console.error('History API error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};

/**
 * GET /api/history
 * List execution runs with filters and pagination
 *
 * Query parameters:
 *   project    - Filter by project name
 *   status     - Filter by status (running, completed, failed, stopped)
 *   startDate  - Filter by start date (ISO 8601, >=)
 *   endDate    - Filter by end date (ISO 8601, <=)
 *   page       - Page number (default: 1)
 *   limit      - Items per page (default: 20, max: 100)
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const {
      project,
      status,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    // Build filters object
    const filters = {};

    if (project) {
      filters.project = project;
    }

    if (status) {
      // Validate status
      const validStatuses = ['running', 'completed', 'failed', 'stopped'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          code: 'INVALID_STATUS',
        });
      }
      filters.status = status;
    }

    if (startDate) {
      // Validate date format
      const parsed = Date.parse(startDate);
      if (isNaN(parsed)) {
        return res.status(400).json({
          error: 'Invalid startDate. Must be a valid ISO 8601 date.',
          code: 'INVALID_START_DATE',
        });
      }
      filters.startDate = startDate;
    }

    if (endDate) {
      // Validate date format
      const parsed = Date.parse(endDate);
      if (isNaN(parsed)) {
        return res.status(400).json({
          error: 'Invalid endDate. Must be a valid ISO 8601 date.',
          code: 'INVALID_END_DATE',
        });
      }
      filters.endDate = endDate;
    }

    if (page) {
      const parsedPage = parseInt(page, 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        return res.status(400).json({
          error: 'Invalid page. Must be a positive integer.',
          code: 'INVALID_PAGE',
        });
      }
      filters.page = parsedPage;
    }

    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return res.status(400).json({
          error: 'Invalid limit. Must be a positive integer.',
          code: 'INVALID_LIMIT',
        });
      }
      if (parsedLimit > 100) {
        return res.status(400).json({
          error: 'Invalid limit. Maximum allowed is 100.',
          code: 'INVALID_LIMIT',
        });
      }
      filters.limit = parsedLimit;
    }

    // Query runs
    const result = queryRuns(filters);

    res.json({
      data: result.data,
      meta: {
        ...result.meta,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/history/:runId
 * Get a specific run with its events
 *
 * Path parameters:
 *   runId - The run ID
 */
router.get(
  '/:runId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { runId } = req.params;

    // Validate runId
    const parsedId = parseInt(runId, 10);
    if (isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({
        error: 'Invalid runId. Must be a positive integer.',
        code: 'INVALID_RUN_ID',
      });
    }

    const run = getRunWithEvents(parsedId);

    if (!run) {
      return res.status(404).json({
        error: 'Run not found',
        code: 'RUN_NOT_FOUND',
      });
    }

    res.json({
      data: run,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  })
);

// Apply error handler
router.use(errorHandler);

export default router;
