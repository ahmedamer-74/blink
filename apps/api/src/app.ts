import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { config } from "@repo/config";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { globalRateLimiter } from "./middleware/rateLimiter.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { roomsRoutes } from "./modules/rooms/rooms.routes.js";
import { messagesRoutes } from "./modules/messages/messages.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: config.CORS_ORIGINS.split(","),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);
  app.use(globalRateLimiter);

  app.get("/", (_req, res) => {
    res.type("html").send(DOCS_HTML);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const prefix = config.API_PREFIX;
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, usersRoutes);
  app.use(`${prefix}/rooms`, roomsRoutes);
  app.use(`${prefix}/messages`, messagesRoutes);
  app.use(`${prefix}/notifications`, notificationsRoutes);

  app.use(errorHandler);

  return app;
}

const DOCS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blink API</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #0f1117; color: #e1e4e8; line-height: 1.6;
      min-height: 100vh;
    }
    .hero {
      text-align: center; padding: 80px 24px 48px;
      background: linear-gradient(135deg, #1a1e2e 0%, #0f1117 100%);
      border-bottom: 1px solid #21262d;
    }
    .hero h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 12px; color: #fff; }
    .hero p { color: #8b949e; font-size: 1.1rem; max-width: 500px; margin: 0 auto; }
    .badge { display: inline-block; background: #238636; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin-top: 16px; }
    .container { max-width: 900px; margin: 0 auto; padding: 48px 24px; }
    .section { margin-bottom: 48px; }
    .section h2 { font-size: 1.4rem; color: #58a6ff; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #21262d; }
    .endpoints { display: grid; gap: 12px; }
    .endpoint {
      background: #161b22; border: 1px solid #21262d; border-radius: 8px;
      padding: 16px 20px; display: flex; align-items: center; gap: 12px;
      transition: border-color 0.2s;
    }
    .endpoint:hover { border-color: #58a6ff; }
    .method {
      font-family: "SF Mono", SFMono-Regular, Consolas, monospace;
      font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 4px;
      min-width: 56px; text-align: center; text-transform: uppercase;
    }
    .method.get { background: #1a3a2a; color: #3fb950; }
    .method.post { background: #1a2a3a; color: #58a6ff; }
    .method.patch { background: #3a2a1a; color: #d29922; }
    .method.delete { background: #3a1a1a; color: #f85149; }
    .path { font-family: monospace; color: #e1e4e8; font-size: 0.9rem; }
    .desc { color: #8b949e; font-size: 0.85rem; margin-left: auto; }
    .auth-badge { background: #30363d; color: #8b949e; font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; }
    .auth-badge.required { background: #3d1f00; color: #d29922; }
    .ws-info {
      background: #161b22; border: 1px solid #21262d; border-radius: 8px;
      padding: 20px; margin-top: 12px;
    }
    .ws-info code {
      background: #0d1117; padding: 2px 6px; border-radius: 4px;
      font-family: monospace; color: #79c0ff; font-size: 0.85rem;
    }
    .ws-info p { color: #8b949e; margin-top: 8px; }
    footer {
      text-align: center; padding: 32px; color: #484f58; font-size: 0.8rem;
      border-top: 1px solid #21262d;
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1>Blink API</h1>
    <p>Production-ready REST + WebSocket API for real-time messaging</p>
    <span class="badge">v1.0.0</span>
  </div>
  <div class="container">

    <div class="section">
      <h2>Authentication</h2>
      <div class="endpoints">
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/v1/auth/register</span><span class="desc">Create account</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/v1/auth/login</span><span class="desc">Get tokens</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/v1/auth/refresh</span><span class="desc">Rotate refresh token</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/v1/auth/logout</span><span class="auth-badge required">Auth</span><span class="desc">Revoke tokens</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Users &amp; Profile</h2>
      <div class="endpoints">
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/v1/users/me</span><span class="auth-badge required">Auth</span><span class="desc">Get current user</span></div>
        <div class="endpoint"><span class="method patch">PATCH</span><span class="path">/api/v1/users/me</span><span class="auth-badge required">Auth</span><span class="desc">Update profile</span></div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/v1/users</span><span class="auth-badge required">Admin</span><span class="desc">List all users</span></div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/v1/users/:id</span><span class="auth-badge required">Auth</span><span class="desc">Get user by ID</span></div>
        <div class="endpoint"><span class="method patch">PATCH</span><span class="path">/api/v1/users/:id</span><span class="auth-badge required">Auth</span><span class="desc">Update user</span></div>
        <div class="endpoint"><span class="method delete">DELETE</span><span class="path">/api/v1/users/:id</span><span class="auth-badge required">Admin</span><span class="desc">Delete user</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Rooms</h2>
      <div class="endpoints">
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/v1/rooms</span><span class="auth-badge required">Auth</span><span class="desc">List my rooms</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/v1/rooms</span><span class="auth-badge required">Auth</span><span class="desc">Create room</span></div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/v1/rooms/:id</span><span class="auth-badge required">Auth</span><span class="desc">Get room details</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/v1/rooms/:id/join</span><span class="auth-badge required">Auth</span><span class="desc">Join room</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/v1/rooms/:id/leave</span><span class="auth-badge required">Auth</span><span class="desc">Leave room</span></div>
        <div class="endpoint"><span class="method delete">DELETE</span><span class="path">/api/v1/rooms/:id</span><span class="auth-badge required">Auth</span><span class="desc">Delete room (owner)</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Messages</h2>
      <div class="endpoints">
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/v1/messages/rooms/:roomId</span><span class="auth-badge required">Auth</span><span class="desc">Get messages (paginated)</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/v1/messages/rooms/:roomId</span><span class="auth-badge required">Auth</span><span class="desc">Send message</span></div>
        <div class="endpoint"><span class="method patch">PATCH</span><span class="path">/api/v1/messages/:id</span><span class="auth-badge required">Auth</span><span class="desc">Edit message</span></div>
        <div class="endpoint"><span class="method delete">DELETE</span><span class="path">/api/v1/messages/:id</span><span class="auth-badge required">Auth</span><span class="desc">Delete message</span></div>
      </div>
    </div>

    <div class="section">
      <h2>WebSocket</h2>
      <div class="ws-info">
        <p>Connect to <code>ws://localhost:3001/ws?token=&lt;accessToken&gt;</code></p>
        <p style="margin-top: 12px;"><strong>Events:</strong></p>
        <p><code>message:send</code> &mdash; Send a message &nbsp;|&nbsp;
           <code>room:join</code> / <code>room:leave</code> &mdash; Join or leave a room &nbsp;|&nbsp;
           <code>user:typing</code> &mdash; Typing indicator</p>
        <p style="margin-top: 12px;"><strong>Server pushes:</strong> <code>message:new</code>, <code>user:connected</code>, <code>user:disconnected</code>, <code>presence:online</code>, <code>pong</code></p>
      </div>
    </div>

    <div class="section">
      <h2>System</h2>
      <div class="endpoints">
        <div class="endpoint"><span class="method get">GET</span><span class="path">/health</span><span class="desc">Health check</span></div>
      </div>
    </div>

  </div>
  <footer>Blink API &mdash; Express + TypeScript + Prisma + Redis + WebSocket</footer>
</body>
</html>`;
