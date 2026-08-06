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
  "/quiz?category=Java",
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

const EXPECTED_ADMIN_API = new Map([
  ["/admin", "/api/admin/dashboard"],
  ["/admin/questions", "/api/admin/questions"],
  ["/admin/categories", "/api/admin/categories"],
  ["/admin/users", "/api/admin/users"],
  ["/admin/attempts", "/api/admin/attempts"],
  ["/admin/analytics", "/api/admin/analytics"],
  ["/admin/achievements", "/api/admin/achievements"],
  ["/admin/notifications", "/api/admin/notifications"],
  ["/admin/reports", "/api/admin/reports/summary"],
  ["/admin/activity-logs", "/api/admin/activity-logs"],
  ["/admin/settings", "/api/admin/settings"],
]);

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
  const badResponses = [];
  const consoleErrors = [];
  const pageErrors = [];
  const apiRequests = [];

  const onResponse = (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${url.pathname}`);
    }
  };
  const onConsole = (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const onPageError = (error) => pageErrors.push(error.message);

  page.on("response", onResponse);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response.status(), path).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).not.toBeEmpty();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);

  expect(badResponses, `${path} unexpected HTTP failures`).toEqual([]);
  expect(consoleErrors, `${path} browser console errors`).toEqual([]);
  expect(pageErrors, `${path} uncaught browser errors`).toEqual([]);

  if (path === "/dashboard" || path === "/daily-challenge") {
    expect(apiRequests).toEqual(
      expect.arrayContaining([
        "/api/quiz/categories",
        "/api/leaderboard",
        "/api/achievements",
        "/api/daily-challenge",
      ]),
    );
    expect(
      apiRequests.some((apiPath) => apiPath.startsWith("/api/admin/")),
    ).toBe(false);
  }

  const expectedAdminApi = EXPECTED_ADMIN_API.get(path);
  if (expectedAdminApi) {
    expect(
      apiRequests.some((apiPath) => apiPath.startsWith(expectedAdminApi)),
      `${path} should hydrate from ${expectedAdminApi}`,
    ).toBe(true);
    expect(
      apiRequests.filter((apiPath) => apiPath.startsWith("/api/admin/")),
      `${path} should call only its expected administrator API`,
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          new RegExp(
            `^${expectedAdminApi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          ),
        ),
      ]),
    );
    expect(
      apiRequests
        .filter((apiPath) => apiPath.startsWith("/api/admin/"))
        .every((apiPath) => apiPath.startsWith(expectedAdminApi)),
    ).toBe(true);
  }

  page.off("response", onResponse);
  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  return { apiRequests };
}

async function prepareQuizSubmission(page) {
  await page.goto("/quiz?category=Java");
  await page.locator(".option-button").first().click();
  await page.locator("#submitButton").click();
  await expect(page.locator("#submitModal")).not.toHaveClass(/hidden/);
}

test("public rendered-page audit", async ({ page }) => {
  for (const path of PUBLIC_PAGES) await auditPage(page, path);
});

test("authenticated user rendered-page audit", async ({ page, context }) => {
  await authenticate(context, "64b000000000000000000001");
  for (const path of USER_PAGES) await auditPage(page, path);
});

test("ordinary user dashboard hydrates real UI from user APIs", async ({
  page,
  context,
}) => {
  await authenticate(context, "64b000000000000000000001");
  const { apiRequests } = await auditPage(page, "/dashboard");

  await expect(page.locator(".category-card").first()).toContainText("Java");
  await expect(page.locator(".leaderboard-row").first()).toContainText(
    "Test User",
  );
  await expect(
    page.locator(".dashboard-achievement-item").first(),
  ).toContainText("First Steps");
  expect(apiRequests.some((path) => path.startsWith("/api/admin/"))).toBe(
    false,
  );
});

test("dashboard redirects a 401 response to login", async ({
  page,
  context,
}) => {
  await authenticate(context, "64b000000000000000000001");
  await page.route("**/api/quiz/categories", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Authentication required.",
      }),
    }),
  );

  await page.goto("/dashboard");
  await page.waitForURL("**/login");
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("dashboard handles a 403 response without a redirect loop", async ({
  page,
  context,
}) => {
  await authenticate(context, "64b000000000000000000001");
  await page.route("**/api/quiz/categories", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Forbidden." }),
    }),
  );

  await page.goto("/dashboard");
  await expect(page.locator(".category-error")).toContainText("Forbidden");
  expect(new URL(page.url()).pathname).toBe("/dashboard");
});

test("quiz submission suppresses rapid duplicate clicks", async ({
  page,
  context,
}) => {
  await authenticate(context, "64b000000000000000000001");
  let submissionCount = 0;
  let alertMessage = "";

  page.on("dialog", async (dialog) => {
    alertMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.route("**/api/quiz/submit", async (route) => {
    submissionCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Quiz submission is already being processed.",
      }),
    });
  });

  await prepareQuizSubmission(page);
  await page.locator("#confirmSubmitButton").evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(page.locator("#confirmSubmitButton")).toBeEnabled();
  expect(submissionCount).toBe(1);
  expect(alertMessage).toContain("already being processed");
  expect(new URL(page.url()).pathname).toBe("/quiz");
});

test("completed replay navigates to its existing result", async ({
  page,
  context,
}) => {
  await authenticate(context, "64b000000000000000000001");
  const resultId = "64b000000000000000000041";
  let submissionCount = 0;

  await page.route("**/api/quiz/submit", async (route) => {
    submissionCount += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        replayed: true,
        message: "This quiz has already been completed.",
        existingResultId: resultId,
      }),
    });
  });
  await page.route(`**/api/quiz/result/${resultId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        result: {
          resultId,
          category: "Java",
          score: 1,
          totalQuestions: 1,
          percentage: 100,
          xpEarned: 10,
          answers: [],
        },
      }),
    }),
  );

  await prepareQuizSubmission(page);
  await page.locator("#confirmSubmitButton").click();

  await page.waitForURL(`**/result/${resultId}`);
  expect(submissionCount).toBe(1);
  expect(new URL(page.url()).pathname).toBe(`/result/${resultId}`);
});

test("administrator rendered-page audit", async ({ page, context }) => {
  await authenticate(context, "64b000000000000000000002");
  for (const path of ADMIN_PAGES) await auditPage(page, path);
});
