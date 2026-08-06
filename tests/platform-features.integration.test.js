"use strict";

/* global afterAll, beforeAll */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "platform-feature-test-secret-that-is-at-least-thirty-two-bytes";

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../server/app");
const Achievement = require("../server/models/Achievement");
const Notification = require("../server/models/Notification");
const Question = require("../server/models/Question");
const Score = require("../server/models/Score");
const User = require("../server/models/User");
const {
  checkAndUnlockAchievements,
  getAchievementDefinitions,
} = require("../server/services/achievementService");
const { createAuthToken } = require("../server/utils/authToken");
const { getMongoBinaryOptions } = require("./support/mongodb");

let mongoServer;
let primaryUser;
let foreignUser;

function authCookie(user) {
  return `quizmaster_token=${createAuthToken({
    userId: user._id,
    tokenVersion: user.tokenVersion,
  })}`;
}

async function createUser(overrides = {}) {
  return User.create({
    firstName: "Portfolio",
    lastName: "Tester",
    email: `user-${new mongoose.Types.ObjectId()}@example.invalid`,
    password: "PortfolioPassword123!",
    emailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
    ...overrides,
  });
}

function scoreData(user, overrides = {}) {
  return {
    user: user._id,
    category: "Java",
    score: 8,
    attemptedQuestions: 10,
    correctAnswers: 8,
    wrongAnswers: 2,
    unansweredQuestions: 0,
    totalQuestions: 10,
    accuracy: 80,
    xpEarned: 80,
    timeTakenSeconds: 90,
    completedAt: new Date(),
    ...overrides,
  };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: getMongoBinaryOptions(),
    instance: { dbName: "quizmaster-platform-features" },
  });
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([
    Achievement.syncIndexes(),
    Notification.syncIndexes(),
    Question.syncIndexes(),
    Score.syncIndexes(),
    User.syncIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
  primaryUser = await createUser({ email: "primary@example.invalid" });
  foreignUser = await createUser({ email: "foreign@example.invalid" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("achievement requirements and idempotency", () => {
  test("every achievement definition unlocks at its documented threshold once", async () => {
    primaryUser.totalXp = 5000;
    primaryUser.quizzesCompleted = 50;
    primaryUser.currentStreak = 7;
    await primaryUser.save({ validateBeforeSave: false });

    await Score.insertMany(
      Array.from({ length: 10 }, (_, index) =>
        scoreData(primaryUser, {
          accuracy: index === 0 ? 100 : index < 5 ? 90 : 80,
          category: "Java",
        }),
      ),
    );

    const firstCheck = await checkAndUnlockAchievements(primaryUser._id);
    const secondCheck = await checkAndUnlockAchievements(primaryUser._id);
    const definitions = getAchievementDefinitions();
    const storedCodes = await Achievement.distinct("code", {
      user: primaryUser._id,
    });

    expect(firstCheck.newlyUnlocked).toHaveLength(definitions.length);
    expect(secondCheck.newlyUnlocked).toHaveLength(0);
    expect(storedCodes.sort()).toEqual(
      definitions.map(({ code }) => code).sort(),
    );
    expect(await Achievement.countDocuments({ user: primaryUser._id })).toBe(
      definitions.length,
    );
  });

  test("locked achievements remain absent below their requirements", async () => {
    const result = await checkAndUnlockAchievements(primaryUser._id);
    expect(result.newlyUnlocked).toHaveLength(0);
    expect(await Achievement.countDocuments({ user: primaryUser._id })).toBe(0);
  });
});

describe("leaderboard eligibility and deterministic ranking", () => {
  test("excludes administrators and disabled users and caps the top list", async () => {
    await User.deleteMany({});
    const users = await User.insertMany(
      Array.from({ length: 14 }, (_, index) => ({
        firstName: `Player${String(index).padStart(2, "0")}`,
        lastName: "Ranked",
        email: `ranked-${index}@example.invalid`,
        password: "StoredOnlyPassword123!",
        emailVerified: true,
        isActive: true,
        role: "user",
        totalXp: index < 2 ? 1000 : 1000 - index,
        quizzesCompleted: index < 2 ? 10 : 5,
        correctAnswers: index < 2 ? 50 : 20,
      })),
    );
    await User.insertMany([
      {
        firstName: "Excluded",
        lastName: "Admin",
        email: "admin-rank@example.invalid",
        password: "StoredOnlyPassword123!",
        emailVerified: true,
        isActive: true,
        role: "admin",
        totalXp: 99999,
      },
      {
        firstName: "Excluded",
        lastName: "Disabled",
        email: "disabled-rank@example.invalid",
        password: "StoredOnlyPassword123!",
        emailVerified: true,
        isActive: false,
        role: "user",
        totalXp: 99999,
      },
    ]);

    const response = await request(app)
      .get("/api/leaderboard")
      .set("Cookie", authCookie(users[13]));

    expect(response.status).toBe(200);
    expect(response.body.totalPlayers).toBe(14);
    expect(response.body.leaderboard).toHaveLength(10);
    expect(
      response.body.leaderboard.map((entry) => entry.fullName),
    ).not.toEqual(
      expect.arrayContaining(["Excluded Admin", "Excluded Disabled"]),
    );
    expect(
      response.body.leaderboard.slice(0, 2).map((entry) => entry.fullName),
    ).toEqual(["Player00 Ranked", "Player01 Ranked"]);
    expect(response.body.currentUser.rank).toBe(14);
    expect(response.body.currentUser.isCurrentUser).toBe(true);
  });

  test("returns a stable empty response when no eligible users exist", async () => {
    primaryUser.role = "admin";
    foreignUser.role = "admin";
    await Promise.all([primaryUser.save(), foreignUser.save()]);

    const response = await request(app)
      .get("/api/leaderboard")
      .set("Cookie", authCookie(primaryUser));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      totalPlayers: 0,
      leaderboard: [],
      currentUser: null,
    });
  });
});

describe("user analytics", () => {
  test("empty analytics contains finite zero values", async () => {
    const response = await request(app)
      .get("/api/analytics")
      .set("Cookie", authCookie(primaryUser));
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      totalQuizzes: 0,
      averageAccuracy: 0,
      totalXpEarned: 0,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/NaN|Infinity/);
  });

  test("calculates totals, category strength, trends, and answer percentages", async () => {
    await Score.insertMany([
      scoreData(primaryUser, {
        category: "Java",
        score: 10,
        correctAnswers: 10,
        wrongAnswers: 0,
        accuracy: 100,
        xpEarned: 100,
      }),
      scoreData(primaryUser, {
        category: "Python",
        score: 5,
        correctAnswers: 5,
        wrongAnswers: 5,
        accuracy: 50,
        xpEarned: 50,
        completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }),
    ]);

    const response = await request(app)
      .get("/api/analytics")
      .set("Cookie", authCookie(primaryUser));

    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({
      totalQuizzes: 2,
      totalCorrectAnswers: 15,
      totalWrongAnswers: 5,
      totalXpEarned: 150,
      averageAccuracy: 75,
      perfectScores: 1,
    });
    expect(response.body.answerBreakdown).toMatchObject({
      total: 20,
      correctPercentage: 75,
      wrongPercentage: 25,
    });
    expect(response.body.strongestCategory.category).toBe("Java");
    expect(response.body.weakestCategory.category).toBe("Python");
    expect(response.body.dailyPerformance).toHaveLength(14);
    expect(response.body.performanceComparison.available).toBe(true);
  });
});

describe("notification lifecycle and ownership", () => {
  test("paginates, filters unread records, and updates only owned notifications", async () => {
    const owned = await Notification.create({
      user: primaryUser._id,
      type: "quiz",
      title: "Quiz complete",
      message: "You earned XP.",
      link: "/history",
    });
    await Notification.create({
      user: primaryUser._id,
      type: "account",
      title: "Read notice",
      message: "Already read.",
      isRead: true,
      readAt: new Date(),
    });
    const foreign = await Notification.create({
      user: foreignUser._id,
      type: "system",
      title: "Private",
      message: "Foreign notification.",
    });

    const list = await request(app)
      .get("/api/notifications?unreadOnly=true&page=1&limit=1")
      .set("Cookie", authCookie(primaryUser));
    expect(list.status).toBe(200);
    expect(list.body.notifications).toHaveLength(1);
    expect(list.body.notifications[0].title).toBe("Quiz complete");
    expect(list.body).toMatchObject({ unreadCount: 1 });
    expect(list.body.pagination).toMatchObject({
      currentPage: 1,
      totalNotifications: 1,
      limit: 1,
    });

    await request(app)
      .patch(`/api/notifications/${foreign._id}/read`)
      .set("Cookie", authCookie(primaryUser))
      .expect(404);
    await request(app)
      .delete(`/api/notifications/${foreign._id}`)
      .set("Cookie", authCookie(primaryUser))
      .expect(404);

    const read = await request(app)
      .patch(`/api/notifications/${owned._id}/read`)
      .set("Cookie", authCookie(primaryUser));
    expect(read.status).toBe(200);
    expect(read.body.notification.isRead).toBe(true);
    expect(await Notification.countDocuments({ user: foreignUser._id })).toBe(
      1,
    );

    const markedAll = await request(app)
      .patch("/api/notifications/read-all")
      .set("Cookie", authCookie(primaryUser));
    expect(markedAll.status).toBe(200);
    expect(markedAll.body.modifiedCount).toBe(0);

    await request(app)
      .delete(`/api/notifications/${owned._id}`)
      .set("Cookie", authCookie(primaryUser))
      .expect(200);
    expect(await Notification.findById(owned._id)).toBeNull();
  });

  test("invalid identifiers return controlled errors without database leakage", async () => {
    for (const [method, path] of [
      ["patch", "/api/notifications/not-an-id/read"],
      ["delete", "/api/notifications/not-an-id"],
    ]) {
      const response = await request(app)
        [method](path)
        .set("Cookie", authCookie(primaryUser));
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: "The notification ID is invalid.",
      });
    }
  });
});

