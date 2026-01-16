/**
 * WebSocket client service for real-time updates
 *
 * Provides a singleton WebSocket client that:
 * - Connects with JWT authentication
 * - Routes messages to registered handlers
 * - Implements automatic reconnection with exponential backoff
 */

export interface WSMessage {
  type: string;
  data: unknown;
  timestamp?: string;
}

type MessageHandler = (message: WSMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isReconnecting = false;

  constructor() {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3456';
    this.url = `${protocol}//${host}`;
  }

  /**
   * Connect to WebSocket server with authentication token
   */
  connect(token: string): void {
    this.token = token;
    this.establishConnection();
  }

  private establishConnection(): void {
    if (!this.token) return;

    try {
      this.ws = new WebSocket(`${this.url}?token=${this.token}`);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.emit('connection:open', {});
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        if (import.meta.env.DEV) console.log('WebSocket closed:', event.code, event.reason);
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error: Event) => {
        if (import.meta.env.DEV) console.error('WebSocket error:', error);
      };
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to establish WebSocket connection:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, ...max 30s
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    if (import.meta.env.DEV) console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emit('connection:reconnecting', { attempt: this.reconnectAttempts, delay });

    setTimeout(() => {
      this.isReconnecting = false;
      this.establishConnection();
    }, delay);
  }

  private handleMessage(message: WSMessage): void {
    // Route to specific handlers
    const handlers = this.handlers.get(message.type) || [];
    handlers.forEach(handler => handler(message));

    // Also trigger wildcard handlers
    const wildcardHandlers = this.handlers.get('*') || [];
    wildcardHandlers.forEach(handler => handler(message));
  }

  /**
   * Register a handler for a specific message type
   * @param type - Message type to handle (e.g., 'agent:spawn') or '*' for all messages
   * @param handler - Callback function
   * @returns Unsubscribe function
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  /**
   * Emit an internal event (for connection state changes)
   */
  private emit(type: string, data: unknown): void {
    this.handleMessage({ type, data, timestamp: new Date().toISOString() });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.token = null;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
  }

  /**
   * Check if currently connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the current token (for re-connection)
   */
  get currentToken(): string | null {
    return this.token;
  }
}

// Export singleton instance
export const wsClient = new WebSocketClient();
