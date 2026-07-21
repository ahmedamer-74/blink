import { z } from "zod";

export const addContactSchema = z.object({
  username: z.string().min(1).max(50),
});

export const contactIdParamSchema = z.object({
  id: z.string().uuid("Invalid contact ID"),
});

export const blockUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export const searchUsersSchema = z.object({
  q: z.string().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
