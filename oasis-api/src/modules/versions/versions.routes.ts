import { FastifyInstance } from "fastify";
import { authMiddleware, adminMiddleware } from "../../middleware/index.js";
import { vanillaService } from "./vanilla.service.js";
import { customVersionService } from "./custom.service.js";
import { installService } from "./install.service.js";
import { AppError } from "../../utils/errors.js";

export async function versionsRoutes(app: FastifyInstance): Promise<void> {
  // --- Combined versions list ---
  app.get("/versions", async (request, reply) => {
    const query = request.query as {
      type?: string;
      page?: string;
      limit?: string;
      search?: string;
    };
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    let customVersions: Array<Record<string, unknown>> = [];
    let vanillaVersions: Array<Record<string, unknown>> = [];

    if (!query.type || query.type === "custom") {
      const result = await customVersionService.listCustomVersions(page, limit);
      customVersions = result.versions as unknown as Array<Record<string, unknown>>;
    }

    if (!query.type || query.type === "vanilla") {
      const raw = await vanillaService.listVanillaVersions();
      vanillaVersions = raw.map((v) => ({
        id: v.id,
        name: v.id,
        type: "vanilla",
        versionType: v.type,
        releaseTime: v.releaseTime,
      }));
    }

    let all = [...customVersions, ...vanillaVersions];

    if (query.search) {
      const q = query.search.toLowerCase();
      all = all.filter(
        (v) =>
          String(v.name).toLowerCase().includes(q) ||
          String(v.id).toLowerCase().includes(q)
      );
    }

    reply.send({
      success: true,
      data: {
        versions: all,
        total: all.length,
        page,
        limit,
      },
    });
  });

  // --- Vanilla endpoints ---
  app.get("/versions/vanilla", async (_request, reply) => {
    const versions = await vanillaService.listVanillaVersions();
    reply.send({ success: true, data: versions });
  });

  app.get("/versions/vanilla/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const details = await vanillaService.getVersionDetails(id);
      reply.send({ success: true, data: details });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      throw error;
    }
  });

  // --- Install endpoint ---
  app.get("/versions/:id/manifest", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { type?: string };
    const type = query.type || "vanilla";
    try {
      const manifest = await installService.getInstallManifest(id, type);
      reply.send({ success: true, data: manifest });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      throw error;
    }
  });

  app.get("/versions/vanilla/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const url = await vanillaService.getDownloadUrl(id);
      reply.redirect(url);
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      throw error;
    }
  });

  // --- Custom versions (public) ---
  app.get("/versions/custom", async (request, reply) => {
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const result = await customVersionService.listCustomVersions(page, limit);
    reply.send({ success: true, data: result });
  });

  app.get("/versions/custom/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const version = await customVersionService.getVersion(id);
      reply.send({ success: true, data: version });
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      throw error;
    }
  });

  app.get("/versions/custom/:id/download", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const { filePath, fileName, fileSize } =
        await customVersionService.getFilePath(id);
      reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
      reply.header("Content-Length", String(fileSize));
      reply.send(require("fs").createReadStream(filePath));
    } catch (error) {
      if (error instanceof AppError) {
        reply.status(error.statusCode).send({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      throw error;
    }
  });

  // --- Admin endpoints for custom versions ---
  app.post(
    "/admin/versions",
    { preHandler: [authMiddleware, adminMiddleware] },
    async (_request, reply) => {
      // In production, use @fastify/multipart for file upload handling
      reply.status(501).send({
        success: false,
        error: {
          code: "NOT_IMPLEMENTED",
          message: "File upload requires multipart handling — use POST with multipart/form-data",
        },
      });
    }
  );

  app.put(
    "/admin/versions/:id",
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as {
        name?: string;
        description?: string;
        changelog?: string;
        isPublic?: boolean;
      };
      try {
        const updated = await customVersionService.updateVersion(id, data);
        reply.send({ success: true, data: updated });
      } catch (error) {
        if (error instanceof AppError) {
          reply.status(error.statusCode).send({
            success: false,
            error: { code: error.code, message: error.message },
          });
          return;
        }
        throw error;
      }
    }
  );

  app.delete(
    "/admin/versions/:id",
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await customVersionService.deleteVersion(id);
        reply.send({ success: true, data: { message: "Version deleted" } });
      } catch (error) {
        if (error instanceof AppError) {
          reply.status(error.statusCode).send({
            success: false,
            error: { code: error.code, message: error.message },
          });
          return;
        }
        throw error;
      }
    }
  );
}
