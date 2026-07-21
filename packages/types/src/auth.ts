import type { UserRole } from "./user.js";

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  permissions: string[];
  iat: number;
  exp: number;
  jti: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
}
