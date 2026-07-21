import type { Request, Response, NextFunction } from "express";
import { createChildLogger } from "@repo/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const reqId = crypto.randomUUID();
  const child = createChildLogger({ reqId });

  res.on("finish", () => {
    child.info({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    }, "HTTP request completed");
  });

  next();
};
