export interface RoomMember {
  id: string;
  userId: string;
  roomId: string;
  role: string;
  status: string;
  joinedAt: string;
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

export interface Room {
  id: string;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  memberships: RoomMember[];
}

/** Message shape from REST API (Prisma include) */
export interface Message {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  roomId: string;
  replyToMessageId: string | null;
  forwardedFromId: string | null;
  mediaUrl: string | null;
  mediaMeta: {
    size?: number;
    mimeType?: string;
    duration?: number;
    width?: number;
    height?: number;
    thumbnailUrl?: string;
  } | null;
  editedAt: string | null;
  deletedForEveryone: boolean;
  systemMeta: {
    action: string;
    actorId?: string;
    targetId?: string;
  } | null;
  user: {
    id: string;
    username: string;
    avatar: string | null;
  };
  isStarred?: boolean;
  status?: "sent" | "delivered" | "read";
  readBy?: string[];
}

/** Message shape from WebSocket broadcast (flat fields) */
export interface WsMessage {
  id: string;
  content: string;
  type: string;
  userId: string;
  username: string;
  createdAt: string;
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
}

export interface User {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Status {
  id: string;
  type: "text" | "image" | "video";
  content: string | null;
  mediaUrl: string | null;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  user: {
    id: string;
    username: string;
    avatar: string | null;
  };
  viewCount: number;
  hasViewed: boolean;
}

export interface Contact {
  id: string;
  userId: string;
  contactId: string;
  addedAt: string;
  contact: User;
}

export interface BlockedUser {
  id: string;
  userId: string;
  blockedId: string;
  createdAt: string;
  blocked: User;
}

export interface Call {
  id: string;
  type: "voice" | "video";
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  conversationId: string;
  initiatorId: string;
  initiator: User;
  participants: CallParticipant[];
}

export interface CallParticipant {
  id: string;
  callId: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  user: User;
}
