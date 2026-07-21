import type { WSClientEvents, WSServerEvents } from "@repo/types";

type ServerEvent = keyof WSServerEvents;
type EventCallback<T = unknown> = (data: T) => void;

interface InternalEvents {
  _connected: void;
  _disconnected: void;
  _unauthorized: void;
}

type InternalEvent = keyof InternalEvents;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:5000/ws";

export class ChatSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private accessToken: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isIntentionalClose = false;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.isIntentionalClose = false;
    const url = `${WS_URL}?token=${encodeURIComponent(this.accessToken)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emitInternal("_connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { event: string; data: unknown };
        this.emit(parsed.event, parsed.data);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = (event) => {
      this.emitInternal("_disconnected");

      if (this.isIntentionalClose) return;

      if (event.code === 4001) {
        this.emitInternal("_unauthorized");
        return;
      }

      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose fires after onerror
    };
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  updateToken(token: string) {
    this.accessToken = token;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  reconnect() {
    this.disconnect();
    this.isIntentionalClose = false;
    this.connect();
  }

  send<T extends keyof WSClientEvents>(event: T, data: WSClientEvents[T]) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
  }

  on<T extends ServerEvent>(event: T, callback: EventCallback<WSServerEvents[T]>): () => void;
  on<T extends InternalEvent>(event: T, callback: EventCallback<InternalEvents[T]>): () => void;
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        cb(data);
      }
    }
  }

  private emitInternal(event: InternalEvent) {
    this.emit(event, undefined);
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
