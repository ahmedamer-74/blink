# Chapter 06: Media Uploads

---

## What Problem Does This Solve?

Users want to share images, videos, documents, and audio files in chat. Storing files on the application server is problematic: it doesn't scale (the server has limited disk), backups become huge, and serving files directly from Express is slow.

Blink offloads file storage to **Cloudflare R2** — an S3-compatible object storage service. The flow: the client asks the server for a presigned upload URL, uploads directly to R2, and sends the file's URL in the chat message. No file bytes touch the application server.

## How It Works in General

### Presigned URLs

S3-compatible storage (AWS S3, Cloudflare R2, MinIO) supports **presigned URLs**: a time-limited, signed URL that grants temporary upload or download permission to a specific object.

The flow:

1. Client asks server: "I want to upload a 5MB image."
2. Server generates a unique key (e.g., `media/user123/1700000000-abc.jpg`).
3. Server creates a presigned PUT URL for that key (valid for 1 hour).
4. Client uploads directly to R2 using the presigned URL (no auth needed — the URL itself is the auth).
5. Client sends the public URL of the uploaded file in the chat message.

**Why not upload through the server?** The server would need to buffer the entire file in memory, write it to disk, then upload to R2. With presigned URLs, the client uploads directly — the server only handles metadata.

## How We Do It Here

### Storage Client (`packages/storage/src/client.ts`)

```typescript
import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function initStorage(storageConfig: StorageConfig): void {
  config = storageConfig;
  client = new S3Client({
    region: "auto",
    endpoint: storageConfig.endpoint || `https://${storageConfig.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
    },
  });
}

export function getStorageClient(): S3Client {
  if (!client) throw new Error("Storage not initialized. Call initStorage() first.");
  return client;
}
```

- **`region: "auto"`**: R2 doesn't use AWS regions — `"auto"` is the R2 convention.
- **`endpoint`**: Falls back to the standard R2 endpoint format. Can be overridden for local testing with MinIO.
- **Lazy initialization**: `initStorage()` must be called once at startup. `getStorageClient()` returns the singleton.

### Presigned URL Generation (`packages/storage/src/presign.ts`)

```typescript
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600,
): Promise<PresignResult> {
  const client = getStorageClient();
  const config = getStorageConfig();

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  const publicUrl = `${config.publicUrl}/${key}`;

  return { uploadUrl, publicUrl, key };
}
```

- **`PutObjectCommand`**: Tells S3/R2 this is an upload (PUT) operation.
- **`ContentType`**: Included in the signature so the client must upload with the correct content type. Prevents uploading an EXE as an image.
- **`expiresIn: 3600`**: The presigned URL is valid for 1 hour.
- **`publicUrl`**: The permanent URL to access the file after upload. R2 public buckets expose files at `<publicUrl>/<key>`.

### Media Key Generation

```typescript
export function generateMediaKey(
  userId: string,
  filename: string,
  prefix: string = "media"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.split(".").pop() || "bin";
  return `${prefix}/${userId}/${timestamp}-${random}.${ext}`;
}
```

Keys follow the pattern: `media/<userId>/<timestamp>-<random>.<ext>`. This ensures:
- **No collisions**: timestamp + random string.
- **Organized by user**: Easy to list/delete all files for a user.
- **Preserves extension**: Browsers need the extension to serve the correct MIME type.

### File Validation (`packages/validation/src/schemas/media.ts`)

```typescript
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
```

Validation happens **before** generating the presigned URL. The server rejects invalid files before any storage operation. The 50MB limit is enforced both by Zod validation and by the presigned URL's `Content-Length` header.

### Integration Status

**Implemented**: The `packages/storage/` package, validation schemas, and the `UserKeyBundle` model for E2EE keys.

**Not yet wired**: The actual upload endpoints in `apps/api/` and the upload UI in `apps/web/`. The message type system (`type: "image" | "video" | "document" | "audio"`) and `mediaUrl`/`mediaMeta` fields in the Message model are ready to receive uploaded files, but the upload flow (presign endpoint → client upload → send media message) is not yet connected.

**Planned**: 
- A `POST /api/v1/media/presign` endpoint that generates upload URLs.
- A `MediaUploader` component that handles client-side upload.
- Integration with `MessageInput` to support file attachments.
- Image thumbnail generation and video transcoding (likely via Cloudflare Workers).

### How It Will Work (When Complete)

```
1. User clicks attachment icon in MessageInput
2. Browser opens file picker → user selects image.jpg (2.3MB)
3. Client POSTs to /api/v1/media/presign { filename: "image.jpg", contentType: "image/jpeg", size: 2300000 }
4. Server validates → generates key "media/user123/1700000000-abc123.jpg" → returns presigned URL + public URL
5. Client PUTs the file directly to R2 using the presigned URL
6. Client sends WebSocket message: message:send { roomId, content: "", type: "image", mediaUrl: "https://pub-xxx.r2.dev/media/user123/1700000000-abc123.jpg", mediaMeta: { size: 2300000, mimeType: "image/jpeg" } }
7. Server persists to database, broadcasts message:new to room
```

## Common Mistakes / Gotchas

1. **Uploading through the server**: Don't proxy file uploads through Express. It wastes server memory and bandwidth. Always use presigned URLs.

2. **Not validating content type**: The client can lie about the content type. The presigned URL should include `ContentType` in the signature so R2 rejects mismatches.

3. **Using predictable file names**: `uploads/user123/profile.jpg` can be overwritten by anyone. The timestamp + random string pattern prevents this.

4. **Forgetting CORS on R2**: If the client uploads directly to R2, the R2 bucket must have CORS configured to allow the frontend origin. Cloudflare R2 dashboard → Settings → CORS.

5. **Not setting `maxAge` on presigned URLs**: Long-lived presigned URLs are a security risk. 1 hour (3600s) is a reasonable default.

## Try It Yourself

1. Set up a Cloudflare R2 bucket (free tier: 10GB storage, 10M reads/month).
2. Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` to your `.env`.
3. Create a simple test script that calls `initStorage()` and `getPresignedUploadUrl()`.
4. Use `curl` to PUT a file to the presigned URL.
5. Verify the file is accessible at the public URL.
