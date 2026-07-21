import type WebSocket from "ws";
import { config } from "@repo/config";
import type { AuthenticatedSocket } from "./ws.types.js";

export function setupHeartbeat(wss: WebSocket.Server) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as AuthenticatedSocket;
      if (socket.isAlive === false) {
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, config.WS_HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(interval);
  });
}
