import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/errors.js";

export class CustomVersionService {
  async uploadVersion(
    file: { filename: string; filepath: string; filesize: number },
    metadata: {
      name: string;
      description?: string;
      minecraftVersion: string;
      changelog?: string;
      isPublic?: boolean;
    }
  ) {
    if (!file.filename.endsWith(".zip")) {
      throw new AppError(400, "INVALID_FILE", "Only ZIP files are allowed");
    }

    if (file.filesize > env.MAX_FILE_SIZE) {
      throw new AppError(400, "FILE_TOO_LARGE", "File exceeds maximum size (2GB)");
    }

    const sha256 = await this.computeSha256(file.filepath);

    const uploadDir = path.resolve(env.UPLOAD_DIR);
    const uniqueName = `${crypto.randomUUID()}-${file.filename}`;
    const destPath = path.join(uploadDir, uniqueName);

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.rename(file.filepath, destPath);

    const version = await prisma.customVersion.create({
      data: {
        name: metadata.name,
        description: metadata.description ?? null,
        minecraftVersion: metadata.minecraftVersion,
        changelog: metadata.changelog ?? null,
        fileUrl: `/api/versions/custom/${uniqueName}/download`,
        fileName: uniqueName,
        fileSize: file.filesize,
        sha256,
        isPublic: metadata.isPublic ?? false,
      },
    });

    logger.info({ versionId: version.id, name: metadata.name }, "Custom version uploaded");

    return version;
  }

  async listCustomVersions(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [versions, total] = await Promise.all([
      prisma.customVersion.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          minecraftVersion: true,
          downloadCount: true,
          fileSize: true,
          createdAt: true,
        },
      }),
      prisma.customVersion.count({ where: { isPublic: true } }),
    ]);

    return { versions, total, page, limit };
  }

  async getVersion(id: string) {
    const version = await prisma.customVersion.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        minecraftVersion: true,
        changelog: true,
        fileSize: true,
        sha256: true,
        downloadCount: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!version || !version.isPublic) {
      throw new AppError(404, "NOT_FOUND", "Version not found");
    }
    return version;
  }

  async getFilePath(versionId: string): Promise<{ filePath: string; fileName: string; fileSize: number }> {
    const version = await prisma.customVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || !version.isPublic) {
      throw new AppError(404, "NOT_FOUND", "Version not found");
    }

    await prisma.customVersion.update({
      where: { id: versionId },
      data: { downloadCount: { increment: 1 } },
    });

    const filePath = path.resolve(env.UPLOAD_DIR, version.fileName);
    return {
      filePath,
      fileName: version.name.endsWith(".zip") ? version.name : `${version.name}.zip`,
      fileSize: version.fileSize,
    };
  }

  async updateVersion(id: string, data: {
    name?: string;
    description?: string;
    changelog?: string;
    isPublic?: boolean;
  }) {
    const version = await prisma.customVersion.findUnique({ where: { id } });
    if (!version) {
      throw new AppError(404, "NOT_FOUND", "Version not found");
    }

    return prisma.customVersion.update({
      where: { id },
      data,
    });
  }

  async deleteVersion(id: string) {
    const version = await prisma.customVersion.findUnique({ where: { id } });
    if (!version) {
      throw new AppError(404, "NOT_FOUND", "Version not found");
    }

    const filePath = path.resolve(env.UPLOAD_DIR, version.fileName);
    await fs.unlink(filePath).catch(() => {});

    await prisma.customVersion.delete({ where: { id } });

    logger.info({ versionId: id, name: version.name }, "Custom version deleted");
  }

  private async computeSha256(filepath: string): Promise<string> {
    const buffer = await fs.readFile(filepath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }
}

export const customVersionService = new CustomVersionService();
