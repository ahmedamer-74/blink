import { logger } from "@repo/logger";
import type { AuthenticatedSocket } from "./ws.types.js";

const onlineUsers = new Map<string, string>();
const typingUsers = new Map<string, string>();

export class PresenceManager {
  private heartbeatInterval: NodeJS.Timeout | null = null;

  async userConnected(userId: string, socketId: string) {
    onlineUsers.set(userId, socketId);
    logger.debug({ userId }, "User connected");
  }

  async userDisconnected(userId: string) {
    onlineUsers.delete(userId);
    logger.debug({ userId }, "User disconnected");
  }

  async refreshPresence(userId: string, socketId: string) {
    onlineUsers.set(userId, socketId);
  }

  async isOnline(userId: string): Promise<boolean> {
    return onlineUsers.has(userId);
  }

  async getOnlineUsers(): Promise<string[]> {
    return Array.from(onlineUsers.keys());
  }

  async setTyping(roomId: string, userId: string) {
    const key = roomId + ":" + userId;
    typingUsers.set(key, "1");
    setTimeout(() => typingUsers.delete(key), 5000);
  }

  async clearTyping(roomId: string, userId: string) {
    const key = roomId + ":" + userId;
    typingUsers.delete(key);
  }

  async getTypingUsers(roomId: string): Promise<string[]> {
    return Array.from(typingUsers.keys())
      .filter((k) => k.startsWith(roomId + ":"))
      .map((k) => k.split(":")[1])
      .filter((id): id is string => id !== undefined);
  }
}

export const presenceManager = new PresenceManager();
