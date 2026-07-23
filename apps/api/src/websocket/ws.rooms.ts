import type { AuthenticatedSocket } from "./ws.types.js";
import { createMessage } from "@repo/websocket";
import { logger } from "@repo/logger";

export class RoomManager {
  private rooms = new Map<string, Set<AuthenticatedSocket>>();

  joinRoom(socket: AuthenticatedSocket, roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(socket);

    if (!socket.rooms) socket.rooms = new Set();
    socket.rooms.add(roomId);

    this.broadcast(roomId, createMessage("room:member_joined", {
      roomId,
      user: { id: socket.userId, username: socket.username },
    }), socket.userId);

    logger.debug({ userId: socket.userId, roomId }, "User joined room");
  }

  leaveRoom(socket: AuthenticatedSocket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) this.rooms.delete(roomId);
    }

    socket.rooms?.delete(roomId);

    this.broadcast(roomId, createMessage("room:member_left", {
      roomId,
      userId: socket.userId!,
    }));

    logger.debug({ userId: socket.userId, roomId }, "User left room");
  }

  broadcast(roomId: string, message: unknown, excludeUserId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const payload = JSON.stringify(message);
    for (const socket of room) {
      if (socket.userId !== excludeUserId && socket.readyState === 1) {
        socket.send(payload);
      }
    }
  }

  getRoomSockets(roomId: string): AuthenticatedSocket[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room);
  }

  broadcastAll(message: unknown, excludeUserId?: string) {
    const payload = JSON.stringify(message);
    for (const [, room] of this.rooms) {
      for (const socket of room) {
        if (socket.userId !== excludeUserId && socket.readyState === 1) {
          socket.send(payload);
        }
      }
    }
  }

  leaveAllRooms(socket: AuthenticatedSocket) {
    if (socket.rooms) {
      for (const roomId of socket.rooms) {
        this.leaveRoom(socket, roomId);
      }
    }
  }
}

export const roomManager = new RoomManager();
