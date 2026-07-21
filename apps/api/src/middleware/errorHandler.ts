import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "@repo/utils";
import { Prisma } from "@repo/database";
import { logger } from "@repo/logger";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError && err.isOperational) {
    if (err instanceof ValidationError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        data: null,
        errors: err.errors,
        meta: null,
      });
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
      errors: null,
      meta: null,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(err);
    return res.status(prismaError.statusCode).json({
      success: false,
      message: prismaError.message,
      data: null,
      errors: null,
      meta: null,
    });
  }

  logger.error({ err }, "Unhandled server error");
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    data: null,
    errors: null,
    meta: null,
  });
};

function handlePrismaError(err: Prisma.PrismaClientKnownRequestError) {
  switch (err.code) {
    case "P2002":
      return { statusCode: 409 as const, message: "Resource already exists" };
    case "P2025":
      return { statusCode: 404 as const, message: "Resource not found" };
    case "P2003":
      return { statusCode: 400 as const, message: "Invalid reference" };
    default:
      return { statusCode: 500 as const, message: "Database error" };
  }
}
