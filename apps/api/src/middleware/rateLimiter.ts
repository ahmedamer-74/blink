import type { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { config } from "@repo/config";
import { RateLimitError } from "@repo/utils";

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
    redis.on("error", () => {});
    return redis;
  } catch {
    return null;
  }
}

// In-memory fallback for rate limiting
const hits = new Map<string, { count: number; expiresAt: number }>();

function cleanupMemory() {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.expiresAt) hits.delete(key);
  }
}
setInterval(cleanupMemory, 60_000);

async function incrKey(key: string, ttlMs: number): Promise<number> {
  const r = getRedis();
  if (r) {
    const current = await r.incr(key);
    if (current === 1) {
      await r.expire(key, Math.ceil(ttlMs / 1000));
    }
    return current;
  }

  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.expiresAt) {
    hits.set(key, { count: 1, expiresAt: now + ttlMs });
    return 1;
  }
  entry.count++;
  return entry.count;
}

export const globalRateLimiter = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = "rate:" + ip;
  try {
    const current = await incrKey(key, config.RATE_LIMIT_WINDOW_MS);
    if (current > config.RATE_LIMIT_MAX_REQUESTS) {
      return next(new RateLimitError("Too many requests. Please try again later."));
    }
    next();
  } catch {
    next();
  }
};

export const authRateLimiter = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = "rate:auth:" + ip;
  try {
    const current = await incrKey(key, 60_000);
    if (current > config.AUTH_RATE_LIMIT_MAX) {
      return next(new RateLimitError("Too many auth attempts. Please try again later."));
    }
    next();
  } catch {
    next();
  }
};
