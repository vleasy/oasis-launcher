import { getRedis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/errors.js";

interface MojangVersionManifest {
  latest: { release: string; snapshot: string };
  versions: Array<{
    id: string;
    type: "release" | "snapshot" | "old_beta" | "old_alpha";
    url: string;
    time: string;
    releaseTime: string;
  }>;
}

interface MojangVersionDetails {
  id: string;
  type: string;
  time: string;
  releaseTime: string;
  downloads: {
    client: { url: string; sha1: string; size: number };
    server?: { url: string; sha1: string; size: number };
  };
  assetIndex: { url: string; sha1: string; size: number; totalSize: number };
}

const CACHE_KEY = "mojang:version_manifest";
const CACHE_TTL = 3600;
const DETAIL_CACHE_PREFIX = "mojang:version:";

export class VanillaService {
  async getManifest(): Promise<MojangVersionManifest> {
    const redis = getRedis();

    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as MojangVersionManifest;
    }

    const response = await fetch(env.MOJANG_VERSION_MANIFEST_URL);
    if (!response.ok) {
      throw new AppError(502, "MOJANG_API_ERROR", "Failed to fetch Mojang manifest");
    }

    const manifest = (await response.json()) as MojangVersionManifest;
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(manifest));

    logger.info(
      { versionCount: manifest.versions.length },
      "Fetched Mojang version manifest"
    );

    return manifest;
  }

  async getVersionDetails(versionId: string): Promise<MojangVersionDetails> {
    const redis = getRedis();
    const cacheKey = `${DETAIL_CACHE_PREFIX}${versionId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as MojangVersionDetails;
    }

    const manifest = await this.getManifest();
    const entry = manifest.versions.find((v) => v.id === versionId);
    if (!entry) {
      throw new AppError(404, "VERSION_NOT_FOUND", `Version ${versionId} not found`);
    }

    const response = await fetch(entry.url);
    if (!response.ok) {
      throw new AppError(502, "MOJANG_API_ERROR", "Failed to fetch version details");
    }

    const details = (await response.json()) as MojangVersionDetails;
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(details));

    return details;
  }

  async getDownloadUrl(versionId: string): Promise<string> {
    const details = await this.getVersionDetails(versionId);
    if (!details.downloads?.client?.url) {
      throw new AppError(404, "NO_DOWNLOAD", "No client download available for this version");
    }
    return details.downloads.client.url;
  }

  async listVanillaVersions(
    type?: string
  ): Promise<MojangVersionManifest["versions"]> {
    const manifest = await this.getManifest();
    let versions = manifest.versions;
    if (type) {
      versions = versions.filter((v) => v.type === type);
    }
    return versions;
  }
}

export const vanillaService = new VanillaService();
