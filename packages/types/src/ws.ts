export interface WSEnvelope<T = unknown> {
  event: string;
  data: T;
  timestamp: number;
  requestId?: string;
}

export interface WSClientEvents {
  // Message events
  "message:send": {
    roomId: string;
    content: string;
    type?: string;
    replyToMessageId?: string;
    forwardedFromId?: string;
    mediaUrl?: string;
    mediaMeta?: {
      size?: number;
      mimeType?: string;
      duration?: number;
      width?: number;
      height?: number;
      thumbnailUrl?: string;
    };
  };
  "message:edit": { messageId: string; content: string };
  "message:delete_for_me": { messageId: string };
  "message:delete_for_everyone": { messageId: string; roomId: string };
  "message:reply": {
    roomId: string;
    content: string;
    replyToMessageId: string;
    type?: string;
    mediaUrl?: string;
    mediaMeta?: Record<string, unknown>;
  };
  "message:forward": { messageId: string; targetRoomIds: string[] };
  "message:star": { messageId: string };
  "message:unstar": { messageId: string };
  "message:read": { roomId: string; lastMessageId: string };

  // Room events
  "room:join": { roomId: string };
  "room:leave": { roomId: string };
  "room:create": { name?: string; isPrivate?: boolean; memberIds?: string[] };
  "room:update": { roomId: string; name?: string; description?: string; avatarUrl?: string };
  "room:add_members": { roomId: string; userIds: string[] };
  "room:remove_member": { roomId: string; userId: string };
  "room:promote_admin": { roomId: string; userId: string };
  "room:demote_admin": { roomId: string; userId: string };

  // User events
  "user:typing": { roomId: string };
  "user:stop_typing": { roomId: string };

  // Call events
  "call:initiate": { conversationId: string; type: "voice" | "video" };
  "call:answer": { callId: string; sdp: string };
  "call:reject": { callId: string };
  "call:end": { callId: string };
  "call:ice_candidate": {
    callId: string;
    candidate: string;
    sdpMid?: string;
    sdpMLineIndex?: number;
  };

  // Status events
  "status:create": {
    type: "text" | "image" | "video";
    content?: string;
    mediaUrl?: string;
    caption?: string;
  };
  "status:view": { statusId: string };

  // Ping
  ping: Record<string, never>;
}

export interface WSServerEvents {
  // User events
  "user:connected": { userId: string; username: string };
  "user:disconnected": { userId: string };
  "user:typing": { roomId: string; userId: string };

  // Message events
  "message:new": {
    roomId: string;
    message: {
      id: string;
      content: string;
      type: string;
      userId: string;
      username: string;
      createdAt: string;
      replyToMessageId?: string;
      forwardedFromId?: string;
      mediaUrl?: string;
      mediaMeta?: Record<string, unknown>;
    };
  };
  "message:edited": {
    roomId: string;
    messageId: string;
    content: string;
    editedAt: string;
  };
  "message:deleted_for_everyone": { roomId: string; messageId: string };
  "message:starred": { messageId: string };
  "message:unstarred": { messageId: string };
  "message:read": { roomId: string; userId: string; lastMessageId: string };

  // Room events
  "room:created": { room: unknown };
  "room:updated": { roomId: string; updates: Record<string, unknown> };
  "room:member_joined": { roomId: string; user: unknown };
  "room:member_left": { roomId: string; userId: string };
  "room:member_added": { roomId: string; users: unknown[] };
  "room:member_removed": { roomId: string; userId: string };
  "room:admin_promoted": { roomId: string; userId: string };
  "room:admin_demoted": { roomId: string; userId: string };

  // Call events
  "call:incoming": {
    callId: string;
    conversationId: string;
    callerId: string;
    callerUsername: string;
    type: "voice" | "video";
    sdp: string;
  };
  "call:answered": { callId: string; sdp: string };
  "call:rejected": { callId: string };
  "call:ended": { callId: string; duration: number };
  "call:ice_candidate": {
    callId: string;
    candidate: string;
    sdpMid?: string;
    sdpMLineIndex?: number;
  };

  // Status events
  "status:new": {
    statusId: string;
    userId: string;
    username: string;
    type: "text" | "image" | "video";
    createdAt: string;
  };
  "status:viewed": { statusId: string; viewerId: string };

  // Presence
  "presence:online": { userIds: string[] };

  // System
  pong: Record<string, never>;
  error: { code: string; message: string };
}

export type WSEventName = keyof WSServerEvents | keyof WSClientEvents;
