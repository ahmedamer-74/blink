"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface SearchResult {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
}

export default function NewConversationPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !accessToken) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/users/search?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const json = await res.json();
      setResults(json.data ?? []);
    } catch {
      setResults([]);
    }
    setIsSearching(false);
  };

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
        router.push(`/chat/${json.data.id}`);
      }
    } catch {
      // ignore
    }
    setIsCreating(null);
  };

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--bg-panel)" }}>
      {/* Header */}
      <div
        className="flex h-[59px] items-center gap-4 px-6"
        style={{ borderBottom: "1px solid var(--divider)" }}
      >
        <button
          onClick={() => router.push("/chat")}
          className="rounded-full p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
          New chat
        </h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="px-4 py-3" style={{ borderBottom: "1px solid var(--divider)" }}>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "var(--input-bg)" }}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username..."
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--text-secondary)]"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      </form>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        ) : results.length > 0 ? (
          results.map((user) => (
            <div
              key={user.id}
              onClick={() => handleStartConversation(user.id)}
              className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
              style={{ borderBottom: "1px solid var(--divider)" }}
            >
              <Avatar className="h-[49px] w-[49px] shrink-0">
                <AvatarFallback className="text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[17px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {user.username}
                </span>
                <span className="truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  {user.email}
                </span>
              </div>
              {isCreating === user.id && (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              )}
            </div>
          ))
        ) : query.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No users found for &ldquo;{query}&rdquo;
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
            <svg viewBox="0 0 24 24" className="mb-4 h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: "var(--text-secondary)", opacity: 0.4 }}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Search for a user to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
