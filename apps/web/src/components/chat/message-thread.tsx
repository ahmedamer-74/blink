"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useConversation } from "@/hooks/use-conversation";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MessageInput } from "@/components/chat/message-input";
import { DateDivider } from "@/components/chat/date-divider";
import { ChatHeader } from "@/components/chat/chat-header";
import type { Message, Room } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface MessageThreadProps {
  roomId: string;
  onBack?: () => void;
}

function shouldShowTail(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const msg = messages[index]!;
  const prev = messages[index - 1];
  if (!prev || prev.userId !== msg.userId) return true;
  const timeDiff = new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return timeDiff > 60_000;
}

function shouldShowDate(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const msg = messages[index]!;
  const prev = messages[index - 1];
  if (!prev) return true;
  return new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
}

export function MessageThread({ roomId, onBack }: MessageThreadProps) {
  const { user, accessToken } = useAuth();
  const { messages, typingUsers, sendMessage, sendTyping, sendStopTyping, loadMessages, isConnected } =
    useConversation(roomId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    setIsLoading(true);
    if (!accessToken) return;
    const headers = { Authorization: `Bearer ${accessToken}` };

    Promise.all([
      fetch(`${API_BASE}/api/v1/messages/rooms/${roomId}?limit=50`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/api/v1/rooms/${roomId}`, { headers }).then((r) => r.json()),
    ]).then(([msgsRes, roomRes]) => {
      loadMessages((msgsRes.data ?? []).reverse());
      setRoom(roomRes.data ?? null);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [roomId, loadMessages, accessToken]);

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 50);
    }
  }, [isLoading, messages]);

  const handleSend = useCallback(
    (content: string, options?: { replyToMessageId?: string }) => {
      sendMessage(content, options);
    },
    [sendMessage],
  );

  const otherMember = room?.memberships.find((m) => m.userId !== user?.id);
  const headerName = room?.name ?? otherMember?.user?.username ?? "Loading...";
  const typingNames = typingUsers.size > 0
    ? `${typingUsers.size === 1 ? "typing" : `${typingUsers.size} typing`}...`
    : undefined;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {!isConnected && (
        <div
          className="flex items-center justify-center gap-2 py-1.5 text-[13px]"
          style={{ background: "var(--accent-dark)", color: "#fff" }}
        >
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-white/80" />
          Connecting...
        </div>
      )}

      <ChatHeader
        name={headerName}
        subtitle={typingNames}
        onBack={onBack}
        showBack={true}
      />

      <div className="chat-bg flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex min-h-full flex-col justify-end py-2">
          {messages.map((msg, i) => (
            <div key={msg.id}>
              {shouldShowDate(messages, i) && <DateDivider date={msg.createdAt} />}
              <MessageBubble
                message={msg}
                isOwn={msg.userId === user?.id}
                showTail={shouldShowTail(messages, i)}
              />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <MessageInput
        onSend={handleSend}
        onTyping={sendTyping}
        onStopTyping={sendStopTyping}
      />
    </div>
  );
}
