# Chapter 03: Authentication

---

## What Problem Does This Solve?

Users need to prove who they are. The system needs to remember that they've proven it, without making them re-enter their password on every request. And if someone steals a credential, the damage should be limited.

Blink's auth system solves three problems:

1. **Password storage** — Never store plaintext. Hash passwords so even a database breach doesn't expose them.
2. **Stateless API authorization** — Use JWTs so the API doesn't need to hit the database on every request.
3. **Session management** — Use refresh tokens to issue short-lived access tokens without requiring re-login.

## How It Works in General

### Password Hashing

When a user registers, their password goes through a one-way hash function (bcrypt) with a random salt. The hash is stored; the plaintext is discarded. When they log in, the submitted password is hashed again with the same salt, and the hashes are compared. If they match, the password was correct.

bcrypt is chosen over alternatives like Argon2id because it's battle-tested, widely available as a native C library, and resistant to GPU-based brute force attacks. The `SALT_ROUNDS` parameter (12) controls how slow hashing is — higher = slower = harder to brute force, but also slower for legitimate logins.

### JWT Access + Refresh Token Pair

A **JSON Web Token (JWT)** is a self-contained credential: it encodes a payload (user ID, role, expiry) and a signature. The API verifies the signature to trust the payload without hitting the database.

The problem: JWTs can't be revoked (they're stateless). If you make them short-lived (15 minutes), users re-login constantly. If you make them long-lived (7 days), a stolen token grants access for 7 days.

**Solution**: Issue two tokens:

- **Access token** (15 minutes): Used for API requests. Lives in memory on the client. If stolen, expires quickly.
- **Refresh token** (7 days): Used only to get new access tokens. Stored in an httpOnly cookie (not accessible to JavaScript). Can be revoked server-side.

### Refresh Token Rotation

When the client uses a refresh token, the server:

1. Verifies it exists in the database (not revoked).
2. Deletes the old token.
3. Issues a new access + refresh token pair.
4. Stores the new refresh token.

This means each refresh token is single-use. If an attacker steals a refresh token and uses it, the legitimate user's next refresh will fail (the token was already used), signaling a breach. The server can then revoke the entire token family.

## How We Do It Here

The auth implementation spans four files across two packages and one app:

### Step 1: Password Hashing (`packages/auth/src/password.ts`)

```typescript
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
```

- **`SALT_ROUNDS = 12`**: bcrypt generates a random salt and hashes the password 2^12 = 4096 times. This takes ~250ms on modern hardware — slow enough to frustrate brute force, fast enough for login.
- **`bcrypt.hash()`**: Generates a random salt, hashes the password, and returns a string like `$2b$12$LJ3m4ys3Lg.KhX9U9Z.0J.ZxQv3HbZb5pK5X5Y5Z5X5Y5Z5X`. The salt is embedded in the hash string, so `compare` extracts it automatically.
- **`bcrypt.compare()`**: Extracts the salt from the stored hash, hashes the plaintext with it, and compares. Returns `true`/`false`. Timing-safe comparison prevents timing attacks.

### Step 2: JWT Signing & Verification (`packages/auth/src/jwt.ts`)

```typescript
import jwt from 'jsonwebtoken'
import type { JWTPayload, RefreshTokenPayload, TokenConfig } from '@repo/types'

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
    expiresIn: cfg.accessTokenExpiry,
    issuer: cfg.issuer,
    audience: cfg.audience,
  })
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
  const cfg = getTokenConfig()
  return jwt.sign(payload, cfg.refreshTokenSecret, {
    expiresIn: cfg.refreshTokenExpiry,
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
```

Key design decisions:

- **Two separate secrets**: `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`. If one is compromised, the other is safe. An attacker with the access token secret can forge access tokens but can't create refresh tokens (and vice versa).
- **`issuer` and `audience`**: JWT validation checks these claims. `issuer: "blink"` means "this token was issued by Blink." `audience: "blink-client"` means "this token is intended for Blink's frontend." This prevents tokens from one app being used in another.
- **`expiresIn`**: Access tokens expire in 15 minutes (`'15m'`), refresh tokens in 7 days (`'7d'`). The `jsonwebtoken` library adds `iat` (issued at) and `exp` (expiry) claims automatically.
- **Type safety**: The `Omit<JWTPayload, 'iat' | 'exp'>` type ensures callers don't manually set these — they're auto-generated.

