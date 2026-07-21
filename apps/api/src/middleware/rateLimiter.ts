import type { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { config } from "@repo/config";
import { RateLimitError } from "@repo/utils";

const redis = new Redis(config.REDIS_URL);

export const globalRateLimiter = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = "rate:" + ip;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000));
    }
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
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 60);
    }
    if (current > config.AUTH_RATE_LIMIT_MAX) {
      return next(new RateLimitError("Too many auth attempts. Please try again later."));
    }
    next();
  } catch {
    next();
  }
};
