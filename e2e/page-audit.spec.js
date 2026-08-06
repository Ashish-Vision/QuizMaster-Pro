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
  const overflowAudit = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return {
      amount: document.documentElement.scrollWidth - viewportWidth,
      offenders: [...document.querySelectorAll("body *")]
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.right > viewportWidth + 1 || bounds.left < -1;
        })
        .slice(0, 5)
        .map((element) => ({
          selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
            element.classList.length
              ? `.${[...element.classList].join(".")}`
              : ""
          }`,
          bounds: element.getBoundingClientRect().toJSON(),
        })),
    };
  });
  expect(
    overflowAudit.amount,
    `${path} horizontal overflow: ${JSON.stringify(overflowAudit.offenders)}`,
  ).toBeLessThanOrEqual(1);

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

test("representative pages avoid horizontal overflow at target widths", async ({
  page,
  context,
}) => {
  await authenticate(context, "64b000000000000000000002");

  for (const width of [1440, 1024, 768, 480, 360]) {
    await page.setViewportSize({ width, height: Math.min(1000, width * 2) });
    for (const path of [
      "/",
      "/dashboard",
      "/quiz?category=Java",
      "/admin/questions",
    ]) {
      await auditPage(page, path);
    }
  }
});

test("public mobile navigation closes with Escape and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await page.goto("/");

  const menuButton = page.locator("#menuButton");
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#navLinks")).toHaveClass(/open/);

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#navLinks")).not.toHaveClass(/open/);
  await expect(menuButton).toBeFocused();
});

test("admin question dialog traps focus, validates, and restores focus", async ({
  page,
  context,
}) => {
  await authenticate(context, "64b000000000000000000002");
  await page.goto("/admin/questions");

  const trigger = page.locator("#openCreateModalButton");
  await trigger.click();
  await expect(page.locator("#questionModal")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(page.locator("#questionText")).toBeFocused();

  await page.locator("#saveQuestionButton").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".modal-close-button")).toBeFocused();

  await page.locator("#saveQuestionButton").click();
  await expect(page.locator("#questionText")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator("#questionModal")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(trigger).toBeFocused();
});

test("reduced-motion preference preserves a usable quiz", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(context, "64b000000000000000000001");
  await auditPage(page, "/quiz?category=Java");

  await expect(page.locator(".option-button").first()).toBeVisible();
  const animationDuration = await page
    .locator(".option-button")
    .first()
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(["0s", "0.00001s"]).toContain(animationDuration);
});

test("representative user and admin pages expose accessible structure", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Login/i);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByLabel(/email address/i)).toBeVisible();
  await expect(page.locator("#loginPassword")).toHaveAccessibleName("Password");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  await authenticate(context, "64b000000000000000000001");
  for (const path of [
    "/dashboard",
    "/quiz?category=Java",
    "/profile",
    "/settings",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    if (path.startsWith("/quiz")) {
      const progress = page.getByRole("progressbar");
      await expect(progress).toHaveAttribute("aria-valuemin");
      await expect(progress).toHaveAttribute("aria-valuemax");
      await expect(progress).toHaveAttribute("aria-valuenow");
    }
  }

  await authenticate(context, "64b000000000000000000002");
  for (const path of ["/admin", "/admin/questions", "/admin/users"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("navigation").first()).toBeVisible();
  }
});
