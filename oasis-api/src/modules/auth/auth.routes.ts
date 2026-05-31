import { FastifyInstance } from "fastify";
import { authService } from "./auth.service.js";
import { registerSchema, loginSchema, refreshSchema } from "./auth.schema.js";
import { authMiddleware } from "../../middleware/index.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/register",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const parsed = registerSchema.parse(request.body);
      try {
        const result = await authService.register(parsed);
        reply.status(201).send({ success: true, data: result });
      } catch (error) {
        if (error instanceof Error && "statusCode" in error) {
          const e = error as unknown as { statusCode: number; code: string; message: string };
          reply.status(e.statusCode).send({
            success: false,
            error: { code: e.code, message: e.message },
          });
          return;
        }
        throw error;
      }
    }
  );

  app.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const parsed = loginSchema.parse(request.body);
      try {
        const result = await authService.login(parsed);
        reply.send({ success: true, data: result });
      } catch (error) {
        if (error instanceof Error && "statusCode" in error) {
          const e = error as unknown as { statusCode: number; code: string; message: string };
          reply.status(e.statusCode).send({
            success: false,
            error: { code: e.code, message: e.message },
          });
          return;
        }
        throw error;
      }
    }
  );

  app.post("/auth/refresh", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = refreshSchema.parse(request.body);
    try {
      const result = await authService.refresh(parsed.refreshToken);
      reply.send({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && "statusCode" in error) {
        const e = error as unknown as { statusCode: number; code: string; message: string };
        reply.status(e.statusCode).send({
          success: false,
          error: { code: e.code, message: e.message },
        });
        return;
      }
      throw error;
    }
  });

  app.post(
    "/auth/logout",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken?: string };
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      reply.send({ success: true, data: null });
    }
  );
}
