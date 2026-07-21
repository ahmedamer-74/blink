# Chapter 02: Database Schema

---

## What Problem Does This Solve?

Every message, user, room, and call needs to persist somewhere. Blink uses PostgreSQL — a battle-tested relational database — accessed through Prisma, a TypeScript-first ORM that generates type-safe client code from a schema definition.

The schema is the single source of truth for your data model. Every column, constraint, and relationship is declared once in `packages/database/prisma/schema.prisma` and Prisma generates the client, migrations, and type definitions from it.

## How It Works in General

Prisma's schema language (`schema.prisma`) defines:

- **Models** — become database tables. Each field becomes a column.
- **Relations** — foreign keys linking tables. Prisma infers the join queries.
- **Enums** — PostgreSQL enum types for constrained values.
- **Indexes** — performance hints for common query patterns.
- **`@map` / `@@map`** — let you use camelCase in code but snake_case in the database.

When you run `bunx prisma migrate dev`, Prisma compares your schema to the current database state and generates a SQL migration file. When you run `bunx prisma generate`, it creates the TypeScript client (`@prisma/client`) with full type safety.

## How We Do It Here

The entire schema lives in one file: `packages/database/prisma/schema.prisma`.

### The Generator and Datasource

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

This tells Prisma to generate a JavaScript client and connect to PostgreSQL using the `DATABASE_URL` environment variable. The URL format is `postgresql://user:password@host:5432/database`.

### Enums

```prisma
enum UserRole {
  USER
  ADMIN
  SUPERADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
```

These are PostgreSQL enums — the database enforces that `role` can only be one of these three values. `USER` is the default for new registrations. `SUPERADMIN` exists for future use (e.g., platform operators who can manage admins).

### User Model

```prisma
model User {
  id        String     @id @default(uuid()) @db.Uuid
  email     String     @unique
  username  String     @unique
  password  String
  avatar    String?
  role      UserRole   @default(USER)
  status    UserStatus @default(ACTIVE)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  messages        Message[]
  memberships     RoomMembership[]
  refreshTokens   RefreshToken[]
  keyBundle       UserKeyBundle?
  starredMessages StarredMessage[]
  statuses        Status[]
  statusViews     StatusView[]
  contacts        Contact[]       @relation("UserContacts")
  contactOf       Contact[]       @relation("ContactOf")
  blockedUsers    BlockedUser[]   @relation("BlockedBy")
  blockedBy       BlockedUser[]   @relation("Blocks")
  callsInitiated  Call[]
  callParticipants CallParticipant[]
  pushSubscriptions PushSubscription[]

  @@map("users")
}
```

Column-by-column:

