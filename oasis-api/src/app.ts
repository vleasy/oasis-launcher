import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastifyStatic from "@fastify/static";
import multipart from "@fastify/multipart";
import path from "path";
import fs from "fs";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { userRoutes } from "./modules/user/user.routes.js";
import { accountsRoutes } from "./modules/accounts/accounts.routes.js";
import { versionsRoutes } from "./modules/versions/versions.routes.js";
import { friendsRoutes } from "./modules/friends/friends.routes.js";
import { buildsRoutes } from "./modules/builds/builds.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    bodyLimit: 1048576,
  });

  // --- Plugins ---
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024 },
  });

  // Serve uploaded files (avatars)
  const uploadsDir = path.resolve(env.UPLOAD_DIR, "..");
  fs.mkdirSync(uploadsDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
  });

  // --- Swagger ---
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Oasis Launcher API",
        description: "Backend API for the Oasis Minecraft Launcher",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  // --- Health check ---
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // --- Routes ---
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(userRoutes, { prefix: "/api" });
  await app.register(accountsRoutes, { prefix: "/api" });
  await app.register(versionsRoutes, { prefix: "/api" });
  await app.register(friendsRoutes, { prefix: "/api" });
  await app.register(buildsRoutes, { prefix: "/api" });

  return app;
}
