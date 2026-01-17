/**
 * Tests for WebSocket broadcast service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  broadcast,
  broadcastToUser,
  emitAgentSpawn,
  emitAgentOutput,
  emitAgentComplete,
  emitAgentStuck,
  emitProjectUpdate,
  emitStoryVerified,
  setAuthenticatedClients,
  getAuthenticatedClients,
} from './websocket.js';

describe('WebSocket Broadcast Service', () => {
  let mockClients;

  beforeEach(() => {
    // Create mock WebSocket clients
    mockClients = new Map();
    setAuthenticatedClients(mockClients);
  });

  afterEach(() => {
    mockClients.clear();
  });

  function createMockWs(userId, readyState = 1) {
    return {
      userId,
      readyState,
      send: vi.fn(),
    };
  }

  describe('broadcast', () => {
    it('should broadcast message to all authenticated clients', () => {
      const ws1 = createMockWs('user1');
      const ws2 = createMockWs('user2');
      mockClients.set('user1', ws1);
      mockClients.set('user2', ws2);

      broadcast('test:event', { foo: 'bar' });

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);

      const message1 = JSON.parse(ws1.send.mock.calls[0][0]);
      expect(message1.type).toBe('test:event');
      expect(message1.data).toEqual({ foo: 'bar' });
      expect(message1.timestamp).toBeDefined();
    });

    it('should skip clients that are not in OPEN state', () => {
      const wsOpen = createMockWs('user1', 1); // OPEN
      const wsClosed = createMockWs('user2', 3); // CLOSED
      mockClients.set('user1', wsOpen);
      mockClients.set('user2', wsClosed);

      broadcast('test:event', { foo: 'bar' });

      expect(wsOpen.send).toHaveBeenCalledTimes(1);
      expect(wsClosed.send).not.toHaveBeenCalled();
    });

    it('should include ISO 8601 timestamp', () => {
      const ws = createMockWs('user1');
      mockClients.set('user1', ws);

      broadcast('test:event', {});

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(() => new Date(message.timestamp)).not.toThrow();
    });
  });

  describe('broadcastToUser', () => {
    it('should send message to specific user only', () => {
      const ws1 = createMockWs('user1');
      const ws2 = createMockWs('user2');
      mockClients.set('user1', ws1);
      mockClients.set('user2', ws2);

      broadcastToUser('user1', 'private:event', { secret: 'data' });

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).not.toHaveBeenCalled();

      const message = JSON.parse(ws1.send.mock.calls[0][0]);
      expect(message.type).toBe('private:event');
      expect(message.data).toEqual({ secret: 'data' });
    });

    it('should not throw if user not found', () => {
      expect(() => {
        broadcastToUser('nonexistent', 'test:event', {});
      }).not.toThrow();
    });
  });

  describe('emitAgentSpawn', () => {
    it('should broadcast agent:spawn event with correct payload', () => {
      const ws = createMockWs('user1');
      mockClients.set('user1', ws);

      emitAgentSpawn({
        id: 'agent-1',
        projectId: 'proj-1',
        storyId: '2-3',
        storyTitle: 'Test Story',
      });

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.type).toBe('agent:spawn');
      expect(message.data).toEqual({
        agentId: 'agent-1',
        projectId: 'proj-1',
        storyId: '2-3',
        storyTitle: 'Test Story',
      });
    });
  });

  describe('emitAgentOutput', () => {
    it('should broadcast agent:output event', () => {
      const ws = createMockWs('user1');
      mockClients.set('user1', ws);

      emitAgentOutput('agent-1', 'Processing task...');

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.type).toBe('agent:output');
      expect(message.data.agentId).toBe('agent-1');
      expect(message.data.output).toBe('Processing task...');
      // Timestamp is in the message envelope, not the data
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('emitAgentComplete', () => {
    it('should broadcast agent:complete event with success', () => {
      const ws = createMockWs('user1');
      mockClients.set('user1', ws);

      emitAgentComplete({
        id: 'agent-1',
        projectId: 'proj-1',
        storyId: '2-3',
      }, 'success');

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.type).toBe('agent:complete');
      expect(message.data).toEqual({
        agentId: 'agent-1',
        projectId: 'proj-1',
        storyId: '2-3',
        result: 'success',
      });
    });

    it('should broadcast agent:complete event with failed', () => {
      const ws = createMockWs('user1');
      mockClients.set('user1', ws);

      emitAgentComplete({
        id: 'agent-1',
        projectId: 'proj-1',
        storyId: '2-3',
      }, 'failed');

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.data.result).toBe('failed');
    });
  });

  describe('emitAgentStuck', () => {
    it('should broadcast agent:stuck event with Story 4.6 format', () => {
      const ws = createMockWs('user1');
      mockClients.set('user1', ws);

      emitAgentStuck({
        agentId: 'agent-1',
        storyId: '4-6',
        duration: '45m',
        durationMinutes: 45,
      });

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.type).toBe('agent:stuck');
      expect(message.data).toEqual({
        agentId: 'agent-1',
        storyId: '4-6',
        duration: '45m',
        durationMinutes: 45,
      });
    });
  });

  describe('emitProjectUpdate', () => {
    it('should broadcast project:update event', () => {
      const ws = createMockWs('user1');
      mockClients.set('user1', ws);

      emitProjectUpdate({
        id: 'proj-1',
        status: 'running',
        currentEpic: 2,
        currentStory: '2-3',
      });

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.type).toBe('project:update');
      expect(message.data).toEqual({
        projectId: 'proj-1',
        status: 'running',
        currentEpic: 2,
        currentStory: '2-3',
      });
    });
  });

  describe('emitStoryVerified', () => {
    it('should broadcast story:verified event', () => {
      const ws = createMockWs('user1');
      mockClients.set('user1', ws);

      const result = {
        projectId: 'proj-1',
        storyId: '2-3',
        claimed: 'done',
        actual: 'done',
        match: true,
      };

      emitStoryVerified(result);

      const message = JSON.parse(ws.send.mock.calls[0][0]);
      expect(message.type).toBe('story:verified');
      expect(message.data).toEqual(result);
    });
  });
});
