"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ChatHeaderProps {
  name: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export function ChatHeader({ name, subtitle, onBack, showBack }: ChatHeaderProps) {
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex h-[59px] shrink-0 items-center gap-2 sm:gap-3 px-2 sm:px-4"
      style={{ background: "var(--bg-panel)", borderBottom: "1px solid var(--divider)" }}
    >
      {showBack && (
        <button
          onClick={onBack}
          className="mr-0.5 sm:mr-1 rounded-full p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5 md:hidden shrink-0"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <Avatar className="h-9 w-9 sm:h-[40px] sm:w-[40px] shrink-0">
        <AvatarFallback className="text-xs sm:text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm sm:text-[16px] font-medium" style={{ color: "var(--text-primary)" }}>
          {name}
        </span>
        {subtitle && (
          <span className="truncate text-xs sm:text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <button className="rounded-full p-1.5 sm:p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <button className="rounded-full p-1.5 sm:p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}>
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
