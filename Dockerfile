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

# Copy node_modules from build stage (third-party deps only)
COPY --from=base /app/node_modules ./node_modules

# Copy built API
COPY --from=base /app/apps/api/dist ./apps/api/dist

# Copy workspace packages
COPY --from=base /app/packages/auth ./packages/auth
COPY --from=base /app/packages/config ./packages/config
COPY --from=base /app/packages/database ./packages/database
COPY --from=base /app/packages/logger ./packages/logger
COPY --from=base /app/packages/types ./packages/types
COPY --from=base /app/packages/utils ./packages/utils
COPY --from=base /app/packages/validation ./packages/validation
COPY --from=base /app/packages/websocket ./packages/websocket

# Create workspace symlinks in node_modules (replaces bun's workspace links)
RUN mkdir -p node_modules/@repo && \
    ln -sf ../../packages/auth node_modules/@repo/auth && \
    ln -sf ../../packages/config node_modules/@repo/config && \
    ln -sf ../../packages/database node_modules/@repo/database && \
    ln -sf ../../packages/logger node_modules/@repo/logger && \
    ln -sf ../../packages/types node_modules/@repo/types && \
    ln -sf ../../packages/utils node_modules/@repo/utils && \
    ln -sf ../../packages/validation node_modules/@repo/validation && \
    ln -sf ../../packages/websocket node_modules/@repo/websocket

# Copy root package.json for workspace resolution
COPY --from=base /app/package.json ./package.json

USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "apps/api/dist/index.js"]
