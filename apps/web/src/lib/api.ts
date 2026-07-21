import type { ApiResponse } from "@repo/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public errors: { field: string; message: string }[],
  ) {
    super(errors.map((e) => e.message).join(", "));
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success || !res.ok) {
    throw new ApiError(res.status, json.errors ?? []);
  }

  return json;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
