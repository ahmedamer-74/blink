# Chapter 01: Monorepo Architecture

---

## What Problem Does This Solve?

When you have multiple related projects — a backend API, a frontend app, shared type definitions, shared utility code — you have two choices:

1. **Separate repos**: Each project lives in its own Git repo. You publish shared code as npm packages. Every change to shared code requires a version bump, publish, and dependency update across all consumers.

2. **Monorepo**: Everything lives in one Git repo. Shared code is imported directly via workspace links. No publishing, no version pinning, no "which version of @repo/types is each app using?"

Blink uses a monorepo. The question is: how do you manage it?

## How It Works in General

A JavaScript/TypeScript monorepo needs three things:

1. **Workspace declarations** — telling the package manager (Bun, npm, yarn, pnpm) which directories are packages.
2. **Inter-package references** — packages reference each other with `"workspace:*"` instead of version numbers.
3. **Task orchestration** — knowing that `web` depends on `types` being built first, so `turbo build` runs them in the right order.

**Turborepo** handles the third piece. It reads your task graph, figures out the correct build order via topological sorting (`^build` means "build my dependencies first"), caches outputs, and can share that cache across machines (Remote Caching).

## How We Do It Here

### The Root Workspace Config

`package.json` at the repo root declares two workspace globs:

```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

This tells Bun: "anything under `apps/` or `packages/` with its own `package.json` is a workspace package." Bun creates symlinks in `node_modules/` so that `import { prisma } from "@repo/database"` resolves to `packages/database/src/index.ts` — no publishing needed.

The root also defines the scripts that orchestrate the whole monorepo:

```json
"scripts": {
  "build": "turbo run build",
  "dev": "turbo run dev",
  "dev:api": "turbo run dev --filter=api",
  "dev:web": "turbo run dev --filter-web",
  "lint": "turbo run lint",
  "format": "prettier --write \"**/*.{ts,tsx,md}\"",
  "check-types": "turbo run check-types",
  "db:migrate": "turbo run db:migrate --filter=api",
  "db:seed": "turbo run db:seed --filter=api"
}
```

Note `--filter=api` — Turborepo lets you run tasks in a single package without affecting the others. `bun run dev:web` starts only the Next.js frontend.

### Turborepo Task Pipeline

`turbo.json` defines how tasks relate to each other:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "!.next/dev/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

Key decisions:

- **`"dependsOn": ["^build"]`** — The `^` prefix means "my workspace dependencies first." So when you run `turbo build`, Turborepo builds `@repo/types` and `@repo/auth` before building `api` and `web`, because those apps import from those packages.

- **`"dev": { "cache": false, "persistent": true }`** — Dev servers run forever and shouldn't be cached. `persistent: true` tells Turborepo not to wait for them to finish.

- **`"test": { "dependsOn": ["^build"] }`** — Tests need their dependencies built first (so TypeScript can resolve imports), but don't depend on the app's own build.

- **`outputs`** — Turborepo caches `dist/` and `.next/` folders. The `!.next/cache/**` exclusion means Next.js's own cache isn't shared (it's machine-specific).

### The Three Apps

| App | Path | Purpose | Port |
|---|---|---|---|
| `api` | `apps/api/` | Express REST + WebSocket server | 5000 |
| `web` | `apps/web/` | Next.js 16 frontend | 3000 |
| `docs` | `apps/docs/` | Documentation site (separate Next.js app) | — |

The `api` app depends on many packages (`@repo/auth`, `@repo/config`, `@repo/database`, `@repo/logger`, `@repo/types`, `@repo/utils`, `@repo/validation`, `@repo/websocket`). The `web` app depends on fewer (`@repo/types`, `@repo/validation`, `@repo/websocket`). This asymmetry is normal — the backend is where most of the logic lives.

### The Thirteen Packages

| Package | Path | What It Does |
|---|---|---|
| `@repo/auth` | `packages/auth/` | Password hashing (bcrypt) + JWT sign/verify |
| `@repo/config` | `packages/config/` | Zod-validated env vars (single source of truth) |
| `@repo/crypto` | `packages/crypto/` | E2EE: X3DH + Double Ratchet |
| `@repo/database` | `packages/database/` | Prisma client singleton + schema |
| `@repo/eslint-config` | `packages/eslint-config/` | Shared ESLint rules |
| `@repo/logger` | `packages/logger/` | pino logger with child loggers |
| `@repo/storage` | `packages/storage/` | S3/R2 client + presigned URLs |
| `@repo/types` | `packages/types/` | Shared TypeScript interfaces/enums |
| `@repo/typescript-config` | `packages/typescript-config/` | Shared tsconfig bases |
| `@repo/ui` | `packages/ui/` | Shared React UI components |
| `@repo/utils` | `packages/utils/` | Error classes + API response helpers |
| `@repo/validation` | `packages/validation/` | Zod schemas + Express middleware |
| `@repo/websocket` | `packages/websocket/` | WS event constants + protocol helpers |

**Why packages instead of putting everything in apps/api?**

The key rule: **if two apps need it, it lives in a package.** `@repo/types` is imported by both `api` and `web`. `@repo/validation` is used by `api` for request validation but the schemas could be shared with `web` for client-side validation too. `@repo/websocket` defines event types used by both the server (`apps/api/src/websocket/`) and the client (`apps/web/src/lib/websocket.ts`).

Even single-consumer packages have value: `@repo/auth` encapsulates all auth logic in one place. If you switch from bcrypt to Argon2id, you change one file in one package, not hunt through the entire API codebase.

### Package Dependency Graph

```
apps/api
  ├── @repo/auth ──────→ @repo/types
  ├── @repo/config
  ├── @repo/database
  ├── @repo/logger
  ├── @repo/types
  ├── @repo/utils ─────→ @repo/types
  ├── @repo/validation → @repo/utils, @repo/types
  └── @repo/websocket ─→ @repo/types

apps/web
  ├── @repo/types
  ├── @repo/validation
  └── @repo/websocket ─→ @repo/types
```

Notice the dependency direction: packages never depend on apps. Apps depend on packages. Packages depend on other packages. This creates a clean DAG (directed acyclic graph) that Turborepo can topologically sort.

### The `workspace:*` Protocol

When `packages/auth/package.json` says:

```json
"dependencies": {
  "@repo/types": "workspace:*"
}
```

The `workspace:*` tells Bun "resolve this to the local workspace package named `@repo/types`, whatever version it is." No semver, no publishing — just a symlink. This means:

- Changes to `@repo/types` are immediately visible to `@repo/auth` (no rebuild needed in development).
- In production builds, Turborepo builds packages in dependency order, so `types` is compiled before `auth`.
- The `"exports"` field in each package (`"exports": { ".": "./src/index.ts" }`) points directly to the source file, so TypeScript can resolve types without a separate build step.

## Common Mistakes / Gotchas

1. **Forgetting `^` in `dependsOn`**: If you write `"dependsOn": ["build"]` (without `^`), Turborepo waits for the *same task* in dependencies, not their build. This creates a circular dependency. The `^` is crucial.

2. **Importing from the wrong path**: Always import from the package root (`import { X } from "@repo/types"`), never from internal files (`import { X } from "@repo/types/src/auth"`). The `exports` field in `package.json` controls what's public.

3. **Adding a package without updating the workspace**: If you create a new directory under `packages/` but forget to give it a `package.json`, Bun won't recognize it as a workspace.

4. **Caching stale `.env` changes**: Turborepo caches based on input files. If you change `.env` but don't update `turbo.json` inputs, cached tasks won't re-run. The current config includes `.env*` in build inputs — good.

5. **Running `turbo build` when you only need one app**: Use `--filter` to save time. `turbo build --filter=web` only builds the web app and its dependencies.

## Try It Yourself

1. Add a new package called `@repo/feature-flags` at `packages/feature-flags/` with a simple `src/index.ts` that exports a `const FEATURE_X = true`.
2. Add `"@repo/feature-flags": "workspace:*"` to `apps/api/package.json`.
3. Run `bun install` from the root.
4. Import and log `FEATURE_X` in `apps/api/src/index.ts`.
5. Run `bun run dev:api` and verify it compiles and logs the value.

This exercises the full workspace resolution pipeline.
