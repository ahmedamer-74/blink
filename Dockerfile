FROM oven/bun:1 AS base
WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock turbo.json .npmrc ./

# Copy all workspace packages
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
FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package files and install production deps only
COPY package.json bun.lock ./
COPY packages/*/package.json ./packages/
RUN bun install --production

# Copy built API
COPY --from=base /app/apps/api/dist ./apps/api/dist

# Copy workspace packages (compiled output)
COPY --from=base /app/packages/auth/dist ./packages/auth/dist
COPY --from=base /app/packages/auth/package.json ./packages/auth/package.json
COPY --from=base /app/packages/config/dist ./packages/config/dist
COPY --from=base /app/packages/config/package.json ./packages/config/package.json
COPY --from=base /app/packages/database/dist ./packages/database/dist
COPY --from=base /app/packages/database/prisma ./packages/database/prisma
COPY --from=base /app/packages/database/package.json ./packages/database/package.json
COPY --from=base /app/packages/logger/dist ./packages/logger/dist
COPY --from=base /app/packages/logger/package.json ./packages/logger/package.json
COPY --from=base /app/packages/types/dist ./packages/types/dist
COPY --from=base /app/packages/types/package.json ./packages/types/package.json
COPY --from=base /app/packages/utils/dist ./packages/utils/dist
COPY --from=base /app/packages/utils/package.json ./packages/utils/package.json
COPY --from=base /app/packages/validation/dist ./packages/validation/dist
COPY --from=base /app/packages/validation/package.json ./packages/validation/package.json
COPY --from=base /app/packages/websocket/dist ./packages/websocket/dist
COPY --from=base /app/packages/websocket/package.json ./packages/websocket/package.json

# Copy node_modules with .prisma client
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=base /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["bun", "run", "start"]
