import { config } from "@repo/config";
import { logger } from "@repo/logger";
import { prisma } from "@repo/database";
import { createApp } from "./app.js";
import { createServer } from "./server.js";
import { initPush } from "./lib/push.js";

async function main() {
  await prisma.$connect();
  logger.info("Connected to PostgreSQL");

  initPush();

  const app = createApp();
  const server = createServer(app);

  server.listen(config.PORT, () => {
    logger.info(`API server running on port ${config.PORT}`);
    logger.info(`Environment: ${config.NODE_ENV}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down...");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.fatal(err, "Failed to start server");
  process.exit(1);
});
