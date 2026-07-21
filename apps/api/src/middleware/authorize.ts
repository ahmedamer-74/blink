import type { Response, NextFunction } from "express";
import { ForbiddenError } from "@repo/utils";
import type { AuthRequest } from "./authenticate.js";

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError("Not authenticated"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }
    next();
  };
};
