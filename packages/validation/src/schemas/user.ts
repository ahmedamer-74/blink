import { z } from "zod";

export const updateUserSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  avatar: z.string().url().optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
});
