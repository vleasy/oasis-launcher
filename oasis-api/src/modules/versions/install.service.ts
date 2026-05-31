import path from "path";
import { getRedis } from "../../config/redis.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/errors.js";
import { vanillaService } from "./vanilla.service.js";
import { customVersionService } from "./custom.service.js";

interface InstallFile {
  path: string;
  url: string;
  size: number;
  sha1?: string;
}

interface InstallManifest {
  versionId: string;
  gameVersion: string;
  files: InstallFile[];
  assetIndex: { url: string; sha1: string; size: number };
  javaVersion: number;
  mainClass: string;
  minecraftArguments?: string;
}

interface MojangVersionDetails {
  id: string;
  type: string;
  time: string;
  releaseTime: string;
  mainClass: string;
  arguments?: { game?: unknown[]; jvm?: unknown[] };
  minecraftArguments?: string;
  minimumLauncherVersion: number;
  javaVersion?: { component: string; majorVersion: number };
  downloads: {
    client: { url: string; sha1: string; size: number };
    server?: { url: string; sha1: string; size: number };
  };
  assetIndex: { url: string; sha1: string; size: number; totalSize: number };
  libraries: Array<{
    name: string;
    downloads?: {
      artifact?: { url: string; sha1: string; size: number; path: string };
      classifiers?: Record<string, { url: string; sha1: string; size: number; path: string }>;
    };
    rules?: Array<{ action: string; os?: { name?: string } }>;
  }>;
}

const OASIS_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, "OasisLauncher")
  : path.join(process.env.HOME || process.env.USERPROFILE || ".", ".oasislauncher");

const CACHE_PREFIX = "oasis:install:";

export class InstallService {
  async getInstallManifest(versionId: string, type: string): Promise<InstallManifest> {
    if (type === "custom") {
      return this.getCustomManifest(versionId);
    }
    return this.getVanillaManifest(versionId, type === "offline");
  }

  private async getCustomManifest(versionId: string): Promise<InstallManifest> {
    try {
      const version = await customVersionService.getVersion(versionId);
      return {
        versionId,
        gameVersion: version.minecraftVersion,
        files: [
          {
            path: `versions/${versionId}/${version.name}.zip`,
            url: `/api/versions/custom/${versionId}/download`,
            size: version.fileSize,
            sha1: undefined,
          },
        ],
        assetIndex: { url: "", sha1: "", size: 0 },
        javaVersion: 21,
        mainClass: "net.minecraft.client.main.Main",
      };
    } catch {
      // Fallback: treat custom as vanilla for the version's mcVersion
      // The versionId was passed as mcVersion from Electron main
      return this.getVanillaManifest(versionId, false);
    }
  }

  private async getVanillaManifest(
    versionId: string,
    _offline: boolean
  ): Promise<InstallManifest> {
    const redis = getRedis();
    const cacheKey = `${CACHE_PREFIX}${versionId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as InstallManifest;
    }

    const manifest = await vanillaService.getManifest();
    const entry = manifest.versions.find((v) => v.id === versionId);
    if (!entry) {
      throw new AppError(404, "VERSION_NOT_FOUND", `Version ${versionId} not found`);
    }

    const response = await fetch(entry.url);
    if (!response.ok) {
      throw new AppError(502, "MOJANG_API_ERROR", "Failed to fetch version details from Mojang");
    }

    const details = (await response.json()) as MojangVersionDetails;

    const files: InstallFile[] = [];

    // Client jar
    if (details.downloads?.client) {
      files.push({
        path: `versions/${versionId}/${versionId}.jar`,
        url: details.downloads.client.url,
        size: details.downloads.client.size,
        sha1: details.downloads.client.sha1,
      });
    }

    // Libraries
    const osName = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux";
    for (const lib of details.libraries) {
      const artifact = lib.downloads?.artifact;
      if (!artifact) continue;

      const rules = lib.rules;
      if (rules) {
        const allowed = rules.some((r) => {
          if (r.action === "allow") {
            if (!r.os) return true;
            return r.os.name === osName;
          }
          return false;
        });
        if (!allowed) continue;
      }

      files.push({
        path: `libraries/${artifact.path}`,
        url: artifact.url,
        size: artifact.size,
        sha1: artifact.sha1,
      });

      // Native classifiers
      if (lib.downloads?.classifiers) {
        const nativeClassifier = `${osName}-${process.arch === "x64" ? "64" : "32"}`;
        const nativeLib = lib.downloads.classifiers[nativeClassifier] || lib.downloads.classifiers[`${osName}-natives`];
        if (nativeLib) {
          files.push({
            path: `libraries/${nativeLib.path}`,
            url: nativeLib.url,
            size: nativeLib.size,
            sha1: nativeLib.sha1,
          });
        }
      }
    }

    const javaVersion = details.javaVersion?.majorVersion || 8;

    const installManifest: InstallManifest = {
      versionId,
      gameVersion: details.id,
      files,
      assetIndex: details.assetIndex,
      javaVersion,
      mainClass: details.mainClass || "net.minecraft.client.main.Main",
      minecraftArguments: details.minecraftArguments,
    };

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(installManifest));

    logger.info({ versionId, fileCount: files.length, totalSize: files.reduce((s, f) => s + f.size, 0) }, "Install manifest built");

    return installManifest;
  }

  async getLocalPath(versionId: string): Promise<string> {
    const dir = path.join(OASIS_DIR, "versions", versionId);
    return dir;
  }

  getOasisDir(): string {
    return OASIS_DIR;
  }
}

export const installService = new InstallService();
