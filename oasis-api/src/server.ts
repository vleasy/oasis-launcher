import { env } from "./config/env.js";
import { closeRedis } from "./config/redis.js";
import { prisma } from "./config/prisma.js";
import { buildApp } from "./app.js";
import { logger } from "./utils/logger.js";

async function main() {
  const app = await buildApp();

  try {
    await prisma.$connect();
    logger.info("Database connected");

    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Server running at http://${env.HOST}:${env.PORT}`);
    logger.info(`API docs at http://localhost:${env.PORT}/docs`);
  } catch (error) {
    logger.fatal(error, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down...`);
      await app.close();
      await prisma.$disconnect();
      await closeRedis();
      process.exit(0);
    });
  }
}

main();