### Step 3: Token Pair Generation (`packages/auth/src/tokens.ts`)

```typescript
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
  const decoded = JSON.parse(
    Buffer.from(token.split(".")[1], "base64").toString(),
  );
  return decoded.jti as string;
}
```

- **`jti` (JWT ID)**: A UUID v4 generated once per token pair. Both the access and refresh token share the same `jti`. This links them together — if you revoke a refresh token by its `jti`, you can also invalidate the corresponding access token.
- **`sub` (Subject)**: The user's ID. This is the standard JWT claim for "who this token belongs to."
- **`type: "refresh"`**: Distinguishes refresh tokens from access tokens in the payload.

### Step 4: The Auth Service (`apps/api/src/modules/auth/auth.service.ts`)

This is where everything comes together. Here's the **login flow**:

```typescript
async login(input: LoginInput): Promise<AuthResponse> {
  const user = await this.repo.findUserByEmail(input.email);
  if (!user) {
    throw new AuthError("Invalid email or password");
  }

  const isValid = await comparePassword(input.password, user.password);
  if (!isValid) {
    throw new AuthError("Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("Account is not active");
  }

  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await this.repo.storeRefreshToken(tokens.refreshToken, user.id, expiresAt);

  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}
```

Walkthrough:

1. **Find user by email** — `findUserByEmail` queries the `users` table.
2. **Verify password** — `comparePassword` hashes the submitted password and compares.
3. **Check account status** — Suspended users can't log in.
4. **Generate tokens** — Creates the access + refresh pair.
5. **Store refresh token** — Saves the raw JWT in the `refresh_tokens` table with a 7-day expiry.
6. **Return** — The user object (no password!), both tokens.

The **refresh token rotation** is equally important:

```typescript
async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const stored = await this.repo.findRefreshToken(refreshToken);
  if (!stored) {
    throw new AuthError("Invalid refresh token");
  }

  await this.repo.deleteRefreshToken(refreshToken);

  const payload = JSON.parse(
    Buffer.from(refreshToken.split(".")[1], "base64").toString(),
  );

  const user = await this.repo.findUserById(payload.sub);
  if (!user) {
    throw new AuthError("User not found");
  }

  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await this.repo.storeRefreshToken(tokens.refreshToken, user.id, expiresAt);

  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}
```

Walkthrough:

1. **Validate** — Check the token exists in the database (not revoked).
2. **Delete the old token** — Single-use. If the same token is used again, step 1 fails → revocation detected.
3. **Decode the user ID** — Extract `sub` from the JWT payload (base64-decode the second segment).
4. **Issue new pair** — Fresh access + refresh tokens.
5. **Store new refresh token** — The cycle continues.

### Step 5: The Auth Controller (`apps/api/src/modules/auth/auth.controller.ts`)

```typescript
login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.login(req.body);
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
      success: true,
      message: "Login successful",
      data: result,
      errors: null,
      meta: null,
    });
  } catch (error) {
    next(error);
  }
};
```

The cookie options are critical:

- **`httpOnly: true`**: JavaScript cannot access this cookie. Prevents XSS attacks from stealing the refresh token.
- **`secure: true`** (in production): Only sent over HTTPS.
- **`sameSite: "strict"`**: Not sent with cross-site requests. Prevents CSRF attacks.
- **`maxAge: 7 * 24 * 60 * 60 * 1000`**: 7 days in milliseconds. Matches the token expiry.

The access token is **not** in the cookie — it's in the JSON response body and stored in React state (in-memory) on the client. This is intentional: the access token is short-lived (15 min) and if XSS steals it, the attacker only has 15 minutes.

### Step 6: The Full Login Flow (Cross-File Trace)

Here's the complete sequence from user click to authenticated state:

**1. User submits the login form**
- File: `apps/web/src/components/auth/login-form.tsx`
- The `<form action={formAction}>` uses React's `useActionState` to call the Server Action.

**2. Server Action calls the API**
- File: `apps/web/src/lib/actions/auth.ts` — `loginAction()`
- Runs on the Next.js server (not the browser). Calls `http://localhost:5000/api/v1/auth/login` with credentials.

