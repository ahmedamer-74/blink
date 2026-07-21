"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Room } from "@/lib/types";

interface ChatListItemProps {
  room: Room;
  currentUserId: string;
  onClick?: () => void;
}

export function ChatListItem({ room, currentUserId, onClick }: ChatListItemProps) {
  const pathname = usePathname();
  const isActive = pathname === `/chat/${room.id}`;

  const otherMember = room.memberships.find((m) => m.userId !== currentUserId);
  const selfMember = room.memberships.find((m) => m.userId === currentUserId);
  const displayName = room.name ?? otherMember?.user?.username ?? selfMember?.user?.username ?? "Chat";
  const initials = displayName.slice(0, 2).toUpperCase();

  const groupSize = room.memberships.length;

  return (
    <Link
      href={`/chat/${room.id}`}
      onClick={onClick}
      className="flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 sm:py-3 transition-colors"
      style={{
        background: isActive ? "rgba(0,168,132,0.08)" : "transparent",
        borderBottom: "1px solid var(--divider)",
      }}
    >
      <Avatar className="h-11 w-11 sm:h-[49px] sm:w-[49px] shrink-0">
        <AvatarFallback
          className="text-xs sm:text-sm font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span
            className="truncate text-sm sm:text-[17px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {displayName}
          </span>
          <span
            className="ml-2 shrink-0 text-[10px] sm:text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {new Date(room.updatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p
            className="truncate text-xs sm:text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {groupSize > 2
              ? `${groupSize} members`
              : otherMember?.user?.username
                ? `@${otherMember.user.username}`
                : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
