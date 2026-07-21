import { z } from "zod";

export const statusTypeEnum = z.enum(["text", "image", "video"]);

export const createStatusSchema = z.object({
  type: statusTypeEnum,
  content: z.string().max(700).optional(), // for text statuses
  mediaUrl: z.string().url().optional(),
  caption: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.type === "text") return !!data.content;
    return !!data.mediaUrl;
  },
  { message: "Text statuses require content, media statuses require mediaUrl" }
);

export const statusIdParamSchema = z.object({
  id: z.string().uuid("Invalid status ID"),
});
