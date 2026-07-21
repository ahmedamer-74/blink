"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatSearchProps {
  roomId: string;
  onMessageFound: (messageId: string) => void;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  content: string;
  highlight: string;
  createdAt: string;
  user: {
    username: string;
  };
}

export function ChatSearch({ roomId, onMessageFound, onClose }: ChatSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/messages/rooms/${roomId}/search?q=${encodeURIComponent(query)}&limit=20`
      );
      const data = await response.json();
      if (data.success) {
        setResults(data.data);
        setCurrentIndex(0);
        if (data.data.length > 0) {
          onMessageFound(data.data[0].id);
        }
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }, [query, roomId, onMessageFound]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        navigatePrev();
      } else {
        navigateNext();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const navigateNext = () => {
    if (results.length === 0) return;
    const nextIndex = (currentIndex + 1) % results.length;
    setCurrentIndex(nextIndex);
    const result = results[nextIndex];
    if (result) onMessageFound(result.id);
  };

  const navigatePrev = () => {
    if (results.length === 0) return;
    const prevIndex = (currentIndex - 1 + results.length) % results.length;
    setCurrentIndex(prevIndex);
    const result = results[prevIndex];
    if (result) onMessageFound(result.id);
  };

  return (
    <div className="border-b bg-background p-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
        {results.length > 0 && (
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap shrink-0">
            {currentIndex + 1}/{results.length}
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={navigatePrev} disabled={results.length === 0} className="shrink-0 hidden sm:inline-flex">
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={navigateNext} disabled={results.length === 0} className="shrink-0 hidden sm:inline-flex">
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="text-center py-2 text-sm text-muted-foreground">Searching...</div>
      )}

      {!loading && results.length === 0 && query.trim() && (
        <div className="text-center py-2 text-sm text-muted-foreground">No results found</div>
      )}
    </div>
  );
}
