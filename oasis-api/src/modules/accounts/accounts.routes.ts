import { FastifyInstance } from "fastify";
import { authMiddleware } from "../../middleware/index.js";
import { prisma } from "../../config/prisma.js";
import { z } from "zod";

const createAccountSchema = z.object({
  type: z.enum(["microsoft", "offline"]),
  username: z.string().min(2).max(32).optional(),
});

export async function accountsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  app.get("/accounts", async (request, reply) => {
    const accounts = await prisma.gameAccount.findMany({
      where: { userId: request.user!.sub },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        username: true,
        microsoftId: true,
        isPrimary: true,
        createdAt: true,
      },
    });
    reply.send({ success: true, data: accounts });
  });

  app.post("/accounts", async (request, reply) => {
    const parsed = createAccountSchema.parse(request.body);

    if (parsed.type === "offline" && !parsed.username) {
      reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Username is required for offline accounts",
        },
      });
      return;
    }

    const accountCount = await prisma.gameAccount.count({
      where: { userId: request.user!.sub },
    });

    const account = await prisma.gameAccount.create({
      data: {
        userId: request.user!.sub,
        type: parsed.type,
        username: parsed.type === "offline" ? parsed.username! : null,
        microsoftId: parsed.type === "microsoft" ? null : null,
        isPrimary: accountCount === 0,
      },
      select: {
        id: true,
        type: true,
        username: true,
        isPrimary: true,
        createdAt: true,
      },
    });
    reply.status(201).send({ success: true, data: account });
  });

  app.delete("/accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await prisma.gameAccount.findFirst({
      where: { id, userId: request.user!.sub },
    });
    if (!account) {
      reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Account not found" },
      });
      return;
    }
    await prisma.gameAccount.delete({ where: { id } });
    reply.send({ success: true, data: { message: "Account removed" } });
  });

  app.put("/accounts/:id/primary", async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await prisma.gameAccount.findFirst({
      where: { id, userId: request.user!.sub },
    });
    if (!account) {
      reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Account not found" },
      });
      return;
    }
    await prisma.gameAccount.updateMany({
      where: { userId: request.user!.sub, isPrimary: true },
      data: { isPrimary: false },
    });
    await prisma.gameAccount.update({
      where: { id },
      data: { isPrimary: true },
    });
    reply.send({ success: true, data: { message: "Primary account updated" } });
  });
}
