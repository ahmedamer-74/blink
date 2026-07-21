import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100).optional().nullable(),
  isPrivate: z.boolean().default(false),
  memberIds: z.array(z.string().uuid()).optional(),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

export const roomIdParamSchema = z.object({
  id: z.string().uuid("Invalid room ID"),
});

export const addMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(256),
});

export const muteRoomSchema = z.object({
  mutedUntil: z.string().datetime().nullable(),
});
