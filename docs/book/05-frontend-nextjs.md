# Chapter 05: Frontend (Next.js)

---

## What Problem Does This Solve?

The frontend is the user-facing part of Blink — the chat interface, login screens, and conversation list. It needs to:

1. **Render fast** — Pages should load quickly, especially on mobile.
2. **Stay real-time** — Messages, typing indicators, and presence updates must appear instantly.
3. **Manage auth state** — The user's login state needs to persist across navigation without re-fetching on every page.
4. **Talk to the backend** — API calls need to go through the backend, handling cookies and tokens correctly.

Next.js 16 with React 19 provides the framework. This chapter explains how Blink uses its features.

## How It Works in General

### Server Actions (React 19)

Server Actions are functions marked with `"use server"` that run on the Next.js server, not in the browser. They're the modern replacement for API routes for form submissions. The browser calls them like regular async functions, but the code executes server-side.

**Why use them?** Server Actions can access cookies, environment variables, and server-only libraries without exposing them to the client. They also work with React's `useActionState` for built-in loading states and error handling.

### React Context for State

React Context provides a way to pass data through the component tree without prop drilling. Blink uses it for:

- **Auth state** (`AuthProvider`): User info + access token.
- **Socket state** (`SocketProvider`): WebSocket connection + online status.

### API Proxying

The frontend runs on port 3000, the API on port 5000. Browsers block cross-origin requests, so Next.js proxies API calls through its own server.

## How We Do It Here

### App Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx          Root layout — wraps everything in Providers
│   ├── page.tsx            Landing/redirect
│   ├── login/page.tsx      Login page
│   ├── register/page.tsx   Registration page
│   └── chat/
│       ├── layout.tsx      Chat layout — auth guard + sidebar
│       ├── page.tsx        Empty state ("Select a conversation")
│       ├── new/page.tsx    New conversation (user search)
│       └── [conversationId]/page.tsx  Active chat
├── components/
│   ├── providers.tsx       AuthProvider > SocketProvider wrapper
│   ├── auth/               LoginForm, RegisterForm
│   ├── chat/               ConversationList, MessageThread, MessageInput, etc.
│   └── ui/                 Radix-based primitives (Button, Input, Card, Avatar)
├── hooks/
│   └── use-conversation.ts WebSocket event wiring for a single room
└── lib/
    ├── auth-context.tsx    Auth state (user + token)
    ├── socket-context.tsx  WebSocket connection management
    ├── websocket.ts        ChatSocket class (WS client)
    ├── actions/auth.ts     Server Actions for auth
    ├── actions/rooms.ts    (Deprecated — was server actions for rooms)
    ├── api.ts              Client-side API helper
    ├── types.ts            Frontend type definitions
    └── utils.ts            cn() utility for className merging
```

### The Provider Tree (`apps/web/src/components/providers.tsx`)

```typescript
"use client";

import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SocketProvider>{children}</SocketProvider>
    </AuthProvider>
  );
}
```

This wraps the entire app in two context providers:

1. **`AuthProvider`** (outermost): Manages user state. Must be outside SocketProvider because SocketProvider depends on `accessToken` from AuthProvider.
2. **`SocketProvider`**: Manages the WebSocket. Uses `accessToken` to authenticate the connection. When the token refreshes, the socket reconnects.

The root layout uses this:

```typescript
// apps/web/src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="h-dvh overflow-hidden antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### The API Proxy (`apps/web/next.config.ts`)

```typescript
const nextConfig: NextConfig = {
  transpilePackages: ["@repo/types", "@repo/validation", "@repo/websocket"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
};
```

Two things:

1. **`transpilePackages`**: Next.js normally doesn't compile packages in `node_modules`. These workspace packages are TypeScript source (not pre-compiled), so we tell Next.js to transpile them.

2. **`rewrites`**: Any request to `/api/*` on the Next.js server is transparently proxied to `http://localhost:5000/api/*`. This means the browser makes same-origin requests (to port 3000) and Next.js handles the cross-origin part server-side.

### Server Actions for Auth (`apps/web/src/lib/actions/auth.ts`)

```typescript
"use server";

import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | { success: true; accessToken: string; user: AuthResponseData["user"] }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const { json, setCookie } = await apiRequest<AuthResponseData>("/api/v1/auth/login", { email, password });
    await forwardCookie(setCookie);
    return { success: true, accessToken: json.data!.accessToken, user: json.data!.user };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "An unexpected error occurred" };
  }
}
```

The `"use server"` directive makes this a Server Action — it runs on the Next.js server. Key points:

- **`apiRequest()`** calls the Express API directly (server-to-server, no CORS issues).
- **`forwardCookie()`** extracts the `Set-Cookie` header from the API response and sets it on Next.js's cookie store. This is critical: the browser can't see the API's Set-Cookie header directly (it goes server-to-server), so the Server Action must explicitly forward it.
- **Return value**: The access token and user object are returned to the client as the action's result. The refresh token stays in the cookie (httpOnly, not accessible to JavaScript).

The `hydrateAuth` function handles page-load re-authentication:

