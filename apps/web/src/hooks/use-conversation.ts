"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/lib/auth-context";
import { WS_EVENTS } from "@repo/websocket";
import { playMessageSound } from "@/lib/notification-sound";
import type { Message, WsMessage } from "@/lib/types";

interface SendMessageOptions {
  type?: string;
  mediaUrl?: string;
  mediaMeta?: Record<string, unknown>;
  replyToMessageId?: string;
  forwardedFromId?: string;
}

export function useConversation(roomId: string) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const typingTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!socket || !roomId) return;

    // Sync connection state immediately (handles already-connected sockets)
    setIsConnected(socket.connected);

    const unsubConnected = socket.on("_connected", () => setIsConnected(true));
    const unsubDisconnected = socket.on("_disconnected", () => setIsConnected(false));

    // Handle new messages
    const unsubMessageNew = socket.on(WS_EVENTS.SERVER.MESSAGE_NEW, (data) => {
      if (data.roomId === roomId) {
        const wsMsg = data.message as WsMessage;
        const msg: Message = {
          id: wsMsg.id,
          content: wsMsg.content,
          type: wsMsg.type,
          createdAt: wsMsg.createdAt,
          updatedAt: wsMsg.createdAt,
          userId: wsMsg.userId,
          roomId: data.roomId,
          replyToMessageId: wsMsg.replyToMessageId || null,
          forwardedFromId: wsMsg.forwardedFromId || null,
          mediaUrl: wsMsg.mediaUrl || null,
          mediaMeta: wsMsg.mediaMeta || null,
          editedAt: null,
          deletedForEveryone: false,
          systemMeta: null,
          user: {
            id: wsMsg.userId,
            username: wsMsg.username,
            avatar: null,
          },
          status: wsMsg.userId === user?.id ? "sent" : undefined,
        };
        setMessages((prev) => [...prev, msg]);

        // Play sound for messages from other users
        if (wsMsg.userId !== user?.id) {
          playMessageSound();
        }
      }
    });

    // Handle edited messages
    const unsubMessageEdited = socket.on(WS_EVENTS.SERVER.MESSAGE_EDITED, (data) => {
      if (data.roomId === roomId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, content: data.content, editedAt: data.editedAt }
              : msg
          )
        );
      }
    });

    // Handle deleted messages (for everyone)
    const unsubMessageDeleted = socket.on(WS_EVENTS.SERVER.MESSAGE_DELETED_FOR_EVERYONE, (data) => {
      if (data.roomId === roomId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, content: "This message has been deleted", deletedForEveryone: true }
              : msg
          )
        );
      }
    });

    // Handle starred messages
    const unsubMessageStarred = socket.on(WS_EVENTS.SERVER.MESSAGE_STARRED, (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, isStarred: true } : msg
        )
      );
    });

    // Handle unstarred messages
    const unsubMessageUnstarred = socket.on(WS_EVENTS.SERVER.MESSAGE_UNSTARRED, (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, isStarred: false } : msg
        )
      );
    });

    // Handle typing indicators
    const unsubTyping = socket.on(WS_EVENTS.SERVER.USER_TYPING, (data) => {
      if (data.roomId === roomId && data.userId !== user?.id) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));

        const existing = typingTimeoutRef.current.get(data.userId);
        if (existing) clearTimeout(existing);

        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
          });
          typingTimeoutRef.current.delete(data.userId);
        }, 3000);

        typingTimeoutRef.current.set(data.userId, timeout);
      }
    });

    // Join the room
    socket.send(WS_EVENTS.CLIENT.ROOM_JOIN, { roomId });

    // Cleanup
    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubMessageNew();
      unsubMessageEdited();
      unsubMessageDeleted();
      unsubMessageStarred();
      unsubMessageUnstarred();
      unsubTyping();
      socket.send(WS_EVENTS.CLIENT.ROOM_LEAVE, { roomId });
      typingTimeoutRef.current.forEach((t) => clearTimeout(t));
      typingTimeoutRef.current.clear();
    };
  }, [socket, roomId, user?.id]);

  // Send a text or media message
  const sendMessage = useCallback(
    (content: string, options?: SendMessageOptions) => {
      if (!socket || !content.trim()) return;

      if (options?.replyToMessageId) {
        // Send as a reply
        socket.send(WS_EVENTS.CLIENT.MESSAGE_REPLY, {
          roomId,
          content: content.trim(),
          replyToMessageId: options.replyToMessageId,
          type: options.type,
          mediaUrl: options.mediaUrl,
          mediaMeta: options.mediaMeta,
        });
      } else {
        // Send regular message
        socket.send(WS_EVENTS.CLIENT.MESSAGE_SEND, {
          roomId,
          content: content.trim(),
          type: options?.type,
          mediaUrl: options?.mediaUrl,
          mediaMeta: options?.mediaMeta,
          forwardedFromId: options?.forwardedFromId,
        });
      }
    },
    [socket, roomId]
  );

  // Edit an existing message
  const editMessage = useCallback(
    (messageId: string, content: string) => {
      if (!socket) return;
      socket.send(WS_EVENTS.CLIENT.MESSAGE_EDIT, { messageId, content });
    },
    [socket]
  );

  // Delete a message for yourself only
  const deleteMessageForMe = useCallback(
    (messageId: string) => {
      if (!socket) return;
      socket.send(WS_EVENTS.CLIENT.MESSAGE_DELETE_FOR_ME, { messageId });
      // Optimistically remove from local state
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    },
    [socket]
  );

  // Delete a message for everyone (within 15-min window)
  const deleteMessageForEveryone = useCallback(
    (messageId: string) => {
      if (!socket) return;
      socket.send(WS_EVENTS.CLIENT.MESSAGE_DELETE_FOR_EVERYONE, { messageId, roomId });
    },
    [socket, roomId]
  );

  // Star a message
  const starMessage = useCallback(
    (messageId: string) => {
      if (!socket) return;
      socket.send(WS_EVENTS.CLIENT.MESSAGE_STAR, { messageId });
    },
    [socket]
  );

  // Unstar a message
  const unstarMessage = useCallback(
    (messageId: string) => {
      if (!socket) return;
      socket.send(WS_EVENTS.CLIENT.MESSAGE_UNSTAR, { messageId });
    },
    [socket]
  );

  // Forward a message to other conversations
  const forwardMessage = useCallback(
    (messageId: string, targetRoomIds: string[]) => {
      if (!socket) return;
      socket.send(WS_EVENTS.CLIENT.MESSAGE_FORWARD, { messageId, targetRoomIds });
    },
    [socket]
  );

  // Send typing indicator
  const sendTyping = useCallback(() => {
    if (!socket) return;
    socket.send(WS_EVENTS.CLIENT.USER_TYPING, { roomId });
  }, [socket, roomId]);

  // Stop typing indicator
  const sendStopTyping = useCallback(() => {
    if (!socket) return;
    socket.send(WS_EVENTS.CLIENT.USER_STOP_TYPING, { roomId });
  }, [socket, roomId]);

  // Mark messages as read
  const markAsRead = useCallback(
    (lastMessageId: string) => {
      if (!socket) return;
      socket.send(WS_EVENTS.CLIENT.MESSAGE_READ, { roomId, lastMessageId });
    },
    [socket, roomId]
  );

  // Load initial messages (from REST API)
  const loadMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs);
  }, []);

  return {
    messages,
    typingUsers,
    isConnected,
    sendMessage,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    starMessage,
    unstarMessage,
    forwardMessage,
    sendTyping,
    sendStopTyping,
    loadMessages,
    markAsRead,
  };
}