| Column | Type | Why |
|---|---|---|
| `id` | `String @db.Uuid` | UUIDs are globally unique, non-sequential (can't guess the next user ID), and work across distributed systems. `@default(uuid())` generates a v4 UUID automatically. |
| `email` | `String @unique` | Login identifier. `@unique` creates a unique index — the database rejects duplicate emails. |
| `username` | `String @unique` | Display name. Also unique so users can be found by username. |
| `password` | `String` | bcrypt hash (not plaintext!). No length constraint because hashes are ~60 chars. |
| `avatar` | `String?` | Nullable — users may not upload an avatar. Stores the URL. |
| `role` | `UserRole` | Enum with default `USER`. Admin features check this. |
| `status` | `UserStatus` | `ACTIVE` by default. `SUSPENDED` for banned users. `INACTIVE` for soft-deleted. |
| `createdAt` | `DateTime @default(now())` | Set once when the user is created. `now()` is PostgreSQL's `NOW()` — the timestamp of the transaction. |
| `updatedAt` | `DateTime @updatedAt` | Automatically updated by Prisma on every `update()` call. |

The `@@map("users")` directive maps the model to a snake_case table name in PostgreSQL while keeping the TypeScript name as `User`.

**Relation fields** (lines 33-46) are virtual — they don't create columns. They tell Prisma how to traverse relationships: `user.messages` returns all messages by that user.

### Room Model

```prisma
model Room {
  id          String   @id @default(uuid()) @db.Uuid
  name        String?
  description String?
  avatarUrl   String?
  isPrivate   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  messages    Message[]
  memberships RoomMembership[]
  calls       Call[]

  @@map("rooms")
}
```

A Room is a conversation container. It can be:

- **1-on-1**: `isPrivate = true`, no `name`, exactly 2 members.
- **Group**: `isPrivate = false`, has a `name`, 3+ members.

The `name` and `description` are nullable because 1-on-1 chats don't need names — the display name is derived from the other member's username.

### RoomMembership (Join Table)

```prisma
model RoomMembership {
  id         String     @id @default(uuid()) @db.Uuid
  role       String     @default("member")  // "admin" | "member" | "owner"
  status     String     @default("accepted")
  mutedUntil DateTime?
  joinedAt   DateTime   @default(now())

  userId String @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  roomId String @db.Uuid
  room   Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@unique([userId, roomId])
  @@map("room_memberships")
}
```

This is the many-to-many join between Users and Rooms, enriched with:

- **`role`**: `"owner"` (created the room), `"admin"` (can manage members), `"member"` (default). Stored as a string rather than an enum for flexibility.
- **`status`**: `"accepted"` (normal member) or `"pending"` (invited but hasn't accepted yet). This enables the "chat request" flow — when user A starts a chat with user B, B gets a pending membership they can accept or reject.
- **`mutedUntil`**: Nullable timestamp for muting notifications. `null` means not muted.
- **`@@unique([userId, roomId])`**: A user can only have one membership per room. This prevents duplicate entries and enables Prisma's `findUnique` with a composite key: `prisma.roomMembership.findUnique({ where: { userId_roomId: { userId, roomId } } })`.

**`onDelete: Cascade`** on both foreign keys means: if a user is deleted, all their room memberships are deleted. If a room is deleted, all memberships are deleted.

### Message Model

```prisma
model Message {
  id                 String    @id @default(uuid()) @db.Uuid
  content            String
  type               String    @default("text")
  mediaUrl           String?
  mediaMeta          Json?
  editedAt           DateTime?
  deletedFor         String[]  @default([])
  deletedForEveryone Boolean   @default(false)
  systemMeta         Json?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  userId          String  @db.Uuid
  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  roomId          String  @db.Uuid
  room            Room    @relation(fields: [roomId], references: [id], onDelete: Cascade)
  replyToMessageId String? @db.Uuid
  replyToMessage  Message? @relation("MessageReplies", fields: [replyToMessageId], references: [id])
  replies         Message[] @relation("MessageReplies")
  forwardedFromId String? @db.Uuid
  forwardedFrom   Message? @relation("MessageForwards", fields: [forwardedFromId], references: [id])
  forwards        Message[] @relation("MessageForwards")
  starredBy       StarredMessage[]

  @@index([roomId, createdAt])
  @@map("messages")
}
```

Key design decisions:

- **`type`**: `"text" | "image" | "video" | "document" | "audio" | "system"`. Stored as a string, not an enum, because it's used in the WebSocket protocol and string comparison is simpler.
- **`mediaMeta`**: A `Json` column holding `{ size, mimeType, duration, width, height, thumbnailUrl }`. Json is used because the shape varies by media type and we don't need to query individual fields.
- **`deletedFor`**: A PostgreSQL `String[]` array (not a separate table). Each entry is a user ID. This is efficient for "delete for me" — you just append the user's ID to the array. No join needed.
- **`deletedForEveryone`**: Boolean flag. When true, the content is replaced with "This message has been deleted" and this flag is checked on the client.
- **Self-referencing relations**: `replyToMessageId` and `forwardedFromId` point back to the same `Message` table. This creates threaded replies and forwarding chains.
- **`@@index([roomId, createdAt])`**: The most common query is "get messages in a room, sorted by time." This composite index makes that query fast.

### RefreshToken Model

```prisma
model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  token     String   @unique
  createdAt DateTime @default(now())
  expiresAt DateTime

  userId String @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

Refresh tokens are stored server-side (not just in cookies) so they can be revoked. The `token` column stores the raw JWT string. `@@index([userId])` speeds up "delete all tokens for user" (logout) and "find tokens for user" (session management).

### UserKeyBundle (E2EE)

```prisma
model UserKeyBundle {
  id              String   @id @default(uuid()) @db.Uuid
  identityKey     String
  signedPreKey    String
  signedPreKeySig String
  oneTimePreKeys  Json
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  userId String @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@map("user_key_bundles")
}
```

This stores a user's Signal Protocol key bundle for end-to-end encryption. Each field is a base64-encoded public key. `oneTimePreKeys` is a JSON array because the count varies. `@@unique([userId])` ensures one bundle per user.

See [Chapter 07: E2EE Crypto](07-e2ee-crypto.md) for how these keys are used.

### Remaining Models (Quick Reference)

| Model | Table | Purpose |
|---|---|---|
| `StarredMessage` | `starred_messages` | Join table: user starred a message. Unique on `(userId, messageId)`. |
| `PushSubscription` | `push_subscriptions` | Web Push (VAPID) subscription for browser notifications. Unique on `endpoint`. |
| `Status` | `statuses` | WhatsApp-style stories. Expires after 24h. Indexed on `[userId, createdAt]` and `[expiresAt]`. |
| `StatusView` | `status_views` | Tracks who viewed a status. Unique on `(statusId, viewerId)`. |
| `Contact` | `contacts` | User's contact list. Self-referencing many-to-many via `UserContacts`/`ContactOf` relations. |
| `BlockedUser` | `blocked_users` | Blocking relationship. Self-referencing via `BlockedBy`/`Blocks` relations. |
| `Call` | `calls` | Voice/video call record. Links to Room and initiator User. |
| `CallParticipant` | `call_participants` | Who joined a call. Tracks join/leave times. |

### ASCII ER Diagram

```
┌──────────┐     ┌────────────────┐     ┌──────────┐
│   User   │────<│ RoomMembership │>────│   Room   │
└──────────┘     └────────────────┘     └──────────┘
     │                                         │
     │    ┌──────────────┐                     │
     ├───<│   Message    │>────────────────────┘
     │    └──────────────┘
     │         │    │
     │         │    └── replyToMessage (self-ref)
     │         └────── forwardedFrom (self-ref)
     │
     ├───< RefreshToken
     ├───< StarredMessage >── Message
     ├───< UserKeyBundle (1:1)
     ├───< PushSubscription
     ├───< Status >── StatusView >── User
     ├───< Contact >── User (self-ref)
     ├───< BlockedUser >── User (self-ref)
     ├───< Call >── Room
     └───< CallParticipant >── Call
```

`<` means "has many" (one-to-many). `>────` means "belongs to" (many-to-one).

## Common Mistakes / Gotchas

1. **Using `@default(cuid())` instead of `@default(uuid())`**: CUIDs are sortable by time but are strings, not native UUIDs. We chose UUIDs for native PostgreSQL `uuid` type support and compatibility with JWT claims (`jti`).

2. **Forgetting `onDelete: Cascade`**: If you add a new relation without `Cascade`, deleting a user will fail with a foreign key constraint error because the database won't know what to do with orphaned rows.

3. **Querying `deletedFor` array inefficiently**: `where: { deletedFor: { has: userId } }` is correct. Don't fetch all messages and filter in JavaScript — PostgreSQL array queries are indexed and fast.

4. **Not running migrations after schema changes**: Prisma won't apply schema changes until you run `bunx prisma migrate dev`. The generated client reflects the schema, not the database — you'll get runtime errors if they're out of sync.

5. **Using `Json` for queryable data**: If you need to filter or sort by a field inside `mediaMeta`, Json won't help. That's why structured fields like `type`, `userId`, and `roomId` are regular columns — they need to be queried.

## Try It Yourself

1. Add a `lastSeenAt DateTime?` field to the `User` model (for "last online" tracking).
2. Run `bunx prisma migrate dev --name add-last-seen`.
3. Update the `PresenceManager` in `apps/api/src/websocket/ws.presence.ts` to write `lastSeenAt` when a user connects.
4. Verify the migration SQL looks correct in `packages/database/prisma/migrations/`.
