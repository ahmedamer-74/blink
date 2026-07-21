"use client";

import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReplyBar } from "./reply-bar";
import type { Message } from "@/lib/types";

interface MessageInputProps {
  onSend: (content: string, options?: {
    replyToMessageId?: string;
  }) => void;
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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

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
    [onTyping, onStopTyping]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim()) return;

      onSend(value, {
        replyToMessageId: replyingTo?.id,
      });
      setValue("");
      isTypingRef.current = false;
      onStopTyping();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    },
    [value, onSend, onStopTyping, replyingTo]
  );

  return (
    <div className="border-t bg-background">
      {replyingTo && onCancelReply && (
        <ReplyBar replyingTo={replyingTo} onCancel={onCancelReply} />
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4">
        <Input
          value={value}
          onChange={handleChange}
          placeholder="Type a message..."
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={!value.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
