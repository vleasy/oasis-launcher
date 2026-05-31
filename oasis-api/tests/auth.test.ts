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

describe("Auth Module", () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "StrongPass123!",
    nickname: "Tester",
  };
  let accessToken = "";
  let refreshToken = "";

  it("POST /api/auth/register — creates a new user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: testUser,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(testUser.email);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    accessToken = body.data.accessToken;
    refreshToken = body.data.refreshToken;
  });

  it("POST /api/auth/register — rejects duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: testUser,
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("EMAIL_EXISTS");
  });

  it("POST /api/auth/login — logs in with valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: testUser.email, password: testUser.password },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    accessToken = body.data.accessToken;
    refreshToken = body.data.refreshToken;
  });

  it("POST /api/auth/login — rejects wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: testUser.email, password: "wrongpass" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /api/auth/refresh — refreshes tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    // update for subsequent tests
    accessToken = body.data.accessToken;
    refreshToken = body.data.refreshToken;
  });

  it("POST /api/auth/refresh — rejects invalid refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: "invalid-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/profile — returns user profile with valid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/profile",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(testUser.email);
  });

  it("GET /api/profile — rejects without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/profile",
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/auth/logout — revokes refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // verify old refresh no longer works
    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(401);
  });
});
