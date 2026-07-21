import type { ErrorDetail } from "@repo/types";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    // captureStackTrace is V8-only; safe to skip on other runtimes
    (Error as any).captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly errors: ErrorDetail[];

  constructor(errors: ErrorDetail[]) {
    super("Validation failed", 400, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AUTH_ERROR");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "RATE_LIMITED");
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database error") {
    super(message, 500, "DATABASE_ERROR", false);
  }
}
