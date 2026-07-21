import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  JWT_ISSUER: z.string().default('blink'),
  JWT_AUDIENCE: z.string().default('blink-client'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(5),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  WS_HEARTBEAT_INTERVAL: z.coerce.number().default(30000),
  WS_HEARTBEAT_TIMEOUT: z.coerce.number().default(10000),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
