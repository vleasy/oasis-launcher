import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let accessToken = "";

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Register + login for auth context
  const email = `accounts-test-${Date.now()}@example.com`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "TestPass123!", nickname: "AccountTester" },
  });
  accessToken = JSON.parse(res.body).data.accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Accounts Module", () => {
  let offlineAccountId = "";
  let msAccountId = "";

  it("POST /api/accounts — creates offline account", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: "offline", username: "TestPlayer99" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.type).toBe("offline");
    expect(body.data.username).toBe("TestPlayer99");
    expect(body.data.isPrimary).toBe(true);
    offlineAccountId = body.data.id;
  });

  it("POST /api/accounts — creates microsoft account", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: "microsoft" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.type).toBe("microsoft");
    msAccountId = body.data.id;
  });

  it("GET /api/accounts — lists all accounts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/accounts",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("PUT /api/accounts/:id/primary — changes primary account", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/accounts/${msAccountId}/primary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it("DELETE /api/accounts/:id — removes account", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/accounts/${offlineAccountId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it("GET /api/accounts — rejects without auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/accounts",
    });
    expect(res.statusCode).toBe(401);
  });
});
