import { z } from "zod";

export const messageTypeEnum = z.enum(["text", "image", "video", "document", "audio", "system"]);

export const sendMessageSchema = z.object({
  roomId: z.string().uuid("Invalid room ID"),
  content: z.string().min(1).max(10000),
  type: messageTypeEnum.default("text"),
  replyToMessageId: z.string().uuid().optional(),
  forwardedFromId: z.string().uuid().optional(),
  mediaUrl: z.string().url().optional(),
  mediaMeta: z
    .object({
      size: z.number().optional(),
      mimeType: z.string().optional(),
      duration: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      thumbnailUrl: z.string().url().optional(),
    })
    .optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const deleteMessageSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
  deleteForEveryone: z.boolean().default(false),
});

export const forwardMessageSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
  targetRoomIds: z.array(z.string().uuid()).min(1).max(10),
});

export const starMessageSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
});

export const searchMessagesSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const messageIdParamSchema = z.object({
  id: z.string().uuid("Invalid message ID"),
});

export const messageRoomIdParamSchema = z.object({
  roomId: z.string().uuid("Invalid room ID"),
});
