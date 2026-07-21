import type http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { authenticateWS } from "./ws.auth.js";
import { presenceManager } from "./ws.presence.js";
import { roomManager } from "./ws.rooms.js";
import { handleMessage } from "./ws.gateway.js";
import { setupHeartbeat } from "./ws.heartbeat.js";
import { createMessage } from "@repo/websocket";
import { logger } from "@repo/logger";
import type { AuthenticatedSocket } from "./ws.types.js";

export function attachWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  setupHeartbeat(wss);

  wss.on("connection", (ws: WebSocket, req) => {
    const socket = ws as AuthenticatedSocket;
    socket.isAlive = true;
    socket.rooms = new Set();

    const auth = authenticateWS(req);
    if (!auth) {
      socket.close(4001, "Authentication failed");
      return;
    }

    socket.userId = auth.userId;
    socket.email = auth.email;
    socket.username = auth.username;
    socket.role = auth.role;

    presenceManager.userConnected(auth.userId, socket.userId);

    logger.info({ userId: auth.userId }, "WebSocket connected");

    socket.on("message", (data) => {
      handleMessage(socket, data.toString());
    });

    socket.on("close", () => {
      if (socket.userId) {
        presenceManager.userDisconnected(socket.userId);
        roomManager.leaveAllRooms(socket);
      }
      logger.info({ userId: socket.userId }, "WebSocket disconnected");
    });

    socket.on("error", (err) => {
      logger.error({ err, userId: socket.userId }, "WebSocket error");
    });

    socket.on("pong", () => {
      socket.isAlive = true;
    });
  });

  logger.info("WebSocket server attached");
  return wss;
}
