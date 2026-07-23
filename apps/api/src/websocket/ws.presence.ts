import Redis from "ioredis";
import { config } from "@repo/config";
import { logger } from "@repo/logger";
import type { AuthenticatedSocket } from "./ws.types.js";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis !== null) return redis;
  if (!config.REDIS_URL) return null;
  try {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on("error", () => {
      // Silently ignore — will fall back to in-memory
    });
    logger.info("Redis connected for presence");
    return redis;
  } catch {
    logger.warn("Redis unavailable, using in-memory presence");
    return null;
  }
}

// In-memory fallback
const onlineUsers = new Map<string, string>();
const typingUsers = new Map<string, string>();

export class PresenceManager {
  private heartbeatInterval: NodeJS.Timeout | null = null;

  async userConnected(userId: string, socketId: string) {
    const r = getRedis();
    if (r) {
      await r.set("user:" + userId + ":online", socketId, "EX", 30);
    } else {
      onlineUsers.set(userId, socketId);
    }
    logger.debug({ userId }, "User connected");
  }

  async userDisconnected(userId: string) {
    const r = getRedis();
    if (r) {
      await r.del("user:" + userId + ":online");
    } else {
      onlineUsers.delete(userId);
    }
    logger.debug({ userId }, "User disconnected");
  }

  async refreshPresence(userId: string, socketId: string) {
    const r = getRedis();
    if (r) {
      await r.expire("user:" + userId + ":online", 30);
    } else {
      onlineUsers.set(userId, socketId);
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    const r = getRedis();
    if (r) {
      const result = await r.exists("user:" + userId + ":online");
      return result === 1;
    }
    return onlineUsers.has(userId);
  }

  async getOnlineUsers(): Promise<string[]> {
    const r = getRedis();
    if (r) {
      const keys = await r.keys("user:*:online");
      return keys.map((key) => key.split(":")[1]).filter((id): id is string => id !== undefined);
    }
    return Array.from(onlineUsers.keys());
  }

  async setTyping(roomId: string, userId: string) {
    const key = roomId + ":" + userId;
    const r = getRedis();
    if (r) {
      await r.set("typing:" + key, "1", "EX", 5);
    } else {
      typingUsers.set(key, "1");
      setTimeout(() => typingUsers.delete(key), 5000);
    }
  }

  async clearTyping(roomId: string, userId: string) {
    const key = roomId + ":" + userId;
    const r = getRedis();
    if (r) {
      await r.del("typing:" + key);
    } else {
      typingUsers.delete(key);
    }
  }

  async getTypingUsers(roomId: string): Promise<string[]> {
    const r = getRedis();
    if (r) {
      const keys = await r.keys("typing:" + roomId + ":*");
      return keys.map((key) => key.split(":")[2]).filter((id): id is string => id !== undefined);
    }
    return Array.from(typingUsers.keys())
      .filter((k) => k.startsWith(roomId + ":"))
      .map((k) => k.split(":")[1])
      .filter((id): id is string => id !== undefined);
  }
}

export const presenceManager = new PresenceManager();
