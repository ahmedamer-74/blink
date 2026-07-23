FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g bun@1.3.14

# Copy root workspace files
COPY package.json bun.lock turbo.json .npmrc ./

# Copy all workspace packages (source + configs)
COPY packages/ ./packages/

# Copy API app source
COPY apps/api/ ./apps/api/

# Install all dependencies (monorepo)
RUN bun install

# Generate Prisma client
RUN cd packages/database && bunx prisma generate

# Build the API and its workspace dependencies
RUN ./node_modules/.bin/turbo run build --filter=api...

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy node_modules from build stage
COPY --from=base /app/node_modules ./node_modules

# Copy built API
COPY --from=base /app/apps/api/dist ./apps/api/dist

# Copy workspace packages (source + dist + package.json)
COPY --from=base /app/packages/auth/src ./packages/auth/src
COPY --from=base /app/packages/auth/dist ./packages/auth/dist
COPY --from=base /app/packages/auth/package.json ./packages/auth/package.json

COPY --from=base /app/packages/config/src ./packages/config/src
COPY --from=base /app/packages/config/dist ./packages/config/dist
COPY --from=base /app/packages/config/package.json ./packages/config/package.json

COPY --from=base /app/packages/database/src ./packages/database/src
COPY --from=base /app/packages/database/dist ./packages/database/dist
COPY --from=base /app/packages/database/prisma ./packages/database/prisma
COPY --from=base /app/packages/database/package.json ./packages/database/package.json

COPY --from=base /app/packages/logger/src ./packages/logger/src
COPY --from=base /app/packages/logger/dist ./packages/logger/dist
COPY --from=base /app/packages/logger/package.json ./packages/logger/package.json

COPY --from=base /app/packages/types/src ./packages/types/src
COPY --from=base /app/packages/types/dist ./packages/types/dist
COPY --from=base /app/packages/types/package.json ./packages/types/package.json

COPY --from=base /app/packages/utils/src ./packages/utils/src
COPY --from=base /app/packages/utils/dist ./packages/utils/dist
COPY --from=base /app/packages/utils/package.json ./packages/utils/package.json

COPY --from=base /app/packages/validation/src ./packages/validation/src
COPY --from=base /app/packages/validation/dist ./packages/validation/dist
COPY --from=base /app/packages/validation/package.json ./packages/validation/package.json

COPY --from=base /app/packages/websocket/src ./packages/websocket/src
COPY --from=base /app/packages/websocket/dist ./packages/websocket/dist
COPY --from=base /app/packages/websocket/package.json ./packages/websocket/package.json

# Copy root package.json for workspace resolution
COPY --from=base /app/package.json ./package.json

USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["sh", "-c", "cd packages/database && ../../node_modules/.bin/prisma migrate deploy && cd /app && node apps/api/dist/index.js"]
