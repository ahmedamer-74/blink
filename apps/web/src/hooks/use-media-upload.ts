"use client";

import { useState, useCallback } from "react";
import { uploadToCloudinary, type CloudinaryUploadResult } from "@/lib/api";

export type MediaType = "image" | "video" | "audio" | "document";

export interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useMediaUpload() {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });

  const upload = useCallback(
    async (
      file: File,
    ): Promise<{
      result: CloudinaryUploadResult;
      mediaType: MediaType;
    } | null> => {
      setState({ isUploading: true, progress: 0, error: null });

      try {
        const result = await uploadToCloudinary(file, (progress) => {
          setState((s) => ({ ...s, progress }));
        });

        const mediaType = getMediaType(result.resource_type, result.format);

        setState({ isUploading: false, progress: 100, error: null });
        return { result, mediaType };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        setState({ isUploading: false, progress: 0, error: message });
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: 0, error: null });
  }, []);

  return { ...state, upload, reset };
}

function getMediaType(
  resourceType: string,
  format: string,
): MediaType {
  if (resourceType === "video") return "video";
  if (resourceType === "audio") return "audio";
  if (resourceType === "image") return "image";
  return "document";
}
