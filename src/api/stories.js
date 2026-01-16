/**
 * Stories API routes
 * Provides endpoints for story management and verification
 *
 * Story 4.3: Added POST /api/stories/:id/retry endpoint
 */

import express from 'express';
import path from 'path';
import { compareStatus, readYamlStatus, getStoryStatus } from '../services/verification.js';
import { authMiddleware, requireAuth } from '../auth/middleware.js';
import { broadcast } from '../services/websocket.js';
import { retryStory, canRetryStory, getRetryStats } from '../services/storyRetrier.js';
import { registerStory, getStory } from '../services/storyTracker.js';
import { insertStoryRetryLog } from '../db/storyLogs.js';
import { loadConfig } from '../config.js';

const router = express.Router();

/**
 * Async handler wrapper for Express routes
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * POST /api/stories/:storyKey/verify
 *
 * Trigger manual re-verification of a story's status.
 * Compares claimed status (from sprint-status.yaml) against actual YAML state.
 *
 * Request body (optional):
 *   - projectPath: Override project path (defaults to process.cwd())
 *
 * Response:
 *   - storyKey: Story identifier
 *   - claimed: Status claimed in sprint-status.yaml
 *   - actual: Actual status found
 *   - match: Boolean indicating if claimed matches actual
 *   - timestamp: ISO 8601 timestamp
 */
router.post(
  '/:storyKey/verify',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { storyKey } = req.params;
    const { projectPath = process.cwd() } = req.body || {};

    // Construct path to sprint-status.yaml
    const yamlPath = path.join(
      projectPath,
      '_bmad-output/implementation-artifacts/sprint-status.yaml'
    );

    // Read current status from YAML to get claimed status
    const yamlResult = readYamlStatus(yamlPath);

    if (!yamlResult.success) {
      return res.status(400).json({
        error: `Failed to read sprint status: ${yamlResult.error}`,
        code: yamlResult.code || 'YAML_READ_ERROR',
      });
    }

    // Get the claimed status for this story
    const claimed = getStoryStatus(yamlResult.data, storyKey);

    if (claimed === 'unknown') {
      return res.status(404).json({
        error: `Story '${storyKey}' not found in sprint-status.yaml`,
        code: 'STORY_NOT_FOUND',
      });
    }

    // Perform verification
    const result = await compareStatus(storyKey, claimed, yamlPath, {
      projectId: projectPath,
    });

    // Broadcast verification result via WebSocket
    const eventType = result.match ? 'story:verified' : 'story:verification_failed';
    broadcast({
      type: eventType,
      data: {
        storyKey: result.storyKey,
        claimed: result.claimed,
        actual: result.actual,
        status: result.actual,
        timestamp: result.timestamp,
        attempts: result.attemptCount,
      },
    });

    // Return result in standard API format
    res.json({
      data: {
        storyKey: result.storyKey,
        claimed: result.claimed,
        actual: result.actual,
        match: result.match,
        timestamp: result.timestamp,
      },
      meta: {
        attemptCount: result.attemptCount,
        timestamp: result.timestamp,
      },
    });
  })
);

/**
 * GET /api/stories/:storyKey/verification
 *
 * Get the current verification status for a story
 *
 * Response:
 *   - storyKey: Story identifier
 *   - status: Current verification status (pending, verified, mismatch, unknown)
 *   - claimed: Last claimed status
 *   - actual: Last verified status
 *   - verifiedAt: Timestamp of last verification
 */
router.get(
  '/:storyKey/verification',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { storyKey } = req.params;
    const { projectPath = process.cwd() } = req.query;

    // Construct path to sprint-status.yaml
    const yamlPath = path.join(
      projectPath,
      '_bmad-output/implementation-artifacts/sprint-status.yaml'
    );

    // Read current status from YAML
    const yamlResult = readYamlStatus(yamlPath);

    if (!yamlResult.success) {
      return res.json({
        data: {
          storyKey,
          status: 'unknown',
          claimed: null,
          actual: null,
          verifiedAt: null,
        },
      });
    }

    // Get the status for this story
    const status = getStoryStatus(yamlResult.data, storyKey);

    if (status === 'unknown') {
      return res.json({
        data: {
          storyKey,
          status: 'unknown',
          claimed: null,
          actual: null,
          verifiedAt: null,
        },
      });
    }

    // Return the current status (not verified yet)
    res.json({
      data: {
        storyKey,
        status: 'verified', // Status exists in YAML, so it's "verified" from file
        claimed: status,
        actual: status,
        verifiedAt: yamlResult.timestamp,
      },
    });
  })
);

// ============================================================================
// Story 4.3: Retry Story API
// ============================================================================

/**
 * POST /api/stories/:id/retry
 *
 * Retry a failed or killed story.
 *
 * AC1: Resets story status to "pending" and spawns new Claude agent
 * AC2: Returns 400 if story is already in progress
 * AC3: Returns warning but proceeds if max retries exceeded
 * AC4: Broadcasts WebSocket events (handled in retryStory service)
 *
 * Request body (optional):
 *   - projectPath: Override project path (defaults to process.cwd())
 *
 * Response:
 *   Success: { data: { storyId, status, agentId }, meta: { timestamp }, warning? }
 *   Error: { error: string, code: string }
 */
