"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Room } from "@/lib/types";

interface ConversationItemProps {
  room: Room;
  currentUserId: string;
}

export function ConversationItem({ room, currentUserId }: ConversationItemProps) {
  const pathname = usePathname();
  const isActive = pathname === `/chat/${room.id}`;

  const otherMember = room.memberships.find((m) => m.userId !== currentUserId);
  const displayName = room.name ?? otherMember?.user?.username ?? "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/chat/${room.id}`}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
        isActive && "bg-accent",
      )}
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <p className="truncate font-medium">{displayName}</p>
        {room.memberships.length > 2 && (
          <p className="truncate text-xs text-muted-foreground">
            {room.memberships.length} members
          </p>
        )}
      </div>
    </Link>
  );
}
