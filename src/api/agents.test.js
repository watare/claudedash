/**
 * Tests for Agents API routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import agentsRouter from './agents.js';
import * as agentsService from '../services/agents.js';

// Mock the services
vi.mock('../services/agents.js', () => ({
  getAllAgents: vi.fn(),
  getAgentsByProject: vi.fn(),
  getAgentById: vi.fn(),
  killAgentById: vi.fn(),
}));

// Mock auth middleware
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'test-user' };
    next();
  },
}));

describe('Agents API', () => {
  let app;

  const mockAgent = {
    id: 'agent-123',
    projectId: 'test-project',
    storyId: '2-4',
    storyTitle: 'Agents Store & API',
    status: 'running',
    startedAt: '2026-01-15T12:00:00Z',
    lastActivity: '2026-01-15T12:05:00Z',
    lastOutput: 'Working...',
    duration: 300,
  };

  const mockAgentWithHistory = {
    ...mockAgent,
    outputHistory: ['Starting...', 'Working...'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/agents', agentsRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/agents', () => {
    it('returns all active agents', async () => {
      agentsService.getAllAgents.mockResolvedValue([mockAgent]);

      const response = await request(app).get('/api/agents');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toHaveProperty('total', 1);
      expect(response.body.meta).toHaveProperty('timestamp');
    });

    it('filters by projectId when provided', async () => {
      agentsService.getAgentsByProject.mockResolvedValue([mockAgent]);

      const response = await request(app)
        .get('/api/agents')
        .query({ projectId: 'test-project' });

      expect(response.status).toBe(200);
      expect(agentsService.getAgentsByProject).toHaveBeenCalledWith('test-project');
      expect(response.body.data).toHaveLength(1);
    });

    it('returns empty array when no agents', async () => {
      agentsService.getAllAgents.mockResolvedValue([]);

      const response = await request(app).get('/api/agents');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('includes correct response format', async () => {
      agentsService.getAllAgents.mockResolvedValue([mockAgent]);

      const response = await request(app).get('/api/agents');

      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('projectId');
      expect(response.body.data[0]).toHaveProperty('storyId');
      expect(response.body.data[0]).toHaveProperty('storyTitle');
      expect(response.body.data[0]).toHaveProperty('status');
      expect(response.body.data[0]).toHaveProperty('startedAt');
      expect(response.body.data[0]).toHaveProperty('lastActivity');
      expect(response.body.data[0]).toHaveProperty('lastOutput');
      expect(response.body.data[0]).toHaveProperty('duration');
    });
  });

  describe('GET /api/agents/:id', () => {
    it('returns agent with output history', async () => {
      agentsService.getAgentById.mockResolvedValue(mockAgentWithHistory);

      const response = await request(app).get('/api/agents/agent-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data.id).toBe('agent-123');
      expect(response.body.data).toHaveProperty('outputHistory');
    });

    it('returns 404 for non-existent agent', async () => {
      agentsService.getAgentById.mockResolvedValue(null);

      const response = await request(app).get('/api/agents/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Agent not found');
      expect(response.body).toHaveProperty('code', 'AGENT_NOT_FOUND');
    });

    it('includes timestamp in meta', async () => {
      agentsService.getAgentById.mockResolvedValue(mockAgentWithHistory);

      const response = await request(app).get('/api/agents/agent-123');

      expect(response.body.meta).toHaveProperty('timestamp');
      // Validate timestamp is ISO format
      expect(new Date(response.body.meta.timestamp).toISOString()).toBe(
        response.body.meta.timestamp
      );
    });
  });

  describe('error handling', () => {
    it('handles service errors gracefully', async () => {
      agentsService.getAllAgents.mockRejectedValue(new Error('Service error'));

      const response = await request(app).get('/api/agents');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
    });
  });

  /**
   * Story 4.1: Kill Agent API & Backend - Task 7.3
   */
  describe('POST /api/agents/:id/kill', () => {
    it('successfully kills an agent with SIGTERM', async () => {
      agentsService.killAgentById.mockResolvedValue({
        success: true,
        agentId: 'agent-123',
        method: 'SIGTERM',
        timestamp: '2026-01-15T12:00:00.000Z',
      });

      const response = await request(app)
        .post('/api/agents/agent-123/kill')
        .send({ reason: 'Test kill' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual({
        agentId: 'agent-123',
        status: 'killed',
        method: 'SIGTERM',
      });
      expect(response.body.meta).toHaveProperty('timestamp');
    });

    it('successfully kills an agent with SIGKILL fallback', async () => {
      agentsService.killAgentById.mockResolvedValue({
        success: true,
        agentId: 'agent-stubborn',
        method: 'SIGKILL',
        timestamp: '2026-01-15T12:00:00.000Z',
      });

      const response = await request(app)
        .post('/api/agents/agent-stubborn/kill')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.method).toBe('SIGKILL');
    });

    it('returns 404 for non-existent agent', async () => {
      agentsService.killAgentById.mockResolvedValue({
        success: false,
        agentId: 'non-existent',
        error: 'Agent not found',
        timestamp: '2026-01-15T12:00:00.000Z',
      });

      const response = await request(app)
        .post('/api/agents/non-existent/kill')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Agent not found');
      expect(response.body).toHaveProperty('code', 'AGENT_NOT_FOUND');
    });

    it('returns 500 for kill failures', async () => {
      agentsService.killAgentById.mockResolvedValue({
        success: false,
        agentId: 'agent-fail',
        error: 'Permission denied',
        timestamp: '2026-01-15T12:00:00.000Z',
      });

      const response = await request(app)
        .post('/api/agents/agent-fail/kill')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Permission denied');
      expect(response.body).toHaveProperty('code', 'KILL_FAILED');
    });

    it('passes reason and user context to service', async () => {
      agentsService.killAgentById.mockResolvedValue({
        success: true,
        agentId: 'agent-context',
        method: 'SIGTERM',
        timestamp: '2026-01-15T12:00:00.000Z',
      });

      await request(app)
        .post('/api/agents/agent-context/kill')
        .send({ reason: 'Stuck agent' });

      expect(agentsService.killAgentById).toHaveBeenCalledWith(
        'agent-context',
        expect.objectContaining({
          reason: 'Stuck agent',
        })
      );
    });

    it('uses default reason when not provided', async () => {
      agentsService.killAgentById.mockResolvedValue({
        success: true,
        agentId: 'agent-default',
        method: 'SIGTERM',
        timestamp: '2026-01-15T12:00:00.000Z',
      });

      await request(app)
        .post('/api/agents/agent-default/kill')
        .send({});

      expect(agentsService.killAgentById).toHaveBeenCalledWith(
        'agent-default',
        expect.objectContaining({
          reason: 'User requested kill',
        })
      );
    });

    it('handles service errors gracefully', async () => {
      agentsService.killAgentById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/agents/agent-error/kill')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
    });

    it('returns correct response format on success', async () => {
      agentsService.killAgentById.mockResolvedValue({
        success: true,
        agentId: 'agent-format',
        method: 'SIGTERM',
        timestamp: '2026-01-15T12:00:00.000Z',
      });

      const response = await request(app)
        .post('/api/agents/agent-format/kill')
        .send({});

      // Verify response follows API format from project-context.md
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toHaveProperty('agentId');
      expect(response.body.data).toHaveProperty('status', 'killed');
      expect(response.body.data).toHaveProperty('method');
      expect(response.body.meta).toHaveProperty('timestamp');
    });
  });
});
