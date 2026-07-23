"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, X, Image, Film, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReplyBar } from "./reply-bar";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { ALLOWED_MEDIA_TYPES } from "@repo/validation";
import type { Message } from "@/lib/types";

interface MessageInputProps {
  onSend: (
    content: string,
    options?: {
      replyToMessageId?: string;
      type?: string;
      mediaUrl?: string;
      mediaMeta?: Record<string, unknown>;
    },
  ) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export function MessageInput({
  onSend,
  onTyping,
  onStopTyping,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isUploading, progress, error, upload, reset } = useMediaUpload();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);

      if (!isTypingRef.current && e.target.value.length > 0) {
        isTypingRef.current = true;
        onTyping();
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onStopTyping();
      }, 2000);
    },
    [onTyping, onStopTyping],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
        alert("File type not allowed");
        return;
      }

      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert("File too large (max 50MB)");
        return;
      }

      setSelectedFile(file);

      // Create preview for images
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }
    },
    [],
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [previewUrl, reset]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // If there's a file, upload it first
      if (selectedFile) {
        const uploadResult = await upload(selectedFile);
        if (!uploadResult) return; // upload failed, state already set

        const { result, mediaType } = uploadResult;
        const caption = value.trim() || "";
        const meta: Record<string, unknown> = {
          size: result.bytes,
          mimeType: selectedFile.type,
        };
        if (result.width) meta.width = result.width;
        if (result.height) meta.height = result.height;

        onSend(caption, {
          replyToMessageId: replyingTo?.id,
          type: mediaType,
          mediaUrl: result.secure_url,
          mediaMeta: meta,
        });

        clearFile();
      } else if (value.trim()) {
        onSend(value, {
          replyToMessageId: replyingTo?.id,
        });
      } else {
        return;
      }

      setValue("");
      isTypingRef.current = false;
      onStopTyping();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    },
    [
      selectedFile,
      value,
      upload,
      onSend,
      onStopTyping,
      replyingTo,
      clearFile,
    ],
  );

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (type.startsWith("video/")) return <Film className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="border-t bg-background">
      {replyingTo && onCancelReply && (
        <ReplyBar replyingTo={replyingTo} onCancel={onCancelReply} />
      )}

      {/* File preview */}
      {selectedFile && (
        <div className="flex items-center gap-3 border-b px-4 py-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-16 w-16 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted">
              {getFileIcon(selectedFile.type)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
            </p>
            {isUploading && (
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {error && (
              <p className="mt-1 text-xs text-destructive">{error}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearFile}
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_MEDIA_TYPES.join(",")}
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={value}
          onChange={handleChange}
          placeholder={
            selectedFile ? "Add a caption..." : "Type a message..."
          }
          className="flex-1"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isUploading || (!value.trim() && !selectedFile)}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
