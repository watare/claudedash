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
});