router.post(
  '/:id/retry',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id: storyId } = req.params;
    const { projectPath = process.cwd() } = req.body || {};

    // Validate story ID format (e.g., "4-3" or "4-3-retry-story-api")
    const storyIdPattern = /^\d+-\d+(-[\w-]+)?$/;
    if (!storyIdPattern.test(storyId)) {
      return res.status(400).json({
        error: 'Invalid story ID format. Expected format: "X-Y" or "X-Y-slug"',
        code: 'INVALID_STORY_ID',
      });
    }

    // Load config to get maxStoryRetries setting
    const config = loadConfig(projectPath);

    // First, sync story from sprint status if not tracked
    const existingStory = getStory(storyId);
    if (!existingStory) {
      const yamlPath = path.join(
        projectPath,
        '_bmad-output/implementation-artifacts/sprint-status.yaml'
      );
      const yamlResult = readYamlStatus(yamlPath);

      if (yamlResult.success) {
        const status = getStoryStatus(yamlResult.data, storyId);
        if (status !== 'unknown') {
          registerStory(storyId, status);
        }
      }
    }

    // Check if story can be retried (for better error messages)
    const canRetry = canRetryStory(storyId);
    if (!canRetry.canRetry) {
      // AC2: Return 400 if already in progress
      if (canRetry.reason?.includes('already in progress')) {
        return res.status(400).json({
          error: 'Story already in progress',
          code: 'STORY_IN_PROGRESS',
        });
      }

      // Story not found or in non-retryable state
      if (canRetry.reason?.includes('not found')) {
        return res.status(404).json({
          error: `Story '${storyId}' not found`,
          code: 'STORY_NOT_FOUND',
        });
      }

      return res.status(400).json({
        error: canRetry.reason || 'Story cannot be retried',
        code: 'RETRY_NOT_ALLOWED',
      });
    }

    try {
      // Perform retry
      const result = await retryStory(storyId, {
        config,
        projectPath,
        // spawnAgentAsync: true (default) - agent spawns in background
      });

      // Log to audit_log (AC1 requirement)
      try {
        await insertStoryRetryLog({
          timestamp: new Date().toISOString(),
          user: req.user?.username || req.user?.userId || 'system',
          action: 'story:retry',
          project: config.projectId || projectPath.split('/').pop(),
          details: JSON.stringify({
            storyId,
            retryCount: result.retryCount,
            agentId: result.agentId,
            warning: result.warning,
          }),
        });
      } catch (logError) {
        console.error('Failed to log story retry action:', logError.message);
        // Non-fatal - continue with response
      }

      // Build response (AC3: include warning if max retries exceeded)
      const response = {
        data: {
          storyId: result.storyId,
          status: result.status,
          agentId: result.agentId,
        },
        meta: {
          timestamp: new Date().toISOString(),
          retryCount: result.retryCount,
        },
      };

      if (result.warning) {
        response.warning = result.warning;
      }

      res.json(response);
    } catch (error) {
      // Handle known errors
      if (error.message === 'Story already in progress') {
        return res.status(400).json({
          error: error.message,
          code: 'STORY_IN_PROGRESS',
        });
      }

      if (error.message === 'Story not found') {
        return res.status(404).json({
          error: error.message,
          code: 'STORY_NOT_FOUND',
        });
      }

      if (error.message.includes('Cannot retry story in')) {
        return res.status(400).json({
          error: error.message,
          code: 'RETRY_NOT_ALLOWED',
        });
      }

      // Re-throw for global error handler
      throw error;
    }
  })
);

/**
 * GET /api/stories/:id/retry-stats
 *
 * Get retry statistics for a story
 *
 * Response:
 *   { data: { storyId, retryCount, maxRetries, exceededMax, canRetry }, meta: { timestamp } }
 */
router.get(
  '/:id/retry-stats',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id: storyId } = req.params;
    const { projectPath = process.cwd() } = req.query;

    // Validate story ID format
    const storyIdPattern = /^\d+-\d+(-[\w-]+)?$/;
    if (!storyIdPattern.test(storyId)) {
      return res.status(400).json({
        error: 'Invalid story ID format. Expected format: "X-Y" or "X-Y-slug"',
        code: 'INVALID_STORY_ID',
      });
    }

    // Load config
    const config = loadConfig(projectPath);

    // Get retry stats
    const stats = getRetryStats(storyId, config);
    const canRetry = canRetryStory(storyId);

    res.json({
      data: {
        storyId,
        retryCount: stats?.retryCount || 0,
        maxRetries: stats?.maxRetries || config.maxStoryRetries || 3,
        exceededMax: stats?.exceededMax || false,
        canRetry: canRetry.canRetry,
        reason: canRetry.reason,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  })
);

export default router;
