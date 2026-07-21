"use server";

import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface AuthResponseData {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: { field: string; message: string }[] | null;
}

async function apiRequest<T>(
  path: string,
  body?: unknown,
): Promise<{ json: ApiResponse<T>; setCookie: string | null }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const setCookie = res.headers.get("set-cookie");
  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success || !res.ok) {
    const errMsg = json.errors?.[0]?.message ?? json.message;
    throw new Error(errMsg);
  }

  return { json, setCookie };
}

async function forwardCookie(setCookie: string | null) {
  if (!setCookie) return;
  const cookieStore = await cookies();
  const eqIndex = setCookie.indexOf("=");
  if (eqIndex === -1) return;
  const name = setCookie.slice(0, eqIndex).trim();
  const raw = setCookie.slice(eqIndex + 1);
  const value = raw.includes(";") ? raw.split(";")[0]!.trim() : raw.trim();
  cookieStore.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | { success: true; accessToken: string; user: AuthResponseData["user"] }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const { json, setCookie } = await apiRequest<AuthResponseData>("/api/v1/auth/login", { email, password });
    await forwardCookie(setCookie);
    return { success: true, accessToken: json.data!.accessToken, user: json.data!.user };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "An unexpected error occurred" };
  }
}

export async function registerAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | { success: true; accessToken: string; user: AuthResponseData["user"] }> {
  const email = formData.get("email") as string;
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  try {
    const { json, setCookie } = await apiRequest<AuthResponseData>("/api/v1/auth/register", {
      email,
      username,
      password,
    });
    await forwardCookie(setCookie);
    return { success: true, accessToken: json.data!.accessToken, user: json.data!.user };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "An unexpected error occurred" };
  }
}

export async function refreshAction(): Promise<{ accessToken: string } | null> {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const setCookie = res.headers.get("set-cookie");
    const json = (await res.json()) as ApiResponse<{ accessToken: string }>;

    if (!json.success || !res.ok) return null;

    await forwardCookie(setCookie);
    return { accessToken: json.data!.accessToken };
  } catch {
    return null;
  }
}

export async function logoutAction() {
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, { method: "POST" });
  } catch {
    // clear client state regardless
  }
  const cookieStore = await cookies();
  cookieStore.delete("refreshToken");
}

export async function hydrateAuth(): Promise<{ accessToken: string; user: AuthResponseData["user"] } | null> {
  try {
    const refreshResult = await refreshAction();
    if (!refreshResult) return null;

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE}/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${refreshResult.accessToken}`,
      },
    });

    const json = (await res.json()) as ApiResponse<AuthResponseData["user"]>;
    if (!json.success || !res.ok || !json.data) return null;

    return { accessToken: refreshResult.accessToken, user: json.data };
  } catch {
    return null;
  }
}
