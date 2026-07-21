import type { IncomingMessage } from "http";
import { verifyAccessToken } from "@repo/auth";

export function authenticateWS(req: IncomingMessage): { userId: string; email: string; username: string; role: string } | null {
  try {
    const url = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"));
    const token = url.searchParams.get("token") || extractTokenFromHeaders(req);

    if (!token) return null;

    const payload = verifyAccessToken(token);
    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.sub,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

function extractTokenFromHeaders(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1] ?? null;
  }
  return null;
}
