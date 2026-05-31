import crypto from "crypto";
import { prisma } from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { AppError } from "../../utils/errors.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new AppError(409, "EMAIL_EXISTS", "Email already registered");
    }

    const hashed = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashed,
        nickname: input.nickname ?? input.email.split("@")[0],
      },
      select: { id: true, email: true, nickname: true, role: true },
    });

    const tokens = await this.generateTokens(user.id, user.role);
    return { user, ...tokens };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, password: true, nickname: true, role: true },
    });
    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const valid = await comparePassword(input.password, user.password);
    if (!valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const tokens = await this.generateTokens(user.id, user.role);
    return {
      user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (!stored) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token revoked");
    }

    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new AppError(401, "REFRESH_EXPIRED", "Refresh token expired");
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new AppError(401, "USER_NOT_FOUND", "User not found");
    }

    return this.generateTokens(user.id, user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  private async generateTokens(userId: string, role: string) {
    const accessToken = signAccessToken({ sub: userId, role });

    const jti = crypto.randomUUID();
    const refreshToken = signRefreshToken({ sub: userId, jti });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
