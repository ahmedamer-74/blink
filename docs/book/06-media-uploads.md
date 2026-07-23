# Chapter 06: Media Uploads

---

## What Problem Does This Solve?

Users want to share images, videos, documents, and audio files in chat. Storing files on the application server is problematic: it doesn't scale (the server has limited disk), backups become huge, and serving files directly from Express is slow.

Blink offloads file storage to **Cloudinary** — a cloud-based media management service. Files upload directly from the browser to Cloudinary using an **unsigned upload preset**, so no file bytes ever touch the application server.

## How It Works

### Unsigned Uploads

Cloudinary supports **unsigned uploads** via upload presets. An upload preset is configured in the Cloudinary dashboard with a name (e.g., `blink-monorepo`) and stores settings like allowed formats, folder, and transformations. The client sends the preset name along with the file — no server-side signature needed.

The flow:

1. User clicks the attachment icon in `MessageInput`.
2. Browser opens a file picker → user selects a file.
3. Client uploads directly to `https://api.cloudinary.com/v1_1/{cloudName}/auto/upload` with `upload_preset=blink-monorepo`.
4. Cloudinary returns `{ secure_url, public_id, bytes, width, height, ... }`.
5. Client sends a WebSocket message with `type`, `mediaUrl`, and `mediaMeta`.
6. Server persists to database and broadcasts to the room.

**Why unsigned?** No API secret is needed on the client or server. Cloudinary enforces the preset's rules (allowed types, folder, transformations) on their side. This is simpler than signed uploads and avoids exposing any secrets.

### Configuration

**Frontend env** (`apps/web/.env.local`):
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dxmsfmdvt
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=blink-monorepo
```

**Cloudinary dashboard** — Upload preset settings:
- Preset name: `blink-monorepo`
- Signing mode: **Unsigned**
- Folder: (optional) e.g., `blink` — organizes all uploads under a prefix
- Allowed formats: images, video, audio, raw (documents)

### Upload Flow (`apps/web/src/lib/api.ts`)

```typescript
export async function uploadToCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("resource_type", "auto");

  // POST to https://api.cloudinary.com/v1_1/{cloudName}/auto/upload
  // Uses XHR for progress tracking
}
```

- **`resource_type: "auto"`**: Cloudinary detects whether the file is image, video, or raw.
- **XHR with progress**: Uses `XMLHttpRequest` to get upload progress via `xhr.upload.onprogress`.
- **Direct to Cloudinary**: File bytes go straight from the browser to Cloudinary.

### Upload Hook (`apps/web/src/hooks/use-media-upload.ts`)

```typescript
export function useMediaUpload() {
  // State: isUploading, progress, error
  // upload(file) → { result, mediaType } | null
  // reset() → clears state
}
```

Manages the full upload lifecycle. No auth needed — unsigned uploads don't require a server round-trip.

### MessageInput Integration (`apps/web/src/components/chat/message-input.tsx`)

1. **Paperclip button** opens a file picker (images, video, audio, documents up to 50MB).
2. **File preview** shows selected file with name, size, and progress bar during upload.
3. **Caption input** — optional text to accompany the media.
4. **Send** triggers upload → WebSocket message with `type`, `mediaUrl`, and `mediaMeta`.

### File Validation (`packages/validation/src/schemas/media.ts`)

```typescript
export const ALLOWED_MEDIA_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/quicktime",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm",
  "application/pdf", "application/msword", ...
];

export const MAX_MEDIA_SIZE = 50 * 1024 * 1024; // 50MB
```

Client-side validation catches bad files early. Cloudinary also validates on their end.

### Integration Status

**Implemented**:
- `apps/web/src/lib/api.ts` — `uploadToCloudinary()` function
- `apps/web/src/hooks/use-media-upload.ts` — Upload hook with progress tracking
- `apps/web/src/components/chat/message-input.tsx` — File attachment UI
- `packages/validation/src/schemas/media.ts` — Validation constants
- WebSocket gateway already supports `mediaUrl` and `mediaMeta` fields

### How It Works (End to End)

```
1. User clicks paperclip icon in MessageInput
2. Browser opens file picker → user selects image.jpg (2.3MB)
3. Client shows file preview with name and size
4. User optionally types a caption and clicks Send
5. Client POSTs directly to Cloudinary with upload_preset=blink-monorepo
6. Cloudinary returns { secure_url, public_id, bytes, width, height, ... }
7. Client sends WebSocket message: message:send { roomId, content: "", type: "image", mediaUrl: "https://res.cloudinary.com/xxx/...", mediaMeta: { size: 2300000, mimeType: "image/jpeg" } }
8. Server persists to database, broadcasts message:new to room
```

## Common Mistakes / Gotchas

1. **Unsigned presets are public**: Anyone who knows your cloud name and preset name can upload. Cloudinary enforces the preset's rules (allowed types, folder, max file size), but you should set those restrictions in the dashboard.

2. **Not setting `resource_type: "auto"`**: Without this, Cloudinary defaults to `image` and rejects videos/documents.

3. **Forgetting CORS**: Cloudinary allows cross-origin uploads by default. No special config needed.

4. **Large video uploads**: Videos can be slow to upload. The progress bar in `MessageInput` keeps users informed.

5. **`NEXT_PUBLIC_` prefix**: In Next.js, only env vars prefixed with `NEXT_PUBLIC_` are exposed to the browser. This is required for Cloudinary config.

## Try It Yourself

1. Create a Cloudinary account (free tier: 25 credits/month, 25GB storage).
2. Create an upload preset named `blink-monorepo` with Signing Mode: **Unsigned**.
3. Add your cloud name to `apps/web/.env.local`.
4. Start the web app, open a chat, click the paperclip, select an image.
5. Verify the image uploads and appears in the chat.
