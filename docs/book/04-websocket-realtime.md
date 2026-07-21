# Chapter 04: WebSocket & Realtime

---

## What Problem Does This Solve?

HTTP is request-response: the client asks, the server answers. For a chat app, this is inefficient — the client would have to poll the server every few seconds asking "any new messages?" Most of the time, the answer is "no." This wastes bandwidth and battery.

**WebSockets** solve this by establishing a persistent, bidirectional connection. Once connected, either side can send a message at any time. The server can push new messages to the client instantly — no polling needed.

Blink uses WebSockets for: real-time message delivery, typing indicators, read receipts, presence (online/offline), room membership changes, call signaling, and status updates.

## How It Works in General

### The WebSocket Handshake

A WebSocket connection starts as an HTTP request with an `Upgrade` header:

```
GET /ws HTTP/1.1
Host: localhost:5000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

The server responds with `101 Switching Protocols` and the connection is upgraded. After that, both sides can send frames (text or binary) in either direction.

### Why Native `ws` Over Socket.io

Socket.io adds rooms, namespaces, automatic reconnection, and transport fallback (WebSocket → long-polling). But it also adds:

- **Protocol overhead**: Socket.io wraps messages in its own envelope format.
- **Bundle size**: ~20KB minified on the client.
- **Opinionated reconnection**: Hard to customize the reconnection strategy.

Blink chose the native `ws` library for the server and the browser's native `WebSocket` API for the client. This gives full control over the protocol, smaller bundles, and no magic. The tradeoff: we implement rooms, reconnection, and heartbeat ourselves. (See the chapters below for how.)

## How We Do It Here

The WebSocket system spans server-side code in `apps/api/src/websocket/` and client-side code in `apps/web/src/lib/websocket.ts`, with shared protocol definitions in `packages/websocket/`.

### Step 1: Server Bootstrap (`apps/api/src/websocket/ws.server.ts`)

```typescript
export function attachWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  setupHeartbeat(wss);

  wss.on("connection", (ws: WebSocket, req) => {
    const socket = ws as AuthenticatedSocket;
    socket.isAlive = true;
    socket.rooms = new Set();

    const auth = authenticateWS(req);
    if (!auth) {
      socket.close(4001, "Authentication failed");
      return;
    }

    socket.userId = auth.userId;
    socket.email = auth.email;
    socket.username = auth.username;
    socket.role = auth.role;

    presenceManager.userConnected(auth.userId, socket.userId);
    logger.info({ userId: auth.userId }, "WebSocket connected");

    socket.on("message", (data) => {
      handleMessage(socket, data.toString());
    });

    socket.on("close", () => {
      if (socket.userId) {
        presenceManager.userDisconnected(socket.userId);
        roomManager.leaveAllRooms(socket);
      }
    });

    socket.on("pong", () => {
      socket.isAlive = true;
    });
  });

  return wss;
}
```

Walkthrough:

1. **`new WebSocketServer({ server, path: "/ws" })`** — Attaches to the same HTTP server as Express. The path `/ws` means WebSocket connections go to `ws://localhost:5000/ws`.
2. **`authenticateWS(req)`** — Verifies the JWT before the connection is established. If invalid, the connection is closed immediately with code `4001`.
3. **Cast to `AuthenticatedSocket`** — Extends the base WebSocket with our custom fields (`userId`, `rooms`, `isAlive`).
4. **`presenceManager.userConnected()`** — Registers the user as online in Redis.
5. **Message routing** — Every incoming message goes to `handleMessage()`, the central event router.
6. **Cleanup on close** — Remove from presence, leave all rooms.

### Step 2: WebSocket Authentication (`apps/api/src/websocket/ws.auth.ts`)

```typescript
export function authenticateWS(req: IncomingMessage): {
  userId: string; email: string; username: string; role: string;
} | null {
  try {
    const url = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"));
    const token = url.searchParams.get("token") || extractTokenFromHeaders(req);

    if (!token) return null;

    const payload = verifyAccessToken(token);
    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.sub,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
```

The token is passed either as a query parameter (`ws://localhost:5000/ws?token=xxx`) or as an `Authorization: Bearer xxx` header. The query parameter approach is more common for WebSocket connections because the browser's WebSocket API doesn't support custom headers.

The same `verifyAccessToken` from `packages/auth` is used — the JWT chapter's verification logic applies here too.

### Step 3: The Event Gateway (`apps/api/src/websocket/ws.gateway.ts`)

This is the largest file (876 lines) — the central router for all WebSocket events. It's a big `switch` statement:

```typescript
export async function handleMessage(socket: AuthenticatedSocket, raw: string) {
  const message = parseMessage(raw);
  if (!message) {
    socket.send(JSON.stringify(createErrorMessage("INVALID_MESSAGE", "Invalid message format")));
    return;
  }

  switch (message.event) {
    case "message:send": { /* ... */ }
    case "message:edit": { /* ... */ }
    case "message:delete_for_me": { /* ... */ }
    case "message:delete_for_everyone": { /* ... */ }
    case "message:reply": { /* ... */ }
    case "message:forward": { /* ... */ }
    case "message:star": { /* ... */ }
    case "message:unstar": { /* ... */ }
    case "message:read": { /* ... */ }
    case "room:join": { /* ... */ }
    case "room:leave": { /* ... */ }
    case "room:create": { /* ... */ }
    case "room:update": { /* ... */ }
    case "room:add_members": { /* ... */ }
    case "room:remove_member": { /* ... */ }
    case "room:promote_admin": { /* ... */ }
    case "room:demote_admin": { /* ... */ }
    case "call:initiate": { /* ... */ }
    case "call:answer": { /* ... */ }
    case "call:reject": { /* ... */ }
    case "call:end": { /* ... */ }
    case "call:ice_candidate": { /* ... */ }
    case "status:create": { /* ... */ }
    case "status:view": { /* ... */ }
    case "user:typing": { /* ... */ }
    case "user:stop_typing": { /* ... */ }
    case "ping": { /* ... */ }
  }
}
```

Let's trace the most important event — **`message:send`**:

```typescript
case "message:send": {
  const data = message.data as {
    roomId: string;
    content: string;
    type?: string;
    replyToMessageId?: string;
    forwardedFromId?: string;
    mediaUrl?: string;
    mediaMeta?: Record<string, unknown>;
  };

  if (socket.userId && !(await isAcceptedMember(data.roomId, socket.userId))) {
    socket.send(JSON.stringify(createErrorMessage("FORBIDDEN", "You must be an accepted member")));
    return;
  }

  const savedMessage = await prisma.message.create({
    data: {
      content: data.content,
      type: data.type || "text",
      userId: socket.userId!,
      roomId: data.roomId,
      replyToMessageId: data.replyToMessageId,
      forwardedFromId: data.forwardedFromId,
      mediaUrl: data.mediaUrl,
      mediaMeta: data.mediaMeta,
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  });

  const broadcastMsg = createMessage("message:new", {
    roomId: data.roomId,
    message: {
      id: savedMessage.id,
      content: savedMessage.content,
      type: savedMessage.type,
      userId: savedMessage.userId,
      username: savedMessage.user.username,
      createdAt: savedMessage.createdAt.toISOString(),
      replyToMessageId: savedMessage.replyToMessageId,
      forwardedFromId: savedMessage.forwardedFromId,
      mediaUrl: savedMessage.mediaUrl,
      mediaMeta: savedMessage.mediaMeta,
    },
  });
  roomManager.broadcast(data.roomId, broadcastMsg);
  break;
}
```

Walkthrough:

1. **Parse the typed data** from the WebSocket envelope.
2. **Authorization check** — `isAcceptedMember()` queries `RoomMembership` to verify the sender is in the room and has accepted the invitation.
3. **Persist to database** — `prisma.message.create()` writes to the `messages` table.
4. **Broadcast** — `roomManager.broadcast()` sends the `message:new` event to every socket in the room.

### Step 4: Room Management (`apps/api/src/websocket/ws.rooms.ts`)

```typescript
export class RoomManager {
  private rooms = new Map<string, Set<AuthenticatedSocket>>();

  joinRoom(socket: AuthenticatedSocket, roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(socket);

    if (!socket.rooms) socket.rooms = new Set();
    socket.rooms.add(roomId);

    this.broadcast(roomId, createMessage("room:member_joined", {
      roomId,
      user: { id: socket.userId, username: socket.username },
    }), socket.userId);
  }

  broadcast(roomId: string, message: unknown, excludeUserId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const payload = JSON.stringify(message);
    for (const socket of room) {
      if (socket.userId !== excludeUserId && socket.readyState === 1) {
        socket.send(payload);
      }
    }
  }

  leaveAllRooms(socket: AuthenticatedSocket) {
    if (socket.rooms) {
      for (const roomId of socket.rooms) {
        this.leaveRoom(socket, roomId);
      }
    }
  }
}

export const roomManager = new RoomManager();
```

The **room-per-conversation** pattern:

- Each `Room` (conversation) in the database has a corresponding entry in the in-memory `rooms` Map.
- When a user opens a chat, the client sends `room:join`. The server adds their socket to the room's Set.
- When a message is sent, `broadcast()` iterates over the room's Set and sends to each socket.
- `excludeUserId` is used for events like `room:member_joined` — you don't want to tell yourself you joined.
- `socket.readyState === 1` checks the socket is still open (`1 = WebSocket.OPEN`).

### Step 5: Presence via Redis (`apps/api/src/websocket/ws.presence.ts`)

