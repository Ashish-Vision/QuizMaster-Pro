"use strict";

const path = require("path");
const { test, expect } = require("@playwright/test");
const { createAuthToken } = require("../server/utils/authToken");

const USER_ID = "64b000000000000000000001";
const ADMIN_ID = "64b000000000000000000002";
const RESULT_ID = "64b000000000000000000041";
const outputRoot = path.resolve(__dirname, "../docs/images");

const captures = [
  ["user", "login.png", "/login", "#loginForm"],
  ["user", "registration.png", "/register", "#registerForm"],
  ["user", "dashboard.png", "/dashboard", "main"],
  [
    "user",
    "quiz-categories.png",
    "/dashboard?gallery=categories",
    ".category-card",
  ],
  ["user", "quiz.png", "/quiz?category=Java", ".option-button"],
  ["user", "result.png", `/result/${RESULT_ID}`, "#resultCard"],
  ["user", "daily-challenge.png", "/daily-challenge", "#dailyChallengeSection"],
  ["user", "leaderboard.png", "/leaderboard", "main"],
  ["user", "achievements.png", "/achievements", "main"],
  ["user", "analytics.png", "/analytics", "main"],
  ["user", "history.png", "/history", "main"],
  ["user", "notifications.png", "/notifications", "main"],
  ["user", "profile.png", "/profile", "main"],
  ["user", "settings.png", "/settings", "main"],
  ["admin", "dashboard.png", "/admin", "main"],
  ["admin", "analytics.png", "/admin/analytics", "main"],
  ["admin", "users.png", "/admin/users", "main"],
  ["admin", "questions.png", "/admin/questions", "main"],
  ["admin", "categories.png", "/admin/categories", "main"],
  ["admin", "attempts.png", "/admin/attempts", "main"],
  ["admin", "achievements.png", "/admin/achievements", "main"],
  ["admin", "reports.png", "/admin/reports", "main"],
  ["admin", "notifications.png", "/admin/notifications", "main"],
  ["admin", "activity-logs.png", "/admin/activity-logs", "main"],
  ["admin", "settings.png", "/admin/settings", "main"],
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

async function capture(page, entry) {
  const [directory, filename, url, readySelector] = entry;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  if (url.includes("/result/")) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => sessionStorage.clear());
  }

  const response = await page.goto(url, { waitUntil: "networkidle" });
  expect(response?.status(), url).toBe(200);
  await expect(page.locator(readySelector).first()).toBeVisible();

  if (filename === "registration.png") {
    await page.locator("#firstName").fill("Avery");
    await page.locator("#lastName").fill("Morgan");
    await page.locator("#registerEmail").fill("avery.morgan@example.invalid");
  }

  await page.waitForTimeout(100);

  if (filename === "quiz-categories.png") {
    await page.locator(".category-card").first().scrollIntoViewIfNeeded();
  }
  if (url === "/daily-challenge") {
    await page.locator("#dailyChallengeSection").scrollIntoViewIfNeeded();
  }

  expect(errors, `${url} emitted browser errors`).toEqual([]);
  await page.screenshot({
    path: path.join(outputRoot, directory, filename),
    fullPage: false,
    animations: "disabled",
  });
}

test("capture public login screenshot", async ({ page }) => {
  await capture(page, captures[0]);
});

test("capture registration screenshot", async ({ page }) => {
  await capture(page, captures[1]);
});

test("capture learner application screenshots", async ({ page, context }) => {
  await authenticate(context, USER_ID);
  for (const entry of captures.slice(2, 14)) await capture(page, entry);
});

test("capture administrator application screenshots", async ({
  page,
  context,
}) => {
  await authenticate(context, ADMIN_ID);
  for (const entry of captures.slice(14)) await capture(page, entry);
});
