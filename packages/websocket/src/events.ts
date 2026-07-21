export const WS_EVENTS = {
  // Client → Server
  CLIENT: {
    // Message events
    MESSAGE_SEND: "message:send",
    MESSAGE_EDIT: "message:edit",
    MESSAGE_DELETE_FOR_ME: "message:delete_for_me",
    MESSAGE_DELETE_FOR_EVERYONE: "message:delete_for_everyone",
    MESSAGE_REPLY: "message:reply",
    MESSAGE_FORWARD: "message:forward",
    MESSAGE_STAR: "message:star",
    MESSAGE_UNSTAR: "message:unstar",
    MESSAGE_READ: "message:read",

    // Room events
    ROOM_JOIN: "room:join",
    ROOM_LEAVE: "room:leave",
    ROOM_CREATE: "room:create",
    ROOM_UPDATE: "room:update",
    ROOM_ADD_MEMBERS: "room:add_members",
    ROOM_REMOVE_MEMBER: "room:remove_member",
    ROOM_PROMOTE_ADMIN: "room:promote_admin",
    ROOM_DEMOTE_ADMIN: "room:demote_admin",

    // User events
    USER_TYPING: "user:typing",
    USER_STOP_TYPING: "user:stop_typing",

    // Call events
    CALL_INITIATE: "call:initiate",
    CALL_ANSWER: "call:answer",
    CALL_REJECT: "call:reject",
    CALL_END: "call:end",
    CALL_ICE_CANDIDATE: "call:ice_candidate",

    // Status events
    STATUS_CREATE: "status:create",
    STATUS_VIEW: "status:view",

    // Ping
    PING: "ping",
  } as const,

  // Server → Client
  SERVER: {
    // User events
    USER_CONNECTED: "user:connected",
    USER_DISCONNECTED: "user:disconnected",
    USER_TYPING: "user:typing",

    // Message events
    MESSAGE_NEW: "message:new",
    MESSAGE_EDITED: "message:edited",
    MESSAGE_DELETED_FOR_EVERYONE: "message:deleted_for_everyone",
    MESSAGE_STARRED: "message:starred",
    MESSAGE_UNSTARRED: "message:unstarred",
    MESSAGE_READ: "message:read",

    // Room events
    ROOM_CREATED: "room:created",
    ROOM_UPDATED: "room:updated",
    ROOM_MEMBER_JOINED: "room:member_joined",
    ROOM_MEMBER_LEFT: "room:member_left",
    ROOM_MEMBER_ADDED: "room:member_added",
    ROOM_MEMBER_REMOVED: "room:member_removed",
    ROOM_ADMIN_PROMOTED: "room:admin_promoted",
    ROOM_ADMIN_DEMOTED: "room:admin_demoted",

    // Call events
    CALL_INCOMING: "call:incoming",
    CALL_ANSWERED: "call:answered",
    CALL_REJECTED: "call:rejected",
    CALL_ENDED: "call:ended",
    CALL_ICE_CANDIDATE: "call:ice_candidate",

    // Status events
    STATUS_NEW: "status:new",
    STATUS_VIEWED: "status:viewed",

    // Presence
    PRESENCE_ONLINE: "presence:online",

    // System
    PONG: "pong",
    ERROR: "error",
  } as const,
} as const;