**3. The API proxy forwards the request**
- File: `apps/web/next.config.ts`
- Next.js rewrites `/api/:path*` to `http://localhost:5000/api/:path*`, so the browser's fetch goes through Next.js's server.

**4. Express route handler receives the request**
- File: `apps/api/src/modules/auth/auth.routes.ts`
- `router.post("/login", authRateLimiter, validate({ body: loginSchema }), controller.login)`
- Rate limit → Zod validation → controller.

**5. Controller calls the service**
- File: `apps/api/src/modules/auth/auth.controller.ts`
- `service.login(req.body)` → returns tokens + user.

**6. Controller sets cookie and returns JSON**
- `res.cookie("refreshToken", ...)` — httpOnly cookie.
- `res.json({ data: { accessToken, refreshToken, user } })`.

**7. Server Action forwards the cookie**
- File: `apps/web/src/lib/actions/auth.ts` — `forwardCookie()`
- Extracts the `Set-Cookie` header from the API response and sets it on the Next.js server's cookie store. This is necessary because Server Actions run on the server, not in the browser — the browser doesn't see the API's Set-Cookie directly.

**8. Server Action returns the access token to the client**
- `return { success: true, accessToken: json.data!.accessToken, user: json.data!.user }`

**9. LoginForm updates auth state**
- File: `apps/web/src/components/auth/login-form.tsx`
- `setAuth(state.user, state.accessToken)` — stores user + access token in React context.

**10. AuthProvider provides auth state to the app**
- File: `apps/web/src/lib/auth-context.tsx`
- `useAuth()` returns `{ user, accessToken, isAuthenticated }` — used throughout the app.

### Step 7: The Auth Middleware (`apps/api/src/middleware/authenticate.ts`)

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

This middleware runs on protected routes. It:
1. Checks for a `Bearer <token>` header.
2. Verifies the JWT signature and expiry.
3. Attaches the user payload to `req.user` for downstream handlers.
4. Calls `next()` or passes an error.

### Step 8: Hydration on Page Load

When the user refreshes the browser, React state is lost. The `AuthProvider` re-hydrates:

```typescript
// apps/web/src/lib/auth-context.tsx
useEffect(() => {
  hydrateAuth().then((result) => {
    if (result) {
      setUser(result.user);
      setAccessToken(result.accessToken);
    }
    setIsLoading(false);
  });
}, []);
```

`hydrateAuth()` (in `apps/web/src/lib/actions/auth.ts`) reads the refresh token from the cookie, calls the refresh endpoint to get a new access token, then fetches `/api/v1/users/me` to get the user profile.

## Common Mistakes / Gotchas

1. **Storing the access token in localStorage**: localStorage persists across tabs and is accessible to any JavaScript on the page. If XSS is possible, the attacker gets the token. Blink stores it in React state (memory only) — it's gone when the tab closes.

2. **Not revoking refresh tokens on logout**: `auth.service.ts` has `deleteUserRefreshTokens(userId)` which removes all refresh tokens for the user. Without this, a stolen refresh token remains valid even after the user "logs out."

3. **Using the same secret for access and refresh tokens**: If an attacker gets the access token secret, they can forge refresh tokens and get permanent access. Blink uses separate secrets.

4. **Forgetting `sameSite: "strict"` on cookies**: Without this, cross-site requests include the cookie, enabling CSRF attacks where a malicious site makes requests on behalf of the logged-in user.

5. **Decoding JWTs without verification**: The `extractJTI` function in `tokens.ts` does a raw base64 decode without verifying the signature. This is safe for extracting claims you don't trust for security decisions, but never use decoded values for authorization without calling `verifyAccessToken` first.

## Try It Yourself

1. Register a new user via the API: `POST /api/v1/auth/register` with `{ "email": "test@test.com", "username": "testuser", "password": "password123" }`.
2. Observe the response: you get `accessToken` and `refreshToken`.
3. Use the access token: `GET /api/v1/users/me` with header `Authorization: Bearer <accessToken>`.
4. Wait 15 minutes (or change `ACCESS_TOKEN_EXPIRY` to `"10s"` and restart).
5. Try the same request — it fails with 401.
6. Use the refresh token: `POST /api/v1/auth/refresh` with `{ "refreshToken": "<your-refresh-token>" }`.
7. Get a new access token and try `/api/v1/users/me` again.
8. Try using the old refresh token — it fails (rotation: single-use).
