export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  errors: ErrorDetail[] | null;
  meta: PaginationMeta | null;
}

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
