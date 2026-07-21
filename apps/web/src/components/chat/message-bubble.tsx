"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Download, Play, Pause, Star, CornerDownRight } from "lucide-react";
import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showTail?: boolean;
  onReply?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onStar?: (messageId: string) => void;
  onUnstar?: (messageId: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  showTail,
  onReply,
  onForward,
  onStar,
  onUnstar,
}: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const initials = message.user.username.slice(0, 2).toUpperCase();
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const renderContent = () => {
    switch (message.type) {
      case "image":
        return (
          <div className="space-y-2">
            {message.mediaUrl && (
              <img
                src={message.mediaUrl}
                alt="Shared image"
                className="rounded-lg max-w-full max-h-48 sm:max-h-64 object-cover cursor-pointer"
                onClick={() => message.mediaUrl && window.open(message.mediaUrl, "_blank")}
              />
            )}
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case "video":
        return (
          <div className="space-y-2">
            {message.mediaUrl && (
              <video
                src={message.mediaUrl}
                controls
                className="rounded-lg max-w-full max-h-48 sm:max-h-64"
              />
            )}
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <audio
              src={message.mediaUrl ?? undefined}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="hidden"
            />
            <div className="flex-1 h-8 bg-secondary rounded-full flex items-center px-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary rounded-full"
                    style={{ height: `${Math.random() * 20 + 4}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case "document":
        return (
          <div className="flex items-center gap-3 p-2 bg-secondary rounded-lg">
            <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.content}</p>
              <p className="text-xs text-muted-foreground">
                {message.mediaMeta?.mimeType || "Document"}
              </p>
            </div>
            {message.mediaUrl && (
              <Button variant="ghost" size="icon" asChild>
                <a href={message.mediaUrl} download target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        );

      case "system":
        return (
          <div className="text-center text-sm text-muted-foreground py-2">
            {message.content}
          </div>
        );

      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  if (message.type === "system") {
    return (
      <div className="flex justify-center py-2">
        <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2 group", isOwn && "flex-row-reverse")}>
      {!isOwn && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("max-w-[85%] sm:max-w-[75%] space-y-1", isOwn && "items-end")}>
        {!isOwn && (
          <p className="text-xs font-medium text-muted-foreground">
            {message.user.username}
          </p>
        )}

        {/* Reply preview */}
        {message.replyToMessageId && (
          <div className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground p-2 rounded-t-lg border-l-2",
            isOwn ? "bg-primary/10 border-primary" : "bg-secondary border-secondary-foreground/20"
          )}>
            <CornerDownRight className="h-3 w-3" />
            <span className="truncate">Reply to message</span>
          </div>
        )}

        {/* Message content */}
        <div
          className={cn(
            "rounded-xl px-3 py-2",
            isOwn
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
            message.replyToMessageId && "rounded-tl-none"
          )}
        >
          {renderContent()}

          {/* Edited indicator */}
          {message.editedAt && (
            <span className="text-xs opacity-60 ml-1">(edited)</span>
          )}
        </div>

        {/* Footer with time and actions */}
        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", isOwn && "justify-end")}>
          <span>{time}</span>

          {/* Star indicator */}
          {message.isStarred && (
            <Star className="h-3 w-3 fill-current text-yellow-500" />
          )}

          {/* Action buttons (shown on hover, always visible on touch) */}
          <div className="hidden group-hover:flex sm:flex sm:opacity-0 group-hover:opacity-100 items-center gap-1 transition-opacity">
            {onReply && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onReply(message)}
              >
                <CornerDownRight className="h-3 w-3" />
              </Button>
            )}
            {onForward && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onForward(message)}
              >
                <Download className="h-3 w-3" />
              </Button>
            )}
            {message.isStarred ? (
              onUnstar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onUnstar(message.id)}
                >
                  <Star className="h-3 w-3" />
                </Button>
              )
            ) : (
              onStar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onStar(message.id)}
                >
                  <Star className="h-3 w-3" />
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
