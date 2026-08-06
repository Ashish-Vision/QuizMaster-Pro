"use strict";

/* global afterAll, beforeAll, jest */

const request = require("supertest");

process.env.JWT_SECRET =
  "stage-one-test-secret-that-is-at-least-thirty-two-bytes";

const mockQuestionHandlers = {
  getQuestions: jest.fn(),
  getQuestionById: jest.fn(),
  createQuestion: jest.fn(),
  updateQuestion: jest.fn(),
  deleteQuestion: jest.fn(),
  getQuestionMetadata: jest.fn(),
};

const mockCategoryHandlers = {
  getCategories: jest.fn(),
  renameCategory: jest.fn(),
  deleteCategory: jest.fn(),
};

jest.mock(
  "../server/controllers/adminQuestionController",
  () => mockQuestionHandlers,
);
jest.mock(
  "../server/controllers/adminCategoryController",
  () => mockCategoryHandlers,
);

const app = require("../server/app");
const User = require("../server/models/User");
const { createAuthToken } = require("../server/utils/authToken");

const USER_ID = "64b000000000000000000011";
const ADMIN_ID = "64b000000000000000000012";
const QUESTION_ID = "64b000000000000000000013";

function createAuthenticatedUser(id, role) {
  return {
    _id: id,
    id,
    firstName: role === "admin" ? "Admin" : "Regular",
    lastName: "Tester",
    email: `${role}@example.invalid`,
    role,
    tokenVersion: 0,
    isActive: true,
    totalXp: 0,
    quizzesCompleted: 0,
    correctAnswers: 0,
    currentStreak: 0,
  };
}

function authCookie(userId) {
  return `quizmaster_token=${createAuthToken({ userId, tokenVersion: 0 })}`;
}

const QUESTION_ROUTES = [
  ["get", "/api/admin/questions", "getQuestions"],
  ["post", "/api/admin/questions", "createQuestion"],
  ["get", "/api/admin/questions/meta/options", "getQuestionMetadata"],
  ["get", `/api/admin/questions/${QUESTION_ID}`, "getQuestionById"],
  ["put", `/api/admin/questions/${QUESTION_ID}`, "updateQuestion"],
  ["delete", `/api/admin/questions/${QUESTION_ID}`, "deleteQuestion"],
];

const ADMIN_PAGE_CONTRACTS = [
  [
    "/admin",
    "/css/admin/dashboard.css",
    ["/js/admin/charts.js", "/js/admin/dashboard.js"],
  ],
  ["/admin/questions", "/css/admin/questions.css", ["/js/admin/questions.js"]],
  [
    "/admin/categories",
    "/css/admin/categories.css",
    ["/js/admin/categories.js"],
  ],
  ["/admin/users", "/css/admin/users.css", ["/js/admin/users.js"]],
  ["/admin/attempts", "/css/admin/attempts.css", ["/js/admin/attempts.js"]],
  [
    "/admin/analytics",
    "/css/admin/analytics.css",
    ["/js/admin/charts.js", "/js/admin/analytics.js"],
  ],
  [
    "/admin/achievements",
    "/css/admin/achievements.css",
    ["/js/admin/achievements.js"],
  ],
  [
    "/admin/notifications",
    "/css/admin/notifications.css",
    ["/js/admin/notifications.js"],
  ],
];

beforeAll(() => {
  jest.spyOn(User, "findById").mockImplementation((id) => ({
    select: async () => {
      if (String(id) === ADMIN_ID)
        return createAuthenticatedUser(ADMIN_ID, "admin");
      if (String(id) === USER_ID)
        return createAuthenticatedUser(USER_ID, "user");
      return null;
    },
  }));

  for (const [handlerName, handler] of Object.entries(mockQuestionHandlers)) {
    handler.mockImplementation((req, res) =>
      res.status(200).json({ success: true, handler: handlerName }),
    );
  }
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("administrator question router contracts", () => {
  test.each(QUESTION_ROUTES)(
    "%s %s rejects unauthenticated requests before its controller",
    async (method, path, handlerName) => {
      const response = await request(app)
        [method](path)
        .set("Accept", "application/json");

      expect(response.status).toBe(401);
      expect(mockQuestionHandlers[handlerName]).not.toHaveBeenCalled();
    },
  );

  test.each(QUESTION_ROUTES)(
    "%s %s rejects regular users before its controller",
    async (method, path, handlerName) => {
      const response = await request(app)
        [method](path)
        .set("Accept", "application/json")
        .set("Cookie", authCookie(USER_ID));

      expect(response.status).toBe(403);
      expect(mockQuestionHandlers[handlerName]).not.toHaveBeenCalled();
    },
  );

  test.each(QUESTION_ROUTES)(
    "%s %s invokes only %s for administrators",
    async (method, path, handlerName) => {
      const response = await request(app)
        [method](path)
        .set("Accept", "application/json")
        .set("Cookie", authCookie(ADMIN_ID));

      expect(response.status).toBe(200);
      expect(response.body.handler).toBe(handlerName);
      expect(mockQuestionHandlers[handlerName]).toHaveBeenCalledTimes(1);
      for (const categoryHandler of Object.values(mockCategoryHandlers)) {
        expect(categoryHandler).not.toHaveBeenCalled();
      }
    },
  );
});

describe("dashboard and administrator page contracts", () => {
  test("the user dashboard loads only normal dashboard scripts", async () => {
    const response = await request(app)
      .get("/dashboard")
      .set("Cookie", authCookie(USER_ID));

    expect(response.status).toBe(200);
    expect(response.text).toContain('href="/css/dashboard.css"');
    expect(response.text).toContain('src="/js/dashboard.js"');
    expect(response.text).toContain('src="/js/daily-challenge.js"');
    expect(response.text).toContain('src="/js/dashboard-notifications.js"');
    expect(response.text).not.toContain("/js/admin/");
  });

  test("the normal dashboard script never references administrator APIs", async () => {
    const response = await request(app).get("/js/dashboard.js");

    expect(response.status).toBe(200);
    expect(response.text).not.toMatch(/\/api\/admin(?:\/|["'`])/);
    expect(response.text).toContain("/api/quiz/categories");
    expect(response.text).toContain("/api/leaderboard");
    expect(response.text).toContain("/api/achievements");
  });

  test.each(ADMIN_PAGE_CONTRACTS)(
    "%s redirects unauthenticated and regular users and serves its expected assets to admins",
    async (path, stylesheet, scripts) => {
      const unauthenticated = await request(app).get(path);
      expect(unauthenticated.status).toBe(302);
      expect(unauthenticated.headers.location).toBe("/login");

      const regularUser = await request(app)
        .get(path)
        .set("Cookie", authCookie(USER_ID));
      expect(regularUser.status).toBe(302);
      expect(regularUser.headers.location).toBe("/dashboard");

      const administrator = await request(app)
        .get(path)
        .set("Cookie", authCookie(ADMIN_ID));
      expect(administrator.status).toBe(200);
      expect(administrator.text).toContain(`href="${stylesheet}"`);
      for (const script of scripts) {
        expect(administrator.text).toContain(`src="${script}"`);
      }
      if (path === "/admin") {
        expect(administrator.text).not.toContain('src="/js/dashboard.js"');
      }
    },
  );
});
