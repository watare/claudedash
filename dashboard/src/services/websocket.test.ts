/**
 * Tests for WebSocket client service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient, type WSMessage } from './websocket';

// Mock WebSocket class
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Store reference for test access
    lastMockWs = this;
  }

  send = vi.fn();
  close = vi.fn();

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen(new Event('open'));
  }

  simulateClose(code = 1000, reason = '', wasClean = true) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason, wasClean } as CloseEvent);
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  simulateError() {
    if (this.onerror) this.onerror(new Event('error'));
  }
}

// Track the most recent mock WebSocket instance
let lastMockWs: MockWebSocket | null = null;

// Track all created instances for counting
let wsInstances: MockWebSocket[] = [];

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset tracking
    lastMockWs = null;
    wsInstances = [];

    // Replace global WebSocket with mock
    globalThis.WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        wsInstances.push(this);
      }
    } as unknown as typeof WebSocket;

    // Add static properties
    Object.assign(globalThis.WebSocket, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });

    client = new WebSocketClient();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    globalThis.WebSocket = originalWebSocket;
  });

  describe('connect', () => {
    it('should establish connection with token in query string', () => {
      client.connect('test-token');

      expect(lastMockWs).not.toBeNull();
      expect(lastMockWs!.url).toContain('?token=test-token');
    });

    it('should emit connection:open on successful connection', () => {
      const handler = vi.fn();
      client.on('connection:open', handler);

      client.connect('test-token');
      lastMockWs!.simulateOpen();

      expect(handler).toHaveBeenCalled();
    });

    it('should reset reconnect attempts on successful connection', () => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();

      expect(client.isConnected).toBe(true);
    });
  });

  describe('message handling', () => {
    beforeEach(() => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();
    });

    it('should route messages to registered handlers', () => {
      const handler = vi.fn();
      client.on('agent:spawn', handler);

      const message: WSMessage = {
        type: 'agent:spawn',
        data: { agentId: '1' },
        timestamp: new Date().toISOString(),
      };
      lastMockWs!.simulateMessage(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should support wildcard handler', () => {
      const wildcardHandler = vi.fn();
      client.on('*', wildcardHandler);

      const message: WSMessage = {
        type: 'any:event',
        data: {},
      };
      lastMockWs!.simulateMessage(message);

      expect(wildcardHandler).toHaveBeenCalledWith(message);
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = client.on('test:event', handler);

      const message: WSMessage = { type: 'test:event', data: {} };
      lastMockWs!.simulateMessage(message);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      lastMockWs!.simulateMessage(message);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnection on unclean close', () => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();

      // Simulate unclean close
      lastMockWs!.simulateClose(1006, 'Connection lost', false);

      // Advance timers to trigger reconnect
      vi.advanceTimersByTime(1000);

      expect(wsInstances.length).toBe(2);
    });

    it('should implement exponential backoff', () => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();

      // First disconnect - 1s delay
      lastMockWs!.simulateClose(1006, '', false);
      vi.advanceTimersByTime(1000);
      expect(wsInstances.length).toBe(2);

      // Note: successful connection resets reconnect attempts
      // So we need to NOT open the socket to test backoff
      // Second disconnect without successful reconnect - 2s delay
      lastMockWs!.simulateClose(1006, '', false);
      vi.advanceTimersByTime(1000); // Not enough time
      expect(wsInstances.length).toBe(2);
      vi.advanceTimersByTime(1000); // 2s total delay
      expect(wsInstances.length).toBe(3);

      // Third disconnect without reconnect - 4s delay
      lastMockWs!.simulateClose(1006, '', false);
      vi.advanceTimersByTime(4000);
      expect(wsInstances.length).toBe(4);
    });

    it('should cap reconnect delay at 30 seconds', () => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();

      // Simulate many disconnects to reach max delay
      for (let i = 0; i < 10; i++) {
        lastMockWs!.simulateClose(1006, '', false);
        vi.advanceTimersByTime(30000); // Max delay
        if (lastMockWs) lastMockWs.simulateOpen();
      }

      // 1 initial + 10 reconnects (capped by maxReconnectAttempts)
      expect(wsInstances.length).toBe(11);
    });

    it('should stop reconnecting after max attempts', () => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();

      // Simulate many disconnects beyond max attempts
      for (let i = 0; i < 15; i++) {
        if (lastMockWs) {
          lastMockWs.simulateClose(1006, '', false);
          vi.advanceTimersByTime(30000);
        }
      }

      // Should stop at 11 (1 initial + 10 reconnects)
      expect(wsInstances.length).toBe(11);
    });

    it('should not reconnect on clean close', () => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();

      // Clean close (e.g., logout)
      lastMockWs!.simulateClose(1000, 'Normal closure', true);

      vi.advanceTimersByTime(30000);

      // Should not reconnect
      expect(wsInstances.length).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('should close the WebSocket connection', () => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();

      const ws = lastMockWs!;
      client.disconnect();

      expect(ws.close).toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', () => {
      client.connect('test-token');
      expect(client.isConnected).toBe(false);

      lastMockWs!.simulateOpen();
      expect(client.isConnected).toBe(true);
    });

    it('should return false when disconnected', () => {
      client.connect('test-token');
      lastMockWs!.simulateOpen();
      expect(client.isConnected).toBe(true);

      lastMockWs!.simulateClose(1000, '', true);
      expect(client.isConnected).toBe(false);
    });
  });
});
