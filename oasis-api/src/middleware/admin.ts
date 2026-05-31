import { FastifyRequest, FastifyReply } from "fastify";

export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user || request.user.role !== "admin") {
    reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Admin access required" },
    });
    return;
  }
}