describe("settings success and validation contracts", () => {
  test("retrieves and updates only the authenticated account without secrets", async () => {
    const update = await request(app)
      .patch("/api/settings/profile")
      .set("Cookie", authCookie(primaryUser))
      .send({
        firstName: "Updated",
        lastName: "Portfolio",
        email: "updated@example.invalid",
        userId: foreignUser._id,
      });

    expect(update.status).toBe(200);
    expect(update.body.account).toMatchObject({
      firstName: "Updated",
      lastName: "Portfolio",
      email: "updated@example.invalid",
    });
    expect(update.body.account).not.toHaveProperty("password");
    expect(update.body.account).not.toHaveProperty("tokenVersion");
    expect((await User.findById(foreignUser._id)).firstName).toBe("Portfolio");

    const refreshed = await User.findById(primaryUser._id);
    const settings = await request(app)
      .get("/api/settings")
      .set("Cookie", authCookie(refreshed));
    expect(settings.status).toBe(200);
    expect(settings.body.account.email).toBe("updated@example.invalid");
    expect(settings.body.account).not.toHaveProperty("password");
  });

  test("rejects malformed and duplicate profile values without mutation", async () => {
    const cookie = authCookie(primaryUser);
    await request(app)
      .patch("/api/settings/profile")
      .set("Cookie", cookie)
      .send({ firstName: ["No"], lastName: "Tester", email: primaryUser.email })
      .expect(400);
    await request(app)
      .patch("/api/settings/profile")
      .set("Cookie", cookie)
      .send({
        firstName: "Valid",
        lastName: "Tester",
        email: foreignUser.email,
      })
      .expect(409);
    expect((await User.findById(primaryUser._id)).firstName).toBe("Portfolio");
  });
});

