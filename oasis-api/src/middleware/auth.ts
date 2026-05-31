import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, JwtAccessPayload } from "../utils/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtAccessPayload;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing or invalid token" },
    });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch {
    reply.status(401).send({
      success: false,
      error: { code: "TOKEN_EXPIRED", message: "Token expired or invalid" },
    });
    return;
  }
}
