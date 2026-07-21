"use client";

interface TypingIndicatorProps {
  typingCount: number;
}

export function TypingIndicator({ typingCount }: TypingIndicatorProps) {
  if (typingCount === 0) return null;

  const text = typingCount === 1 ? "is typing..." : "are typing...";

  return (
    <div className="flex items-center gap-1 px-4 py-1">
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground">
        {typingCount} {text}
      </span>
    </div>
  );
}
