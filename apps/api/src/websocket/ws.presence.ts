import Redis from "ioredis";
import { config } from "@repo/config";
import { logger } from "@repo/logger";
import type { AuthenticatedSocket } from "./ws.types.js";

const redis = new Redis(config.REDIS_URL);

export class PresenceManager {
  private heartbeatInterval: NodeJS.Timeout | null = null;

  async userConnected(userId: string, socketId: string) {
    await redis.set("user:" + userId + ":online", socketId, "EX", 30);
    logger.debug({ userId }, "User connected");
  }

  async userDisconnected(userId: string) {
    await redis.del("user:" + userId + ":online");
    logger.debug({ userId }, "User disconnected");
  }

  async refreshPresence(userId: string, socketId: string) {
    await redis.expire("user:" + userId + ":online", 30);
  }

  async isOnline(userId: string): Promise<boolean> {
    const result = await redis.exists("user:" + userId + ":online");
    return result === 1;
  }

  async getOnlineUsers(): Promise<string[]> {
    const keys = await redis.keys("user:*:online");
    return keys.map((key) => key.split(":")[1]).filter((id): id is string => id !== undefined);
  }

  async setTyping(roomId: string, userId: string) {
    await redis.set("typing:" + roomId + ":" + userId, "1", "EX", 5);
  }

  async clearTyping(roomId: string, userId: string) {
    await redis.del("typing:" + roomId + ":" + userId);
  }

  async getTypingUsers(roomId: string): Promise<string[]> {
    const keys = await redis.keys("typing:" + roomId + ":*");
    return keys.map((key) => key.split(":")[2]).filter((id): id is string => id !== undefined);
  }
}

export const presenceManager = new PresenceManager();
