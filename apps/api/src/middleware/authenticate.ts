import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@repo/auth";
import { AuthError } from "@repo/utils";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next(new AuthError("Missing or invalid authorization header"));
    }

    const token = authHeader.split(" ")[1]!;
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
    };

    next();
  } catch {
    next(new AuthError("Invalid or expired token"));
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1]!;
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
    };
  } catch {
    // Ignore
  }
  next();
};
