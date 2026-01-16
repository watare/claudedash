/**
 * Audit Logs API routes
 * Story 3.5: Verification Logging & Audit
 */

import express from 'express';
import { queryAuditLogs } from '../db/sqlite.js';
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
  console.error('Audit Logs API error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};

/**
 * GET /api/audit-logs
 * Query verification audit logs with optional filters
 *
 * Query parameters:
 *   project   - Filter by project ID (exact match)
 *   story     - Filter by story ID (partial match)
 *   dateFrom  - Start date (ISO 8601)
 *   dateTo    - End date (ISO 8601)
 *   result    - Filter by result type (match/mismatch/error)
 *   limit     - Results per page (default 20, max 100)
 *   offset    - Pagination offset
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const {
      project,
      story,
      dateFrom,
      dateTo,
      result,
      limit,
      offset,
    } = req.query;

    // Build filters object
    const filters = {};

    if (project) {
      filters.project = project;
    }

    if (story) {
      filters.story = story;
    }

    if (dateFrom) {
      // Validate date format (ISO 8601 date or datetime)
      const dateFromParsed = Date.parse(dateFrom);
      if (isNaN(dateFromParsed)) {
        return res.status(400).json({
          error: 'Invalid dateFrom. Must be a valid ISO 8601 date.',
          code: 'INVALID_DATE_FROM',
        });
      }
      filters.dateFrom = dateFrom;
    }

    if (dateTo) {
      // Validate date format (ISO 8601 date or datetime)
      const dateToParsed = Date.parse(dateTo);
      if (isNaN(dateToParsed)) {
        return res.status(400).json({
          error: 'Invalid dateTo. Must be a valid ISO 8601 date.',
          code: 'INVALID_DATE_TO',
        });
      }
      filters.dateTo = dateTo;
    }

    if (result) {
      // Validate result type
      if (!['match', 'mismatch', 'error'].includes(result)) {
        return res.status(400).json({
          error: 'Invalid result type. Must be one of: match, mismatch, error',
          code: 'INVALID_RESULT_TYPE',
        });
      }
      filters.result = result;
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

    if (offset) {
      const parsedOffset = parseInt(offset, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
          error: 'Invalid offset. Must be a non-negative integer.',
          code: 'INVALID_OFFSET',
        });
      }
      filters.offset = parsedOffset;
    }

    // Query audit logs
    const queryResult = queryAuditLogs(filters);

    // Calculate pagination metadata
    const actualLimit = filters.limit || 20;
    const actualOffset = filters.offset || 0;
    const page = Math.floor(actualOffset / actualLimit) + 1;

    res.json({
      data: queryResult.rows,
      meta: {
        total: queryResult.total,
        page,
        limit: actualLimit,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

// Apply error handler
router.use(errorHandler);

export default router;
