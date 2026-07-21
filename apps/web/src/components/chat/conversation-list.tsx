"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ChatListItem } from "@/components/chat/chat-list-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, CheckCheck, Search, X } from "lucide-react";
import type { Room } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface SearchResult {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
}

interface ConversationListProps {
  onOpenChat?: () => void;
}

export function ConversationList({ onOpenChat }: ConversationListProps) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      fetch(`${API_BASE}/api/v1/rooms`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()),
      fetch(`${API_BASE}/api/v1/rooms/pending`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json()),
    ]).then(([roomsRes, pendingRes]) => {
      setRooms(roomsRes.data ?? []);
      setPendingRequests(pendingRes.data ?? []);
      setIsLoading(false);
    });
  }, [accessToken]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (!value.trim()) {
        setSearchResults([]);
        return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
        if (!accessToken) return;
        setIsSearching(true);
        try {
          const res = await fetch(
            `${API_BASE}/api/v1/users/search?q=${encodeURIComponent(value)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          const json = await res.json();
          setSearchResults(json.data ?? []);
        } catch {
          setSearchResults([]);
        }
        setIsSearching(false);
      }, 300);
    },
    [accessToken],
  );

  const handleStartConversation = async (userId: string) => {
    if (!accessToken) return;
    setIsCreating(userId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ isPrivate: true, memberIds: [userId] }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        // Add the new room to the list
        const roomRes = await fetch(`${API_BASE}/api/v1/rooms/${json.data.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const roomJson = await roomRes.json();
        if (roomJson.success && roomJson.data) {
          setRooms((prev) => [roomJson.data, ...prev]);
        }
        // Clear search and navigate
        setSearchQuery("");
        setSearchResults([]);
        setShowSearch(false);
        router.push(`/chat/${json.data.id}`);
        onOpenChat?.();
      }
    } catch {
      // ignore
    }
    setIsCreating(null);
  };

  const toggleSearch = () => {
    setShowSearch((prev) => !prev);
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const handleAccept = async (roomId: string) => {
    if (!accessToken) return;
    await fetch(`${API_BASE}/api/v1/rooms/${roomId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setPendingRequests((prev) => prev.filter((r) => r.id !== roomId));
    const roomsRes = await fetch(`${API_BASE}/api/v1/rooms`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await roomsRes.json();
    setRooms(json.data ?? []);
  };

  const handleReject = async (roomId: string) => {
    if (!accessToken) return;
    await fetch(`${API_BASE}/api/v1/rooms/${roomId}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setPendingRequests((prev) => prev.filter((r) => r.id !== roomId));
  };

  const showResults = showSearch && (searchQuery.trim().length > 0 || isSearching);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search bar */}
      <div className="px-2.5 sm:px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--divider)" }}>
        {showSearch ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg px-2.5 sm:px-3 py-1.5" style={{ background: "var(--input-bg)" }}>
              <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search users..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)] min-w-0"
                style={{ color: "var(--text-primary)" }}
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="shrink-0">
                  <X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                </button>
              )}
            </div>
            <button
              onClick={toggleSearch}
              className="rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
              style={{ color: "var(--text-secondary)" }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={toggleSearch}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
            style={{ background: "var(--input-bg)" }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Search or start new chat</span>
          </button>
        )}
      </div>

      {/* Search results */}
      {showResults && (
        <div className="border-b" style={{ borderColor: "var(--divider)" }}>
          {isSearching ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((u) => (
              <div
                key={u.id}
                onClick={() => handleStartConversation(u.id)}
                className="flex cursor-pointer items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                style={{ borderBottom: "1px solid var(--divider)" }}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-xs font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
                    {u.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {u.username}
                  </span>
                  <span className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                    {u.email}
                  </span>
                </div>
                {isCreating === u.id && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent shrink-0" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                )}
              </div>
            ))
          ) : searchQuery.trim().length > 0 ? (
            <div className="py-6 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
              No users found
            </div>
          ) : null}
        </div>
      )}

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {isLoading ? (
            <div className="space-y-0 px-2.5 sm:px-3 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 sm:gap-3 py-2.5 sm:py-3">
                  <div className="h-11 w-11 sm:h-12 sm:w-12 animate-pulse rounded-full shrink-0" style={{ background: "var(--divider)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 sm:w-32 animate-pulse rounded" style={{ background: "var(--divider)" }} />
                    <div className="h-3 w-36 sm:w-48 animate-pulse rounded" style={{ background: "var(--divider)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Pending chat requests */}
              {pendingRequests.length > 0 && (
                <div>
                  {pendingRequests.map((room) => {
                    const other = room.memberships.find((m) => m.userId !== user?.id);
                    const name = other?.user?.username ?? "Unknown";
                    return (
                      <div
                        key={room.id}
                        className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 transition-colors"
                        style={{ borderBottom: "1px solid var(--divider)" }}
                      >
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                          <AvatarFallback className="text-xs sm:text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
                            {name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-1 items-center gap-1 overflow-hidden min-w-0">
                          <span className="flex-1 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {name}
                          </span>
                          <span className="shrink-0 text-[10px] sm:text-xs hidden sm:inline" style={{ color: "var(--text-secondary)" }}>wants to chat</span>
                          <button
                            onClick={() => handleAccept(room.id)}
                            className="ml-0.5 sm:ml-1 shrink-0 rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            <Check className="h-5 w-5" style={{ color: "var(--accent)" }} />
                          </button>
                          <button
                            onClick={() => handleReject(room.id)}
                            className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            <X className="h-5 w-5" style={{ color: "var(--destructive)" }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Conversation list */}
              {rooms.length === 0 && pendingRequests.length === 0 && !showResults ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 sm:px-8 text-center">
                  <div className="mb-3 sm:mb-4 rounded-full p-3 sm:p-4" style={{ background: "var(--divider)" }}>
                    <svg viewBox="0 0 24 24" className="h-8 w-8 sm:h-10 sm:w-10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-secondary)" }}>
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
                    No conversations yet.
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs" style={{ color: "var(--text-secondary)" }}>
                    Search for a user above to start chatting
                  </p>
                </div>
              ) : (
                rooms.map((room) => (
                  <ChatListItem
                    key={room.id}
                    room={room}
                    currentUserId={user?.id ?? ""}
                    onClick={onOpenChat}
                  />
                ))
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
