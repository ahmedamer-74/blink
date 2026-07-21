# Chapter 08: API Middleware

---

## What Problem Does This Solve?

Express middleware are functions that run before your route handlers. They handle cross-cutting concerns that every request needs: authentication, rate limiting, error handling, logging, and validation. Without middleware, you'd repeat the same logic in every route handler.

Blink's middleware stack is a pipeline: request → logger → rate limiter → route handler (with optional auth/validation middleware) → error handler.

## How It Works in General

Middleware in Express follows the `(req, res, next)` pattern. Each middleware either:

1. Calls `next()` to pass control to the next middleware.
2. Calls `next(error)` to skip to the error handler.
3. Sends a response (e.g., 401 Unauthorized) and stops the pipeline.

Middleware are registered in order in `apps/api/src/app.ts`. The order matters — a request hits them top-to-bottom.

## How We Do It Here

### The Middleware Pipeline (`apps/api/src/app.ts`)

```typescript
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: config.CORS_ORIGINS.split(","), credentials: true }));
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);
  app.use(globalRateLimiter);

  // Routes
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, usersRoutes);
  app.use(`${prefix}/rooms`, roomsRoutes);
  app.use(`${prefix}/messages`, messagesRoutes);

  app.use(errorHandler);  // Must be last

  return app;
}
```

The pipeline order:

1. **`helmet()`** — Sets security headers (X-Content-Type-Options, X-Frame-Options, etc.).
2. **`compression()`** — gzip compression for responses.
3. **`cors()`** — Allows the frontend origin to make requests. `credentials: true` allows cookies.
4. **`express.json({ limit: "10kb" })`** — Parses JSON bodies, max 10KB. Prevents large payload attacks.
5. **`requestLogger`** — Logs every request with timing.
6. **`globalRateLimiter`** — Prevents abuse.
7. **Route handlers** — Each has its own middleware (auth, validation).
8. **`errorHandler`** — Catches any errors thrown by the above.

### Authentication Middleware (`apps/api/src/middleware/authenticate.ts`)

```typescript
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next(new AuthError("Missing or invalid authorization header"));
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
    };

    next();
  } catch {
    next(new AuthError("Invalid or expired token"));
  }
};
```

Used on protected routes:

```typescript
router.get("/me", authenticate, controller.getProfile);
router.delete("/:id", authenticate, authorize("ADMIN", "SUPERADMIN"), controller.delete);
```

There's also `optionalAuth` — it attaches the user if a valid token is present but doesn't reject anonymous requests:

```typescript
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role, permissions: payload.permissions };
  } catch {
    // Ignore — anonymous request
  }
  next();
};
```

### Authorization Middleware (`apps/api/src/middleware/authorize.ts`)

```typescript
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError("Not authenticated"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }
    next();
  };
};
```

Used after `authenticate`:

```typescript
// Only admins and superadmins can list all users
router.get("/", authenticate, authorize("ADMIN", "SUPERADMIN"), controller.findAll);

// Only admins and superadmins can delete users
router.delete("/:id", authenticate, authorize("ADMIN", "SUPERADMIN"), controller.delete);
```

The `...allowedRoles` spread means you can pass multiple roles: `authorize("ADMIN", "SUPERADMIN")`.

### Rate Limiting (`apps/api/src/middleware/rateLimiter.ts`)

```typescript
const redis = new Redis(config.REDIS_URL);

export const globalRateLimiter = async (req: Request, _res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = "rate:" + ip;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000));
    }
    if (current > config.RATE_LIMIT_MAX_REQUESTS) {
      return next(new RateLimitError("Too many requests. Please try again later."));
    }
    next();
  } catch {
    next(); // If Redis is down, allow the request
  }
};

export const authRateLimiter = async (req: Request, _res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = "rate:auth:" + ip;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 60);  // 60-second window
    }
    if (current > config.AUTH_RATE_LIMIT_MAX) {  // Default: 5
      return next(new RateLimitError("Too many auth attempts. Please try again later."));
    }
    next();
  } catch {
    next();
  }
};
```

Two rate limiters:

- **Global**: 100 requests per 60-second window per IP. Applies to all routes.
- **Auth-specific**: 5 requests per 60-second window per IP. Applied to `/register` and `/login` only. Prevents brute force.

The algorithm is a **fixed window counter**:

1. `INCR rate:192.168.1.1` — increment the counter.
2. If this is the first request (`current === 1`), set a 60-second TTL.
3. If the counter exceeds the limit, reject.
4. The counter auto-expires when the window closes.

**If Redis is down**, the `catch` block calls `next()` — the request is allowed through. This is a deliberate choice: better to have no rate limiting than to block all traffic because Redis crashed.

