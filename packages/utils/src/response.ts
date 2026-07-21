import type { ApiResponse, PaginationMeta } from "@repo/types";

export function sendSuccess<T>(
  data: T,
  message: string,
  statusCode = 200,
  meta: PaginationMeta | null = null,
): { status: number; body: ApiResponse<T> } {
  return {
    status: statusCode,
    body: {
      success: true,
      message,
      data,
      errors: null,
      meta,
    },
  };
}

export function sendError(
  message: string,
  statusCode: number,
  errors: { field: string; message: string }[] | null = null,
): { status: number; body: ApiResponse<null> } {
  return {
    status: statusCode,
    body: {
      success: false,
      message,
      data: null,
      errors,
      meta: null,
    },
  };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