describe("administrator CRUD and report integration", () => {
  test("question create, list, metadata, read, update, and delete are consistent", async () => {
    const admin = await createUser({ role: "admin" });
    const payload = {
      question: "Which keyword creates a Java class?",
      options: ["class", "type", "struct", "object"],
      correctAnswer: 0,
      category: "Java",
      difficulty: "Easy",
      explanation: "The class keyword declares a class.",
    };

    const created = await request(app)
      .post("/api/admin/questions")
      .set("Cookie", authCookie(admin))
      .send(payload);
    expect(created.status).toBe(201);
    const questionId = created.body.question._id;

    const list = await request(app)
      .get("/api/admin/questions?search=keyword&difficulty=Easy")
      .set("Cookie", authCookie(admin));
    expect(list.status).toBe(200);
    expect(list.body.questions).toHaveLength(1);
    expect(list.body.pagination.totalQuestions).toBe(1);

    const metadata = await request(app)
      .get("/api/admin/questions/meta/options")
      .set("Cookie", authCookie(admin));
    expect(metadata.body).toMatchObject({
      success: true,
      categories: ["Java"],
      difficulties: ["Easy", "Medium", "Hard"],
    });

    await request(app)
      .get(`/api/admin/questions/${questionId}`)
      .set("Cookie", authCookie(admin))
      .expect(200);
    const updated = await request(app)
      .put(`/api/admin/questions/${questionId}`)
      .set("Cookie", authCookie(admin))
      .send({ ...payload, difficulty: "Hard" });
    expect(updated.status).toBe(200);
    expect(updated.body.question.difficulty).toBe("Hard");

    await request(app)
      .post("/api/admin/questions")
      .set("Cookie", authCookie(admin))
      .send(payload)
      .expect(409);
    await request(app)
      .get("/api/admin/questions/not-an-id")
      .set("Cookie", authCookie(admin))
      .expect(400);
    await request(app)
      .delete(`/api/admin/questions/${questionId}`)
      .set("Cookie", authCookie(admin))
      .expect(200);
    expect(await Question.findById(questionId)).toBeNull();
  });

  test("category rename updates questions and saved score history", async () => {
    const admin = await createUser({ role: "admin" });
    await Question.create({
      question: "A historical category question?",
      options: ["A", "B", "C", "D"],
      correctAnswer: 0,
      category: "Legacy Java",
      difficulty: "Medium",
    });
    await Score.create(scoreData(primaryUser, { category: "Legacy Java" }));

    const renamed = await request(app)
      .patch("/api/admin/categories/Legacy%20Java")
      .set("Cookie", authCookie(admin))
      .send({ name: "Modern Java" });
    expect(renamed.status).toBe(200);
    expect(await Question.countDocuments({ category: "Modern Java" })).toBe(1);
    expect(await Score.countDocuments({ category: "Modern Java" })).toBe(1);

    await Question.create({
      question: "Another category question?",
      options: ["A", "B", "C", "D"],
      correctAnswer: 0,
      category: "Existing",
      difficulty: "Easy",
    });
    await request(app)
      .patch("/api/admin/categories/Modern%20Java")
      .set("Cookie", authCookie(admin))
      .send({ name: "Existing" })
      .expect(409);
  });

  test("CSV report endpoints encode malicious cells without changing columns", async () => {
    const admin = await createUser({ role: "admin" });
    await createUser({
      firstName: '=HYPERLINK("https://evil.example")',
      lastName: "Unicode 你好",
      email: "csv@example.invalid",
    });

    const response = await request(app)
      .get("/api/admin/reports/users")
      .set("Cookie", authCookie(admin));
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^text\/csv/);
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.text).toContain("'=HYPERLINK");
    expect(response.text).toContain("Unicode 你好");
    expect(response.text.split("\n")[0]).toContain("Full Name");
  });
});
