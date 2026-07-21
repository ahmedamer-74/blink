import http from "node:http";
import type { Express } from "express";
import { attachWebSocket } from "./websocket/ws.server.js";

export function createServer(app: Express) {
  const server = http.createServer(app);
  attachWebSocket(server);
  return server;
}
