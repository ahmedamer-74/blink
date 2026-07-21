import { v4 as uuidv4 } from "uuid";
import { signAccessToken, signRefreshToken } from "./jwt.js";
import type { JWTPayload, TokenPair, UserRole } from "@repo/types";

interface GenerateTokenPairInput {
  userId: string;
  email: string;
  role: UserRole;
  permissions?: string[];
}

export function generateTokenPair(input: GenerateTokenPairInput): TokenPair {
  const jti = uuidv4();

  const accessToken = signAccessToken({
    sub: input.userId,
    email: input.email,
    role: input.role,
    permissions: input.permissions ?? [],
    jti,
  });

  const refreshToken = signRefreshToken({
    sub: input.userId,
    jti,
    type: "refresh",
  });

  return { accessToken, refreshToken };
}

export function extractJTI(token: string): string {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) throw new Error("Invalid token format");
  const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
  return decoded.jti as string;
}

export function extractPayload(token: string): JWTPayload {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) throw new Error("Invalid token format");
  const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
  return decoded as JWTPayload;
}
