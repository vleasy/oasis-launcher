import { FastifyInstance } from "fastify";
import { authMiddleware } from "../../middleware/index.js";
import { prisma } from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { z } from "zod";
import { env } from "../../config/env.js";
import path from "path";
import fs from "fs";

const updateProfileSchema = z.object({
  nickname: z.string().min(2).max(32).optional(),
  language: z.string().length(2).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  status: z.string().max(100).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  favoriteVersions: z.array(z.string()).max(3).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const userSelect = {
  id: true,
  email: true,
  nickname: true,
  role: true,
  language: true,
  avatarUrl: true,
  status: true,
  bio: true,
  favoriteVersions: true,
  createdAt: true,
  _count: { select: { gameAccounts: true } },
};

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/profile",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user!.sub },
        select: userSelect,
      });
      if (!user) {
        reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });
        return;
      }
      reply.send({ success: true, data: user });
    }
  );

  app.put(
    "/profile",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = updateProfileSchema.parse(request.body);
      const user = await prisma.user.update({
        where: { id: request.user!.sub },
        data: parsed,
        select: userSelect,
      });
      reply.send({ success: true, data: user });
    }
  );

  app.put(
    "/profile/password",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = changePasswordSchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: { id: request.user!.sub },
        select: { password: true },
      });
      if (!user) {
        reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });
        return;
      }
      const valid = await comparePassword(parsed.currentPassword, user.password);
      if (!valid) {
        reply.status(400).send({
          success: false,
          error: { code: "WRONG_PASSWORD", message: "Current password is incorrect" },
        });
        return;
      }
      const hashed = await hashPassword(parsed.newPassword);
      await prisma.user.update({
        where: { id: request.user!.sub },
        data: { password: hashed },
      });
      reply.send({ success: true, data: { message: "Password updated" } });
    }
  );

  app.delete(
    "/profile",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      await prisma.user.delete({ where: { id: request.user!.sub } });
      reply.send({ success: true, data: { message: "Account deleted" } });
    }
  );

  // MIME magic bytes validation
  function validateImageMagic(bytes: Buffer): boolean {
    if (bytes.length < 4) return false;
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
    return false;
  }

  // Avatar upload
  app.post(
    "/profile/avatar",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        reply.status(400).send({
          success: false,
          error: { code: "NO_FILE", message: "No file uploaded" },
        });
        return;
      }
      const ext = path.extname(file.filename).toLowerCase();
      if (![".jpg", ".jpeg", ".png"].includes(ext)) {
        reply.status(400).send({
          success: false,
          error: { code: "INVALID_FORMAT", message: "Only JPEG and PNG files are allowed" },
        });
        return;
      }
      const avatarDir = path.join(env.UPLOAD_DIR, "..", "avatars");
      fs.mkdirSync(avatarDir, { recursive: true });
      const fileName = `${request.user!.sub}${ext}`;
      const filePath = path.join(avatarDir, fileName);
      const writeStream = fs.createWriteStream(filePath);
      let size = 0;
      let magicChecked = false;
      const magicBuffer = Buffer.alloc(4);
      let magicOffset = 0;
      for await (const chunk of file.file) {
        // Check magic bytes from first chunk
        if (!magicChecked) {
          const copyLen = Math.min(chunk.length, 4 - magicOffset);
          chunk.copy(magicBuffer, magicOffset, 0, copyLen);
          magicOffset += copyLen;
          if (magicOffset >= 4) {
            if (!validateImageMagic(magicBuffer)) {
              writeStream.destroy();
              fs.unlinkSync(filePath);
              reply.status(400).send({
                success: false,
                error: { code: "INVALID_MAGIC", message: "File is not a valid PNG or JPEG image" },
              });
              return;
            }
            magicChecked = true;
          }
        }
        size += chunk.length;
        if (size > 2 * 1024 * 1024) {
          writeStream.destroy();
          fs.unlinkSync(filePath);
          reply.status(400).send({
            success: false,
            error: { code: "FILE_TOO_LARGE", message: "File must be under 2 MB" },
          });
          return;
        }
        writeStream.write(chunk);
      }
      if (!magicChecked && magicOffset < 4) {
        writeStream.destroy();
        fs.unlinkSync(filePath);
        reply.status(400).send({
          success: false,
          error: { code: "FILE_TOO_SMALL", message: "File is too small to be a valid image" },
        });
        return;
      }
      writeStream.end();
      await new Promise<void>((resolve) => writeStream.on("finish", () => resolve()));
      const avatarUrl = `/uploads/avatars/${fileName}`;
      await prisma.user.update({
        where: { id: request.user!.sub },
        data: { avatarUrl },
      });
      reply.send({ success: true, data: { avatarUrl } });
    }
  );

  // Public profile
  app.get(
    "/profile/:id",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          status: true,
          bio: true,
          favoriteVersions: true,
          createdAt: true,
        },
      });
      if (!user) {
        reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });
        return;
      }
      reply.send({ success: true, data: user });
    }
  );
}