```typescript
export async function hydrateAuth(): Promise<{ accessToken: string; user: AuthResponseData["user"] } | null> {
  try {
    const refreshResult = await refreshAction();
    if (!refreshResult) return null;

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${refreshResult.accessToken}` },
    });

    const json = (await res.json()) as ApiResponse<AuthResponseData["user"]>;
    if (!json.success || !res.ok || !json.data) return null;

    return { accessToken: refreshResult.accessToken, user: json.data };
  } catch {
    return null;
  }
}
```

This runs once on mount. It refreshes the access token (using the httpOnly cookie), then fetches the user profile. If either fails, the user is treated as logged out.

### The Auth Context (`apps/web/src/lib/auth-context.tsx`)

```typescript
"use client";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    hydrateAuth().then((result) => {
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
      }
      setIsLoading(false);
    });
  }, []);

  const setAuth = useCallback((u: AuthUser, token: string) => {
    setUser(u);
    setAccessToken(token);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!accessToken && !!user,
        isLoading,
        setAuth,
        updateAccessToken: (token) => setAccessToken(token),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

The auth state is:

- **`user`**: `{ id, email, username, role }` or `null`.
- **`accessToken`**: The JWT string, stored in memory only (not localStorage, not cookies).
- **`isLoading`**: `true` during the initial `hydrateAuth()` call. Prevents flash of login page.
- **`isAuthenticated`**: Derived — `!!accessToken && !!user`. Both must be truthy.

The `isLoading` state is important for the chat layout:

```typescript
// apps/web/src/app/chat/layout.tsx
if (isLoading) {
  return <div className="flex h-screen items-center justify-center">...</div>;
}
if (!isAuthenticated) return null; // will redirect via useEffect
```

Without this, the chat layout would flash briefly before the auth check completes and redirects to `/login`.

### The Chat Layout (`apps/web/src/app/chat/layout.tsx`)

```typescript
"use client";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-dvh">
      {/* Sidebar */}
      <aside className="flex h-full w-full flex-col border-r md:w-[400px]">
        <ConversationList onOpenChat={() => setShowChat(true)} />
      </aside>

      {/* Chat panel */}
      <main className="flex h-full flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
```

The layout is a `"use client"` component because it uses `useAuth()` and `useRouter()`. It renders the sidebar (conversation list) and the main chat panel. The `children` prop is the conversation page (from `[conversationId]/page.tsx`).

### The `useConversation` Hook (`apps/web/src/hooks/use-conversation.ts`)

This is the bridge between the WebSocket and React state for a single conversation:

```typescript
export function useConversation(roomId: string) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socket || !roomId) return;

    setIsConnected(socket.connected);

    const unsubMessageNew = socket.on(WS_EVENTS.SERVER.MESSAGE_NEW, (data) => {
      if (data.roomId === roomId) {
        // Transform flat WS message to Message shape
        const msg: Message = { ... };
        setMessages((prev) => [...prev, msg]);
        if (wsMsg.userId !== user?.id) { playMessageSound(); }
      }
    });

    socket.send(WS_EVENTS.CLIENT.ROOM_JOIN, { roomId });

    return () => {
      unsubMessageNew();
      socket.send(WS_EVENTS.CLIENT.ROOM_LEAVE, { roomId });
    };
  }, [socket, roomId, user?.id]);

  const sendMessage = useCallback((content: string, options?) => {
    socket.send(WS_EVENTS.CLIENT.MESSAGE_SEND, { roomId, content: content.trim(), ...options });
  }, [socket, roomId]);

  return { messages, typingUsers, isConnected, sendMessage, /* ... */ };
}
```

The hook:

1. **Subscribes to WS events** for the current room.
2. **Joins the room** on mount, leaves on unmount.
3. **Returns a `sendMessage` function** that the `MessageInput` component calls.
4. **Exposes `messages` and `typingUsers`** for the `MessageThread` component to render.

### Next.js 16 App Router Conventions

The conversation page uses the App Router's dynamic route:

```typescript
// apps/web/src/app/chat/[conversationId]/page.tsx
"use client";

export default function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params);
  const router = useRouter();
  return <MessageThread roomId={conversationId} onBack={() => router.push("/chat")} />;
}
```

Note `params` is a `Promise` in Next.js 16 (previously it was a plain object). The `use()` hook unwraps it. The `conversationId` is the room's UUID from the URL.

## Common Mistakes / Gotchas

1. **Using Server Components for auth-dependent UI**: The root layout is a Server Component, but anything using `useAuth()` must be a Client Component (`"use client"`). The pattern is: Server Component for structure, Client Component for interactivity.

2. **Not handling `isLoading`**: Without the loading state, the chat layout renders before auth is resolved, causing a flash of the login redirect. Always check `isLoading` before checking `isAuthenticated`.

3. **Forgetting to clean up WebSocket subscriptions**: If you subscribe to an event in `useEffect` but don't unsubscribe in the cleanup, you'll get stale state updates from old rooms. The `useConversation` hook handles this correctly.

4. **Accessing cookies in Client Components**: Cookies are only accessible in Server Components and Server Actions. If you need the refresh token in a Client Component, call a Server Action that reads the cookie.

5. **`params` as a Promise**: In Next.js 16, `params` is `Promise<{ conversationId: string }>`, not `{ conversationId: string }`. Using `use(params)` or `await params` is required. Forgetting this gives you a pending Promise instead of the actual ID.

## Try It Yourself

1. Add a new page at `apps/web/src/app/settings/page.tsx` that displays the current user's info from `useAuth()`.
2. Add a link to it in the chat sidebar header (next to the logout button).
3. Verify it works: navigate to `/settings`, see your user info, navigate back to `/chat`.
4. This exercises: auth context access, Next.js routing, and the layout system.