```typescript
export class PresenceManager {
  async userConnected(userId: string, socketId: string) {
    await redis.set("user:" + userId + ":online", socketId, "EX", 30);
  }

  async userDisconnected(userId: string) {
    await redis.del("user:" + userId + ":online");
  }

  async refreshPresence(userId: string, socketId: string) {
    await redis.expire("user:" + userId + ":online", 30);
  }

  async isOnline(userId: string): Promise<boolean> {
    const result = await redis.exists("user:" + userId + ":online");
    return result === 1;
  }

  async setTyping(roomId: string, userId: string) {
    await redis.set("typing:" + roomId + ":" + userId, "1", "EX", 5);
  }
}
```

Online status uses a Redis key with a **30-second TTL** (time-to-live). The heartbeat (see below) refreshes this key every 30 seconds. If the heartbeat stops (user disconnects), the key expires automatically — no explicit "go offline" message needed.

Typing indicators use a **5-second TTL**. The client sends `user:typing` while typing and `user:stop_typing` when they stop. The 5-second TTL is a safety net — if the client crashes, the typing indicator disappears within 5 seconds.

### Step 6: Heartbeat (`apps/api/src/websocket/ws.heartbeat.ts`)

```typescript
export function setupHeartbeat(wss: WebSocket.Server) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as AuthenticatedSocket;
      if (socket.isAlive === false) {
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, config.WS_HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(interval);
  });
}
```

The heartbeat is a ping/pong mechanism:

1. Every 30 seconds (`WS_HEARTBEAT_INTERVAL`), the server sends a `ping` to every connected socket.
2. It sets `isAlive = false` before pinging.
3. When the socket responds with `pong` (handled in `ws.server.ts`), `isAlive` is set back to `true`.
4. On the next heartbeat, if `isAlive` is still `false`, the socket never responded → it's dead → `terminate()`.

This detects zombie connections (TCP connections that dropped without a proper close handshake).

### Step 7: Shared Protocol (`packages/websocket/`)

**Event Constants** (`packages/websocket/src/events.ts`):

```typescript
export const WS_EVENTS = {
  CLIENT: {
    MESSAGE_SEND: "message:send",
    MESSAGE_EDIT: "message:edit",
    ROOM_JOIN: "room:join",
    ROOM_LEAVE: "room:leave",
    USER_TYPING: "user:typing",
    PING: "ping",
    // ... (30+ events)
  } as const,
  SERVER: {
    MESSAGE_NEW: "message:new",
    MESSAGE_EDITED: "message:edited",
    USER_TYPING: "user:typing",
    PONG: "pong",
    ERROR: "error",
    // ... (20+ events)
  } as const,
} as const;
```

Both client and server import from this shared package. This ensures event names are consistent — a typo in the client will cause a TypeScript error if the event name doesn't match.

**Protocol Helpers** (`packages/websocket/src/protocol.ts`):

```typescript
export function createMessage<T>(event: string, data: T): WSEnvelope<T> {
  return { event, data, timestamp: Date.now() };
}

export function createErrorMessage(
  code: string, message: string, requestId?: string,
): WSEnvelope<{ code: string; message: string }> {
  return { event: "error", data: { code, message }, timestamp: Date.now(), requestId };
}

export function parseMessage(raw: string): WSEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as WSEnvelope;
    if (typeof parsed.event !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
```

Every WebSocket message follows this envelope: `{ event, data, timestamp }`. This is a custom protocol — simpler than Socket.io's, tailored to our needs.

### Step 8: Client-Side WebSocket (`apps/web/src/lib/websocket.ts`)

```typescript
export class ChatSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private accessToken: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isIntentionalClose = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.isIntentionalClose = false;
    const url = `${WS_URL}?token=${encodeURIComponent(this.accessToken)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emitInternal("_connected");
    };

    this.ws.onclose = (event) => {
      this.emitInternal("_disconnected");
      if (this.isIntentionalClose) return;
      if (event.code === 4001) {
        this.emitInternal("_unauthorized");
        return;
      }
      this.scheduleReconnect();
    };
  }

  send<T extends keyof WSClientEvents>(event: T, data: WSClientEvents[T]) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
  }

  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => { this.listeners.get(event)?.delete(callback); };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => { this.connect(); }, delay);
  }
}
```

Key features:

- **Exponential backoff**: `1s, 2s, 4s, 8s, 16s, 30s, 30s, ...` up to 10 attempts. Prevents hammering the server when it's down.
- **`isIntentionalClose`**: When the user navigates away or logs out, `disconnect()` sets this flag to prevent reconnection.
- **`_unauthorized` event**: When the server closes with code `4001`, the client knows the token is expired and triggers a refresh (see SocketProvider below).
- **Type-safe `send()`**: The generic constraint `T extends keyof WSClientEvents` ensures you can only send events that exist in the type definitions.
- **`on()` returns an unsubscribe function**: The React hook pattern — call the return value to clean up the listener.

### Step 9: Socket Context (`apps/web/src/lib/socket-context.tsx`)

```typescript
export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, updateAccessToken, logout } = useAuth();
  const socketRef = useRef<ChatSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleUnauthorized = useCallback(async () => {
    const result = await refreshAction();
    if (result) {
      updateAccessToken(result.accessToken);
      socketRef.current?.updateToken(result.accessToken);
      socketRef.current?.reconnect();
    } else {
      logout();
    }
  }, [updateAccessToken, logout]);

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    const socket = new ChatSocket(accessToken);
    socketRef.current = socket;

    const unsubConnected = socket.on("_connected", () => setIsConnected(true));
    const unsubDisconnected = socket.on("_disconnected", () => setIsConnected(false));
    const unsubUnauthorized = socket.on("_unauthorized", () => {
      setIsConnected(false);
      handleUnauthorized();
    });

    socket.connect();
    return () => { /* cleanup */ };
  }, [accessToken, handleUnauthorized]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
