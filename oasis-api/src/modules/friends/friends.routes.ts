import { FastifyInstance } from "fastify";
import { authMiddleware } from "../../middleware/index.js";
import { prisma } from "../../config/prisma.js";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().min(1).max(32),
});

const sendRequestSchema = z.object({
  nickname: z.string().min(1).max(32),
});

const chatSchema = z.object({
  content: z.string().min(1).max(1000),
});

function profileSelect() {
  return {
    id: true,
    nickname: true,
    avatarUrl: true,
    status: true,
  };
}

export async function friendsRoutes(app: FastifyInstance): Promise<void> {
  // Search users by nickname
  app.get(
    "/friends/search",
    { preHandler: [authMiddleware], config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { q } = searchSchema.parse(request.query);
      const users = await prisma.user.findMany({
        where: {
          nickname: { contains: q, mode: "insensitive" },
          id: { not: request.user!.sub },
        },
        select: profileSelect(),
        take: 20,
      });
      reply.send({ success: true, data: users });
    }
  );

  // Send friend request
  app.post(
    "/friends/request",
    { preHandler: [authMiddleware], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { nickname } = sendRequestSchema.parse(request.body);
      const target = await prisma.user.findFirst({
        where: { nickname },
        select: { id: true },
      });
      if (!target) {
        reply.status(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
        return;
      }
      if (target.id === request.user!.sub) {
        reply.status(400).send({
          success: false,
          error: { code: "SELF_REQUEST", message: "Cannot add yourself" },
        });
        return;
      }
      // Check existing friendship
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId: request.user!.sub, friendId: target.id },
            { userId: target.id, friendId: request.user!.sub },
          ],
        },
      });
      if (existing) {
        reply.status(400).send({
          success: false,
          error: { code: "ALREADY_FRIENDS", message: "Already friends" },
        });
        return;
      }
      // Check pending request
      const pending = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: request.user!.sub, receiverId: target.id, status: "pending" },
            { senderId: target.id, receiverId: request.user!.sub, status: "pending" },
          ],
        },
      });
      if (pending) {
        reply.status(400).send({
          success: false,
          error: { code: "REQUEST_EXISTS", message: "Friend request already exists" },
        });
        return;
      }
      // Check block
      const block = await prisma.friendBlock.findFirst({
        where: {
          OR: [
            { blockerId: request.user!.sub, blockedId: target.id },
            { blockerId: target.id, blockedId: request.user!.sub },
          ],
        },
      });
      if (block) {
        reply.status(400).send({
          success: false,
          error: { code: "BLOCKED", message: "Cannot send request" },
        });
        return;
      }
      await prisma.friendRequest.create({
        data: { senderId: request.user!.sub, receiverId: target.id },
      });
      reply.send({ success: true, data: { message: "Request sent" } });
    }
  );

  // List incoming requests
  app.get(
    "/friends/requests",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const requests = await prisma.friendRequest.findMany({
        where: { receiverId: request.user!.sub, status: "pending" },
        include: { sender: { select: profileSelect() } },
        orderBy: { createdAt: "desc" },
      });
      reply.send({ success: true, data: requests });
    }
  );

  // Accept friend request
  app.post(
    "/friends/accept",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.body);
      const req = await prisma.friendRequest.findFirst({
        where: { id, receiverId: request.user!.sub, status: "pending" },
      });
      if (!req) {
        reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Request not found" },
        });
        return;
      }
      await prisma.$transaction([
        prisma.friendRequest.update({ where: { id }, data: { status: "accepted" } }),
        prisma.friendship.create({ data: { userId: req.senderId, friendId: req.receiverId } }),
        prisma.friendship.create({ data: { userId: req.receiverId, friendId: req.senderId } }),
      ]);
      reply.send({ success: true, data: { message: "Friend added" } });
    }
  );

  // Decline friend request
  app.post(
    "/friends/decline",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.body);
      const req = await prisma.friendRequest.findFirst({
        where: { id, receiverId: request.user!.sub, status: "pending" },
      });
      if (!req) {
        reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Request not found" },
        });
        return;
      }
      await prisma.friendRequest.update({ where: { id }, data: { status: "declined" } });
      reply.send({ success: true, data: { message: "Request declined" } });
    }
  );

  // List friends with online status
  app.get(
    "/friends",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const friends = await prisma.friendship.findMany({
        where: { userId: request.user!.sub },
        include: {
          friend: {
            select: {
              ...profileSelect(),
              gameAccounts: { where: { isPrimary: true }, select: { username: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      const data = friends.map((f: Record<string, any>) => ({
        id: f.friend.id,
        nickname: f.friend.nickname,
        avatarUrl: f.friend.avatarUrl,
        status: f.friend.status,
        gameName: f.friend.gameAccounts[0]?.username || null,
        since: f.createdAt,
      }));
      reply.send({ success: true, data });
    }
  );

  // Remove friend
  app.delete(
    "/friends/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.$transaction([
        prisma.friendship.deleteMany({
          where: { userId: request.user!.sub, friendId: id },
        }),
        prisma.friendship.deleteMany({
          where: { userId: id, friendId: request.user!.sub },
        }),
        prisma.friendRequest.deleteMany({
          where: {
            OR: [
              { senderId: request.user!.sub, receiverId: id },
              { senderId: id, receiverId: request.user!.sub },
            ],
          },
        }),
      ]);
      reply.send({ success: true, data: { message: "Friend removed" } });
    }
  );

  // Block user
  app.post(
    "/friends/block",
    { preHandler: [authMiddleware], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { userId } = z.object({ userId: z.string().uuid() }).parse(request.body);
      if (userId === request.user!.sub) {
        reply.status(400).send({
          success: false,
          error: { code: "SELF_BLOCK", message: "Cannot block yourself" },
        });
        return;
      }
      // Verify target user exists
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!target) {
        reply.status(404).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
        return;
      }
      // Remove any existing friendship
      await prisma.$transaction([
        prisma.friendship.deleteMany({
          where: { userId: request.user!.sub, friendId: userId },
        }),
        prisma.friendship.deleteMany({
          where: { userId, friendId: request.user!.sub },
        }),
        prisma.friendRequest.deleteMany({
          where: {
            OR: [
              { senderId: request.user!.sub, receiverId: userId },
              { senderId: userId, receiverId: request.user!.sub },
            ],
          },
        }),
      ]);
      await prisma.friendBlock.upsert({
        where: { blockerId_blockedId: { blockerId: request.user!.sub, blockedId: userId } },
        update: {},
        create: { blockerId: request.user!.sub, blockedId: userId },
      });
      reply.send({ success: true, data: { message: "User blocked" } });
    }
  );

  // Unblock user
  app.post(
    "/friends/unblock",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { userId } = z.object({ userId: z.string().uuid() }).parse(request.body);
      await prisma.friendBlock.deleteMany({
        where: { blockerId: request.user!.sub, blockedId: userId },
      });
      reply.send({ success: true, data: { message: "User unblocked" } });
    }
  );

  // Check friendship helper
  async function assertFriendship(userId: string, friendId: string): Promise<boolean> {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });
    return !!friendship;
  }

  // Get chat messages with a friend
  app.get(
    "/friends/chat/:id",
    { preHandler: [authMiddleware], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!(await assertFriendship(request.user!.sub, id))) {
        reply.status(403).send({
          success: false,
          error: { code: "NOT_FRIENDS", message: "You are not friends with this user" },
        });
        return;
      }
      const messages = await prisma.chatMessage.findMany({
        where: {
          OR: [
            { senderId: request.user!.sub, recipientId: id },
            { senderId: id, recipientId: request.user!.sub },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
      // Mark as read
      await prisma.chatMessage.updateMany({
        where: { senderId: id, recipientId: request.user!.sub, read: false },
        data: { read: true },
      });
      reply.send({ success: true, data: messages });
    }
  );

  // Send a chat message
  app.post(
    "/friends/chat/:id",
    { preHandler: [authMiddleware], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!(await assertFriendship(request.user!.sub, id))) {
        reply.status(403).send({
          success: false,
          error: { code: "NOT_FRIENDS", message: "You are not friends with this user" },
        });
        return;
      }
      const { content } = chatSchema.parse(request.body);
      const msg = await prisma.chatMessage.create({
        data: { senderId: request.user!.sub, recipientId: id, content },
      });
      reply.send({ success: true, data: msg });
    }
  );

  // Get unread message count
  app.get(
    "/friends/unread",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const count = await prisma.chatMessage.count({
        where: { recipientId: request.user!.sub, read: false },
      });
      reply.send({ success: true, data: { unread: count } });
    }
  );
}
