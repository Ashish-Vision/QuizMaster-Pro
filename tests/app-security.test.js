"use strict";

const request = require("supertest");
process.env.CLIENT_ORIGIN = "https://quiz.example";
const app = require("../server/app");

describe("application security and public contracts", () => {
  test.each([
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/resend-verification",
    "/terms",
    "/privacy",
  ])("renders %s", async (path) => {
    const response = await request(app).get(path);
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/<!doctype html>/i);
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    expect(response.headers["cache-control"]).toContain("no-store");
  });

  test("static assets are available", async () => {
    await request(app)
      .get("/css/style.css")
      .expect(200)
      .expect("Content-Type", /css/);
    await request(app)
      .get("/js/login.js")
      .expect(200)
      .expect("Content-Type", /javascript/);
  });

  test("liveness is healthy and readiness reflects a disconnected database", async () => {
    const health = await request(app).get("/api/health").expect(200);
    expect(health.body.success).toBe(true);
    const readiness = await request(app).get("/api/ready").expect(503);
    expect(readiness.body).toEqual({ success: false, ready: false });
  });

  test("unsafe object keys are rejected", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "x@example.com", profile: { $where: "true" } });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid field name/);
  });

  test("cookie-authenticated production mutations require exact same origin", async () => {
    const previous = process.env.NODE_ENV;
    const previousOrigin = process.env.APP_ORIGIN;
    process.env.NODE_ENV = "production";
    process.env.APP_ORIGIN = "https://quiz.example";
    try {
      await request(app)
        .post("/api/auth/logout")
        .set("Cookie", "quizmaster_token=fake")
        .set("Origin", "https://evil.example")
        .expect(403);
      await request(app)
        .post("/api/auth/logout")
        .set("Cookie", "quizmaster_token=fake")
        .set("Origin", "https://quiz.example")
        .expect(200);
    } finally {
      process.env.NODE_ENV = previous;
      process.env.APP_ORIGIN = previousOrigin;
    }
  });

  test("unknown routes return a controlled error without a stack", async () => {
    const response = await request(app).get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toEqual(expect.objectContaining({ success: false }));
    expect(response.body.stack).toBeUndefined();
  });
});
