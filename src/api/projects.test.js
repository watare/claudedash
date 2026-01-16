/**
 * Tests for Projects API routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import projectsRouter from './projects.js';

// Mock the auth middleware
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 'test-user', email: 'test@example.com' };
    next();
  },
}));

// Mock the projects service
vi.mock('../services/projects.js', () => ({
  getAllProjects: vi.fn(),
  getProjectById: vi.fn(),
}));

import { getAllProjects, getProjectById } from '../services/projects.js';

describe('Projects API', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/projects', projectsRouter);
  });

  describe('GET /api/projects', () => {
    it('returns projects with correct format', async () => {
      const mockProjects = [
        {
          id: 'bmad-orchestrator',
          name: 'bmad-orchestrator',
          path: '/home/ubuntu/bmad-orchestrator',
          status: 'running',
          currentEpic: 2,
          currentStory: '2-3',
          agentCount: 4,
          lastActivity: '2026-01-15T12:00:00Z',
        },
      ];

      getAllProjects.mockResolvedValue(mockProjects);

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total', 1);
      expect(response.body.meta).toHaveProperty('timestamp');
      expect(response.body.data).toEqual(mockProjects);
    });

    it('returns empty array when no projects exist', async () => {
      getAllProjects.mockResolvedValue([]);

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('handles service errors gracefully', async () => {
      getAllProjects.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns single project with epic/story details', async () => {
      const mockProject = {
        id: 'bmad-orchestrator',
        name: 'bmad-orchestrator',
        path: '/home/ubuntu/bmad-orchestrator',
        status: 'running',
        currentEpic: 2,
        currentStory: '2-3',
        agentCount: 4,
        lastActivity: '2026-01-15T12:00:00Z',
        epics: [
          {
            number: 1,
            title: 'Secure Dashboard Foundation',
            status: 'done',
            stories: [
              { id: '1-1', title: 'Dashboard Scaffolding', status: 'done' },
            ],
          },
        ],
      };

      getProjectById.mockResolvedValue(mockProject);

      const response = await request(app).get('/api/projects/bmad-orchestrator');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta.timestamp');
      expect(response.body.data).toEqual(mockProject);
      expect(response.body.data.epics).toHaveLength(1);
    });

    it('returns 404 for non-existent project', async () => {
      getProjectById.mockResolvedValue(null);

      const response = await request(app).get('/api/projects/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Project not found');
      expect(response.body).toHaveProperty('code', 'PROJECT_NOT_FOUND');
    });

    it('handles service errors gracefully', async () => {
      getProjectById.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/projects/bmad-orchestrator');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
    });
  });
});
