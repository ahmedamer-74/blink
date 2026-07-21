"use client";

import { X, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

interface ReplyBarProps {
  replyingTo: Message;
  onCancel: () => void;
}

export function ReplyBar({ replyingTo, onCancel }: ReplyBarProps) {
  const isOwn = replyingTo.userId === replyingTo.user.id;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 border-b">
      <CornerDownRight className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">
          Replying to {isOwn ? "yourself" : replyingTo.user.username}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {replyingTo.content}
        </p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
