import type { Request, Response, NextFunction } from "express";
import { config } from "@repo/config";
import { RateLimitError } from "@repo/utils";

const hits = new Map<string, { count: number; expiresAt: number }>();

function cleanupMemory() {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.expiresAt) hits.delete(key);
  }
}
setInterval(cleanupMemory, 60_000);

function incrKey(key: string, ttlMs: number): number {
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
    const current = incrKey(key, config.RATE_LIMIT_WINDOW_MS);
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
    const current = incrKey(key, 60_000);
    if (current > config.AUTH_RATE_LIMIT_MAX) {
      return next(new RateLimitError("Too many auth attempts. Please try again later."));
    }
    next();
  } catch {
    next();
  }
};
