import { z } from "zod";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string(),
  size: z.number().int().min(1).max(MAX_FILE_SIZE),
}).refine(
  (data) => {
    const allowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES, ...ALLOWED_DOC_TYPES];
    return allowed.includes(data.contentType);
  },
  { message: "File type not allowed" }
);

export const mediaUploadSchema = z.object({
  key: z.string().min(1),
  contentType: z.string(),
  size: z.number().int().min(1),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  duration: z.number().optional(),
});

export const mediaKeyParamSchema = z.object({
  key: z.string().min(1),
});