### Validation Middleware (`packages/validation/src/middleware.ts`)

```typescript
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: { field: string; message: string }[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error));
      } else {
        req.body = result.data;  // Replace with parsed/validated data
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

    if (errors.length > 0) {
      return next(new ValidationError(errors));
    }

    next();
  };
}
```

Used in route definitions:

```typescript
router.post("/register",
  authRateLimiter,
  validate({ body: registerSchema }),
  controller.register
);

router.get("/:id",
  authenticate,
  validate({ params: userIdParamSchema }),
  controller.findById
);
```

Key behavior: **`req.body = result.data`**. Zod's `safeParse` returns the parsed data with defaults applied and types coerced. By replacing `req.body` with the validated data, downstream handlers get clean, typed data — no need to re-validate.

### Error Handler (`apps/api/src/middleware/errorHandler.ts`)

```typescript
export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError && err.isOperational) {
    if (err instanceof ValidationError) {
      return res.status(err.statusCode).json({
        success: false, message: err.message, data: null, errors: err.errors, meta: null,
      });
    }
    return res.status(err.statusCode).json({
      success: false, message: err.message, data: null, errors: null, meta: null,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(err);
    return res.status(prismaError.statusCode).json({
      success: false, message: prismaError.message, data: null, errors: null, meta: null,
    });
  }

  logger.error({ err }, "Unhandled server error");
  return res.status(500).json({
    success: false, message: "Internal server error", data: null, errors: null, meta: null,
  });
};
```

Three error categories:

1. **`AppError`** (operational): Known, expected errors (401, 403, 404, 409, 429). The `isOperational` flag distinguishes these from programming bugs. The error hierarchy:

```typescript
class AppError extends Error { statusCode, code, isOperational }
class ValidationError extends AppError { errors: ErrorDetail[] }
class AuthError extends AppError { statusCode: 401 }
class ForbiddenError extends AppError { statusCode: 403 }
class NotFoundError extends AppError { statusCode: 404 }
class ConflictError extends AppError { statusCode: 409 }
class RateLimitError extends AppError { statusCode: 429 }
class DatabaseError extends AppError { statusCode: 500, isOperational: false }
```

2. **Prisma errors**: Database-level errors mapped to HTTP status codes:
   - `P2002` (unique constraint) → 409 Conflict
   - `P2025` (record not found) → 404 Not Found
   - `P2003` (foreign key constraint) → 400 Bad Request

3. **Unhandled errors**: Programming bugs, network failures, etc. Logged with `logger.error` and returned as generic 500. Never leak stack traces to the client.

### Request Logger (`apps/api/src/middleware/requestLogger.ts`)

```typescript
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const reqId = crypto.randomUUID();
  const child = createChildLogger({ reqId });

  res.on("finish", () => {
    child.info({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    }, "HTTP request completed");
  });

  next();
};
```

Every request gets a unique `reqId`. The logger logs when the response finishes (`res.on("finish")`), including:
- Method + URL
- Status code
- Duration in milliseconds
- User agent and IP

The `reqId` is also available in downstream middleware via the child logger, allowing you to correlate logs across the request lifecycle.

## Common Mistakes / Gotchas

1. **Putting `errorHandler` before routes**: The error handler must be registered last. Express only calls error handlers (4-argument functions) when `next(error)` is called. If it's registered before routes, it won't catch route errors.

2. **Not calling `next(error)` in async route handlers**: If an async route handler throws, Express doesn't catch it (Express 4 doesn't support async error handling natively). You need a `try/catch` wrapper or use Express 5 (which Blink does — `express@5.1.0`).

3. **Rate limiting by IP behind a proxy**: If the app is behind a load balancer or reverse proxy, `req.ip` might be the proxy's IP, not the client's. Set `app.set('trust proxy', 1)` or configure the proxy to forward `X-Forwarded-For`.

4. **Leaking stack traces**: The error handler returns `"Internal server error"` for unhandled errors, never the stack trace. In development, the `logger.error` call includes the full error for debugging.

5. **Validation middleware replacing `req.body`**: This is intentional — it means downstream handlers get Zod-parsed, type-safe data. But it also means `req.body` after validation may have different types than the raw input (e.g., `page` is coerced from string to number).

## Try It Yourself

1. Add a new middleware that logs the `Authorization` header (redacted) for every authenticated request. Register it after `requestLogger` but before `globalRateLimiter`.
2. Add a custom error class `PaymentError` that extends `AppError` with `statusCode: 402` and `code: "PAYMENT_REQUIRED"`.
3. Create a test route that throws `new PaymentError("Subscription required")` and verify the error handler returns the correct JSON response.
4. Check the request logger output and verify your new middleware's log appears with the same `reqId`.
