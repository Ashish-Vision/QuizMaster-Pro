"use strict";

const { test, expect } = require("@playwright/test");
const { createAuthToken } = require("../server/utils/authToken");

const PUBLIC_PAGES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/resend-verification",
  "/terms",
  "/privacy",
];
const USER_PAGES = [
  "/dashboard",
  "/quiz",
  "/daily-challenge",
  "/history",
  "/leaderboard",
  "/achievements",
  "/analytics",
  "/notifications",
  "/profile",
  "/settings",
];
const ADMIN_PAGES = [
  "/admin",
  "/admin/questions",
  "/admin/categories",
  "/admin/users",
  "/admin/attempts",
  "/admin/analytics",
  "/admin/achievements",
  "/admin/notifications",
  "/admin/reports",
  "/admin/activity-logs",
  "/admin/settings",
];

async function authenticate(context, userId) {
  process.env.JWT_SECRET = "e2e-only-secret-that-is-at-least-thirty-two-bytes";
  const token = createAuthToken({ userId, tokenVersion: 0 });
  await context.addCookies([
    {
      name: "quizmaster_token",
      value: token,
      url: "http://127.0.0.1:5000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function auditPage(page, path) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response.status(), path).toBe(200);
  await expect(page.locator("body")).not.toBeEmpty();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);
}

test("public rendered-page audit", async ({ page }) => {
  for (const path of PUBLIC_PAGES) await auditPage(page, path);
});

test("authenticated user rendered-page audit", async ({ page, context }) => {
  await authenticate(context, "64b000000000000000000001");
  for (const path of USER_PAGES) await auditPage(page, path);
});

test("administrator rendered-page audit", async ({ page, context }) => {
  await authenticate(context, "64b000000000000000000002");
  for (const path of ADMIN_PAGES) await auditPage(page, path);
});
