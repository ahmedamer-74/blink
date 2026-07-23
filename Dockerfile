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

# Copy everything from build stage (source + compiled + deps)
COPY --from=base /app ./

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["bun", "run", "start"]
