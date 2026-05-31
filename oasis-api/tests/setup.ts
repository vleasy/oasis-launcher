import "dotenv/config";
import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://oasis:oasis_pass@localhost:5432/oasis_launcher_test?schema=public";
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret-key-256-bit";
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-key-256-bit";
  process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
  process.env.LOG_LEVEL = "silent";
});

afterAll(async () => {
  // cleanup
});