```

The `SocketProvider` wraps the app and manages the WebSocket lifecycle:

- When `accessToken` changes (login, refresh, logout), the socket is reconnected or disconnected.
- On `_unauthorized`, it tries to refresh the token first. If that succeeds, it updates the socket's token and reconnects. If not, it logs the user out.
- `isConnected` drives the "Connecting..." banner in the chat UI.

### Step 10: The `useConversation` Hook (`apps/web/src/hooks/use-conversation.ts`)

This is the main hook that wires WebSocket events to React state:

```typescript
export function useConversation(roomId: string) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !roomId) return;

    const unsubMessageNew = socket.on(WS_EVENTS.SERVER.MESSAGE_NEW, (data) => {
      if (data.roomId === roomId) {
        const wsMsg = data.message as WsMessage;
        const msg: Message = { /* transform wsMsg to Message shape */ };
        setMessages((prev) => [...prev, msg]);
        if (wsMsg.userId !== user?.id) { playMessageSound(); }
      }
    });

    const unsubTyping = socket.on(WS_EVENTS.SERVER.USER_TYPING, (data) => {
      if (data.roomId === roomId && data.userId !== user?.id) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));
        // Auto-remove after 3 seconds
      }
    });

    socket.send(WS_EVENTS.CLIENT.ROOM_JOIN, { roomId });

    return () => {
      unsubMessageNew();
      unsubTyping();
      socket.send(WS_EVENTS.CLIENT.ROOM_LEAVE, { roomId });
    };
  }, [socket, roomId, user?.id]);

  const sendMessage = useCallback((content: string, options?) => {
    if (!socket || !content.trim()) return;
    socket.send(WS_EVENTS.CLIENT.MESSAGE_SEND, { roomId, content: content.trim(), ...options });
  }, [socket, roomId]);

  return { messages, typingUsers, sendMessage, /* ... */ };
}
```

Key patterns:

- **Event subscription cleanup**: Every `socket.on()` returns an unsubscribe function. The `useEffect` cleanup calls all of them + sends `room:leave`.
- **Room join/leave**: When the hook mounts, it joins the room. When it unmounts (user navigates away), it leaves.
- **Transform WS data to React state**: The server sends a flat `WsMessage` shape. The hook transforms it to the `Message` shape expected by the UI components.

## Common Mistakes / Gotchas

1. **Not handling reconnection in the client**: Without `scheduleReconnect()`, a dropped connection stays dropped. The user has to refresh the page.

2. **Forgetting `socket.readyState === 1` in broadcast**: Sending to a closed socket throws an error. Always check readyState before `send()`.

3. **Storing the access token in the WebSocket connection**: The token is passed as a URL parameter. It's visible in server logs and browser history. This is acceptable for short-lived tokens (15 min) but would be a problem for long-lived tokens.

4. **Not cleaning up room subscriptions**: If the client joins a room but doesn't leave it (e.g., navigation without unmount), messages from old rooms will still arrive and update stale state.

5. **Assuming WebSocket messages arrive in order**: TCP guarantees order, but if the client sends multiple messages rapidly, the server processes them sequentially (JavaScript is single-threaded). This is fine for chat but could be an issue for high-frequency data.

## Try It Yourself

1. Open two browser tabs, log in as different users.
2. User A creates a room with User B via the API.
3. Both users navigate to `/chat/<roomId>`.
4. User A sends a message — observe it appears instantly in both tabs.
5. User B starts typing — observe the "typing..." indicator in User A's tab.
6. Open the browser DevTools Network tab, filter to WS frames. Observe the JSON messages flowing.
7. Kill the API server (`Ctrl+C`). Watch the client reconnect with exponential backoff.
8. Restart the server. Watch the client reconnect and resume.
