import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";
import { ValidationError } from "@repo/utils";

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

function formatZodErrors(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: { field: string; message: string }[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error));
      } else {
        req.body = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error));
      } else {
        req.params = result.data as typeof req.params;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error));
      } else {
        req.query = result.data as typeof req.query;
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError(errors));
    }

    next();
  };
}
