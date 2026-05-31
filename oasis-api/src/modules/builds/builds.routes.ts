import { FastifyInstance } from "fastify";
import { authMiddleware } from "../../middleware/index.js";
import { prisma } from "../../config/prisma.js";
import { z } from "zod";
import crypto from "crypto";

const shareSchema = z.object({
  versionId: z.string().min(1),
  mcVersion: z.string().min(1),
  category: z.string().min(1),
});

function generateShareCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function buildsRoutes(app: FastifyInstance): Promise<void> {
  // Create a share code for a build
  app.post(
    "/builds/share",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const data = shareSchema.parse(request.body);
      let code: string;
      let attempts = 0;
      // Ensure unique code
      do {
        code = generateShareCode();
        attempts++;
      } while (await prisma.sharedBuild.findUnique({ where: { code } }) && attempts < 10);

      if (attempts >= 10) {
        reply.status(500).send({
          success: false,
          error: { code: "CODE_GEN_FAILED", message: "Failed to generate unique code" },
        });
        return;
      }

      const build = await prisma.sharedBuild.create({
        data: {
          userId: request.user!.sub,
          code,
          versionId: data.versionId,
          mcVersion: data.mcVersion,
          category: data.category,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      reply.send({ success: true, data: { code: build.code, expiresAt: build.expiresAt } });
    }
  );

  // Get shared build info by code (public)
  app.get(
    "/builds/shared/:code",
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const build = await prisma.sharedBuild.findUnique({
        where: { code },
        include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
      });
      if (!build || !build.isActive || build.expiresAt < new Date()) {
        if (build && !build.isActive) {
          reply.status(410).send({
            success: false,
            error: { code: "REVOKED", message: "Share code has been revoked" },
          });
          return;
        }
        reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Share code not found or expired" },
        });
        return;
      }
      reply.send({
        success: true,
        data: {
          code: build.code,
          versionId: build.versionId,
          mcVersion: build.mcVersion,
          category: build.category,
          author: build.user,
          expiresAt: build.expiresAt,
        },
      });
    }
  );

  // Install a shared build (mark download, return build info)
  app.post(
    "/builds/install/:code",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const build = await prisma.sharedBuild.findUnique({
        where: { code },
        include: { user: { select: { nickname: true } } },
      });
      if (!build || !build.isActive || build.expiresAt < new Date()) {
        reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Share code not found or expired" },
        });
        return;
      }
      // Return install manifest for the client
      reply.send({
        success: true,
        data: {
          versionId: build.versionId,
          mcVersion: build.mcVersion,
          category: build.category,
          author: build.user.nickname,
        },
      });
    }
  );

  // Revoke a share code
  app.delete(
    "/builds/share/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const build = await prisma.sharedBuild.findFirst({
        where: { id, userId: request.user!.sub },
      });
      if (!build) {
        reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Share not found" },
        });
        return;
      }
      await prisma.sharedBuild.update({
        where: { id },
        data: { isActive: false },
      });
      reply.send({ success: true, data: { message: "Share code revoked" } });
    }
  );

  // List user's active shares
  app.get(
    "/builds/shares",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const builds = await prisma.sharedBuild.findMany({
        where: { userId: request.user!.sub, isActive: true },
        orderBy: { createdAt: "desc" },
      });
      reply.send({ success: true, data: builds });
    }
  );
}
