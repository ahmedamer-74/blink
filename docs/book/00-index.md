# Blink: Internal Documentation Book

> A teaching resource for future-you relearning this codebase. Every concept is explained from first principles, then grounded in the actual code.

---

## What Is Blink?

Blink is a real-time messaging application — think WhatsApp or Telegram, but self-hosted. It supports 1-on-1 and group conversations, typing indicators, message editing/deletion, star/forward, voice/video calling (scaffolded), statuses (stories), contacts, blocking, and end-to-end encryption (scaffolded).

## How to Read This Book

Start at Chapter 01 and read sequentially. Each chapter builds on the previous ones. Cross-references link related concepts (e.g., the auth chapter links to the WebSocket chapter where the same JWT is verified).

Every code block is copied from a real file in this repo — nothing is fabricated. If a feature is scaffolded but not fully wired, the chapter says so explicitly.

## Tech Stack at a Glance

| Layer | Technology |
|---|---|
| Package manager | Bun 1.3 |
| Monorepo orchestrator | Turborepo |
| Backend runtime | Node.js + Express 5 |
| Frontend framework | Next.js 16 + React 19 |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache / presence | Redis 7 (ioredis) |
| WebSocket | Native `ws` library |
| Auth | bcrypt + JWT (access + refresh tokens) |
| Validation | Zod |
| Logging | pino (pino-pretty in dev) |
| Object storage | Cloudflare R2 (S3-compatible) |
| UI components | Radix UI + Tailwind CSS v4 |
| E2EE | X3DH + Double Ratchet (`@noble/curves`) |

## Directory Map

```
blink/
├── apps/
│   ├── api/          Express REST + WebSocket server (port 5000)
│   ├── web/          Next.js frontend (port 3000)
│   └── docs/         Documentation site (Next.js)
├── packages/
│   ├── auth/         Password hashing (bcrypt) + JWT signing/verification
│   ├── config/       Zod-validated environment variables
│   ├── crypto/       E2EE: X3DH key agreement + Double Ratchet
│   ├── database/     Prisma client singleton + schema
│   ├── eslint-config Shared ESLint config
│   ├── logger/       pino logger with child logger support
│   ├── storage/      S3/R2 client + presigned URL generation
│   ├── types/        Shared TypeScript types (API, auth, WS, user)
│   ├── typescript-config Shared tsconfig bases
│   ├── ui/           Shared React UI components (Radix-based)
│   ├── utils/        Error classes + API response helpers
│   ├── validation/   Zod schemas + Express validation middleware
│   └── websocket/    WS event constants + protocol helpers
├── turbo.json        Turborepo task pipeline
├── package.json      Root workspace config (Bun)
└── docker-compose.yml (in apps/api/)  PostgreSQL + Redis
```

## Chapter Index

| # | Chapter | What It Covers |
|---|---|---|
| 01 | [Monorepo Architecture](01-monorepo-architecture.md) | Turborepo, workspaces, package graph |
| 02 | [Database Schema](02-database-schema.md) | All 14 Prisma models, relationships, design decisions |
| 03 | [Authentication](03-authentication.md) | bcrypt, JWT, refresh token rotation, login flow |
| 04 | [WebSocket & Realtime](04-websocket-realtime.md) | WS server, rooms, events, heartbeat, reconnection |
| 05 | [Frontend (Next.js)](05-frontend-nextjs.md) | Server Actions, providers, auth context, conversation hook |
| 06 | [Media Uploads](06-media-uploads.md) | R2 storage, presigned URLs, file validation |
| 07 | [E2EE Crypto](07-e2ee-crypto.md) | Signal Protocol: X3DH + Double Ratchet |
| 08 | [API Middleware](08-api-middleware.md) | Auth, rate limiting, error handling, validation |

## Environment Setup

The fastest way to get running:

```sh
# Clone and install
bun install

# Start infrastructure
docker compose -f apps/api/docker-compose.yml up -d

# Set up database
cp apps/api/.env.example apps/api/.env  # fill in secrets
bun run db:migrate
bun run db:seed

# Start dev servers
bun run dev          # both api + web
# or individually:
bun run dev:api      # API on :5000
bun run dev:web      # Web on :3000
```
