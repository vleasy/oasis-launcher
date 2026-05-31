import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: Number(optional("PORT", "3000")),
  HOST: optional("HOST", "0.0.0.0"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES_IN: optional("JWT_ACCESS_EXPIRES_IN", "15m"),
  JWT_REFRESH_EXPIRES_IN: optional("JWT_REFRESH_EXPIRES_IN", "30d"),
  DATABASE_URL: required("DATABASE_URL"),
  REDIS_URL: optional("REDIS_URL", "redis://localhost:6379"),
  CORS_ORIGIN: optional("CORS_ORIGIN", "http://localhost:1420"),
  UPLOAD_DIR: optional("UPLOAD_DIR", "./uploads/versions"),
  MAX_FILE_SIZE: Number(optional("MAX_FILE_SIZE", "2147483648")),
  MOJANG_VERSION_MANIFEST_URL: optional(
    "MOJANG_VERSION_MANIFEST_URL",
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
  ),
  MOJANG_RATE_LIMIT: Number(optional("MOJANG_RATE_LIMIT", "60")),
  LOG_LEVEL: optional("LOG_LEVEL", "info"),
} as const;
