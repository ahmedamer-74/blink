-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deletedFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "deletedForEveryone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "forwardedFromId" UUID,
ADD COLUMN     "mediaMeta" JSONB,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "replyToMessageId" UUID,
ADD COLUMN     "systemMeta" JSONB;

-- AlterTable
ALTER TABLE "room_memberships" ADD COLUMN     "mutedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "starred_messages" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "messageId" UUID NOT NULL,

    CONSTRAINT "starred_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_key_bundles" (
    "id" UUID NOT NULL,
    "identityKey" TEXT NOT NULL,
    "signedPreKey" TEXT NOT NULL,
    "signedPreKeySig" TEXT NOT NULL,
    "oneTimePreKeys" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "user_key_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statuses" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "mediaUrl" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_views" (
    "id" UUID NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusId" UUID NOT NULL,
    "viewerId" UUID NOT NULL,

    CONSTRAINT "status_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "contactId" UUID NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_users" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "conversationId" UUID NOT NULL,
    "initiatorId" UUID NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_participants" (
    "id" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "callId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "starred_messages_userId_messageId_key" ON "starred_messages"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "user_key_bundles_userId_key" ON "user_key_bundles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "statuses_userId_createdAt_idx" ON "statuses"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "statuses_expiresAt_idx" ON "statuses"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "status_views_statusId_viewerId_key" ON "status_views"("statusId", "viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_userId_contactId_key" ON "contacts"("userId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_users_userId_blockedId_key" ON "blocked_users"("userId", "blockedId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_forwardedFromId_fkey" FOREIGN KEY ("forwardedFromId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "starred_messages" ADD CONSTRAINT "starred_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "starred_messages" ADD CONSTRAINT "starred_messages_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_key_bundles" ADD CONSTRAINT "user_key_bundles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_views" ADD CONSTRAINT "status_views_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_views" ADD CONSTRAINT "status_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
