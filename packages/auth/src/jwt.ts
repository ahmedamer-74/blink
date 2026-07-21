import jwt from 'jsonwebtoken'
import type { JWTPayload, RefreshTokenPayload, TokenConfig } from '@repo/types'
import type { StringValue } from 'ms'

export function getTokenConfig(): TokenConfig {
  return {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET!,
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'blink',
    audience: process.env.JWT_AUDIENCE || 'blink-client',
  }
}

export function signAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const cfg = getTokenConfig()
  return jwt.sign(payload, cfg.accessTokenSecret, {
    expiresIn: cfg.accessTokenExpiry as StringValue,
    issuer: cfg.issuer,
    audience: cfg.audience,
  })
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
  const cfg = getTokenConfig()
  return jwt.sign(payload, cfg.refreshTokenSecret, {
    expiresIn: cfg.refreshTokenExpiry as StringValue,
    issuer: cfg.issuer,
    audience: cfg.audience,
  })
}

export function verifyAccessToken(token: string): JWTPayload {
  const cfg = getTokenConfig()
  return jwt.verify(token, cfg.accessTokenSecret, {
    issuer: cfg.issuer,
    audience: cfg.audience,
  }) as JWTPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const cfg = getTokenConfig()
  return jwt.verify(token, cfg.refreshTokenSecret, {
    issuer: cfg.issuer,
    audience: cfg.audience,
  }) as RefreshTokenPayload
}
