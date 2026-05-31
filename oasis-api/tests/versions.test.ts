import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Versions Module", () => {
  it("GET /api/versions — returns combined version list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/versions",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("versions");
    expect(body.data).toHaveProperty("total");
    expect(body.data).toHaveProperty("page");
    expect(body.data).toHaveProperty("limit");
  });

  it("GET /api/versions/vanilla — returns vanilla versions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/versions/vanilla",
    });
    // May fail if Mojang API is unreachable — check graceful failure
    const body = JSON.parse(res.body);
    if (res.statusCode === 502) {
      expect(body.error.code).toBe("MOJANG_API_ERROR");
      return;
    }
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/versions/custom — returns custom versions (empty)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/versions/custom",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("versions");
    expect(body.data).toHaveProperty("total");
  });

  it("GET /api/versions/custom/:id — returns 404 for unknown", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/versions/custom/nonexistent-id",
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  it("GET /health — health check", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
  });
});
