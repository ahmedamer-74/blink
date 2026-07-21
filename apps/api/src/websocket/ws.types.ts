import type WebSocket from "ws";

export interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  email?: string;
  username?: string;
  role?: string;
  isAlive?: boolean;
  rooms?: Set<string>;
}
