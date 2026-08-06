"use strict";
/* global jest, beforeAll, afterAll */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "stage-four-test-secret-that-is-at-least-32-bytes";
process.env.JWT_ISSUER = "quizmaster-stage-four";
process.env.JWT_AUDIENCE = "quizmaster-stage-four-users";
process.env.JWT_EXPIRES_IN = "7d";
process.env.APP_ORIGIN = "http://127.0.0.1:5000";

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const mockSentMail = { resetUrl: null, verificationUrl: null };
jest.mock("../server/services/emailService", () => ({
  sendPasswordResetEmail: jest.fn(async ({ resetUrl }) => {
    mockSentMail.resetUrl = resetUrl;
  }),
  sendEmailVerificationEmail: jest.fn(async ({ verificationUrl }) => {
    mockSentMail.verificationUrl = verificationUrl;
  }),
}));

const app = require("../server/app");
const User = require("../server/models/User");
const Score = require("../server/models/Score");
const Notification = require("../server/models/Notification");
const { createAuthToken } = require("../server/utils/authToken");

let mongoServer;

async function createUser(overrides = {}) {
  return User.create({
    firstName: "Stage",
    lastName: "User",
    email: `user-${new mongoose.Types.ObjectId()}@example.invalid`,
    password: "InitialPassword123!",
    emailVerified: true,
    emailVerifiedAt: new Date(),
    role: "user",
    isActive: true,
    ...overrides,
  });
}

function authCookie(user, tokenVersion = user.tokenVersion) {
  return `quizmaster_token=${createAuthToken({
    userId: user._id,
    tokenVersion,
  })}`;
}

function tokenFromCookie(response) {
  const cookie = response.headers["set-cookie"]?.find((value) =>
    value.startsWith("quizmaster_token="),
  );
  return cookie?.split(";")[0].split("=")[1];
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: { systemBinary: "/usr/bin/mongod", version: "8.0.28" },
  });
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([
    User.syncIndexes(),
    Score.syncIndexes(),
    Notification.syncIndexes(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  mockSentMail.resetUrl = null;
  mockSentMail.verificationUrl = null;
  await Promise.all([
    User.deleteMany({}),
    Score.deleteMany({}),
    Notification.deleteMany({}),
  ]);
});

describe("authentication token and cookie contracts", () => {
  test("registration validates input and rejects duplicate accounts", async () => {
    const invalidEmail = await request(app).post("/api/auth/register").send({
      firstName: "Valid",
      lastName: "Person",
      email: "not-an-email",
      password: "StrongPassword123!",
    });
    expect(invalidEmail.status).toBe(400);

    const weakPassword = await request(app).post("/api/auth/register").send({
      firstName: "Valid",
      lastName: "Person",
      email: "weak@example.invalid",
      password: "short",
    });
    expect(weakPassword.status).toBe(400);

    const registration = await request(app).post("/api/auth/register").send({
      firstName: "  New  ",
      lastName: "  Member  ",
      email: "  NEW@EXAMPLE.INVALID  ",
      password: "StrongPassword123!",
    });
    expect(registration.status).toBe(201);
    expect(registration.body).toMatchObject({
      success: true,
      requiresEmailVerification: true,
      email: "new@example.invalid",
    });
    expect(registration.headers["set-cookie"]).toBeUndefined();
    const stored = await User.findOne({ email: "new@example.invalid" });
    expect(stored).toMatchObject({
      firstName: "New",
      lastName: "Member",
      emailVerified: false,
    });

    const duplicate = await request(app).post("/api/auth/register").send({
      firstName: "Other",
      lastName: "Member",
      email: "new@example.invalid",
      password: "StrongPassword123!",
    });
    expect(duplicate.status).toBe(409);
    expect(await User.countDocuments({ email: "new@example.invalid" })).toBe(1);
  });

  test("login uses generic credential failures and blocks disabled users", async () => {
    const user = await createUser({ email: "login-failures@example.invalid" });
    const unknown = await request(app).post("/api/auth/login").send({
      email: "unknown@example.invalid",
      password: "WrongPassword123!",
    });
    const wrongPassword = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "WrongPassword123!",
    });
    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPassword.body.message);

    user.isActive = false;
    await user.save({ validateBeforeSave: false });
    const disabled = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "InitialPassword123!",
    });
    expect(disabled.status).toBe(403);
    expect(disabled.body).toEqual({
      success: false,
      message: "This account has been disabled.",
    });
    expect(disabled.headers["set-cookie"]).toBeUndefined();
  });

  test("valid login creates the exact local authentication cookie", async () => {
    const user = await createUser({ email: "login@example.invalid" });
    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "InitialPassword123!",
    });

    expect(response.status).toBe(200);
    const cookie = response.headers["set-cookie"][0];
    expect(cookie).toContain("quizmaster_token=");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  test("missing, malformed, expired, wrong-signature, issuer, audience, and algorithm tokens are rejected", async () => {
    const user = await createUser();
    await request(app)
      .get("/api/auth/me")
      .set("Accept", "application/json")
      .expect(401);

    const invalidTokens = [
      "not-a-token",
      jwt.sign(
        { userId: user._id, tokenVersion: 0 },
        "wrong-secret".padEnd(32, "x"),
        {
          algorithm: "HS256",
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
        },
      ),
      jwt.sign({ userId: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        issuer: "wrong-issuer",
        audience: process.env.JWT_AUDIENCE,
      }),
      jwt.sign({ userId: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        issuer: process.env.JWT_ISSUER,
        audience: "wrong-audience",
      }),
      jwt.sign({ userId: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, {
        algorithm: "HS384",
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      }),
      jwt.sign({ userId: user._id, tokenVersion: 0 }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        expiresIn: -1,
      }),
    ];

    for (const token of invalidTokens) {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Accept", "application/json")
        .set("Cookie", `quizmaster_token=${token}`);
      expect(response.status).toBe(401);
      expect(response.headers["set-cookie"][0]).toContain("quizmaster_token=;");
      expect(response.headers["set-cookie"][0]).toContain("Path=/");
      expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
      expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
    }
  });

  test("password change revokes the old token and issues a working replacement", async () => {
    const user = await createUser();
    const oldCookie = authCookie(user);
    const changed = await request(app)
      .patch("/api/settings/password")
      .set("Cookie", oldCookie)
      .send({
        currentPassword: "InitialPassword123!",
        newPassword: "ReplacementPassword123!",
        confirmPassword: "ReplacementPassword123!",
      });

    expect(changed.status).toBe(200);
    await request(app)
      .get("/api/auth/me")
      .set("Accept", "application/json")
      .set("Cookie", oldCookie)
      .expect(401);
    await request(app)
      .get("/api/auth/me")
      .set("Cookie", `quizmaster_token=${tokenFromCookie(changed)}`)
      .expect(200);
  });

  test("logout clears the cookie using matching options", async () => {
    const response = await request(app).post("/api/auth/logout");
    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"][0]).toContain("quizmaster_token=;");
    expect(response.headers["set-cookie"][0]).toContain("Path=/");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
  });

  test("a current token for an inactive account is rejected without sensitive fields", async () => {
    const user = await createUser({ isActive: false });
    const response = await request(app)
      .get("/api/auth/me")
      .set("Accept", "application/json")
      .set("Cookie", authCookie(user));
    expect(response.status).toBe(403);
    expect(response.body).not.toHaveProperty("password");
    expect(response.body).not.toHaveProperty("tokenVersion");
  });
});

describe("administrator security changes revoke existing sessions", () => {
  test("role change invalidates the old token and stale administrator access", async () => {
    const actingAdmin = await createUser({ role: "admin" });
    const target = await createUser({ role: "admin" });
    const targetCookie = authCookie(target);

    await request(app)
      .patch(`/api/admin/users/${target._id}/role`)
      .set("Cookie", authCookie(actingAdmin))
      .send({ role: "user" })
      .expect(200);

    await request(app)
      .get("/api/admin/dashboard")
      .set("Accept", "application/json")
      .set("Cookie", targetCookie)
      .expect(401);
  });

  test("disable and reactivation leave the old token permanently invalid", async () => {
    const actingAdmin = await createUser({ role: "admin" });
    const target = await createUser();
    const oldCookie = authCookie(target);

    await request(app)
      .patch(`/api/admin/users/${target._id}/status`)
      .set("Cookie", authCookie(actingAdmin))
      .send({ isActive: false })
      .expect(200);
    await request(app)
      .get("/api/auth/me")
      .set("Accept", "application/json")
      .set("Cookie", oldCookie)
      .expect(401);

    const refreshedAdmin = await User.findById(actingAdmin._id);
    await request(app)
      .patch(`/api/admin/users/${target._id}/status`)
      .set("Cookie", authCookie(refreshedAdmin))
      .send({ isActive: true })
      .expect(200);
    await request(app)
      .get("/api/auth/me")
      .set("Accept", "application/json")
      .set("Cookie", oldCookie)
      .expect(401);

    const login = await request(app).post("/api/auth/login").send({
      email: target.email,
      password: "InitialPassword123!",
    });
    expect(login.status).toBe(200);
  });
});

describe("single-use recovery and verification tokens", () => {
  test("password reset is single-use and invalidates the old session", async () => {
    const user = await createUser({ email: "reset@example.invalid" });
    const oldCookie = authCookie(user);
    const requested = await request(app)
      .post("/api/password-reset/forgot")
      .send({ email: user.email });
    expect(requested.status).toBe(200);
    const rawToken = new URL(mockSentMail.resetUrl).searchParams.get("token");

    const resetPayload = {
      newPassword: "ResetPassword123!",
      confirmPassword: "ResetPassword123!",
    };
    const resetResponses = await Promise.all([
      request(app)
        .patch(`/api/password-reset/reset/${rawToken}`)
        .send(resetPayload),
      request(app)
        .patch(`/api/password-reset/reset/${rawToken}`)
        .send(resetPayload),
    ]);
    expect(resetResponses.map(({ status }) => status).sort()).toEqual([
      200, 400,
    ]);
    await request(app)
      .get("/api/auth/me")
      .set("Accept", "application/json")
      .set("Cookie", oldCookie)
      .expect(401);
  });

  test("verification is single-use and unknown reset email is generic", async () => {
    const user = await createUser({
      emailVerified: false,
      emailVerifiedAt: null,
    });
    const unknown = await request(app)
      .post("/api/password-reset/forgot")
      .send({ email: "unknown@example.invalid" });
    expect(unknown.status).toBe(200);
    expect(unknown.body).not.toHaveProperty("development");

    await request(app)
      .post("/api/email-verification/resend")
      .send({ email: user.email })
      .expect(200);
    const rawToken = new URL(mockSentMail.verificationUrl).searchParams.get(
      "token",
    );
    const verificationResponses = await Promise.all([
      request(app).get(`/api/email-verification/verify/${rawToken}`),
      request(app).get(`/api/email-verification/verify/${rawToken}`),
    ]);
    expect(verificationResponses.map(({ status }) => status).sort()).toEqual([
      200, 400,
    ]);
  });

  test("expired and invalid recovery and verification tokens are rejected", async () => {
    const resetToken = "expired-reset-token";
    const verificationToken = "expired-verification-token";
    await createUser({
      passwordResetToken: crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex"),
      passwordResetExpires: new Date(Date.now() - 1000),
      emailVerified: false,
      emailVerifiedAt: null,
      emailVerificationToken: crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex"),
      emailVerificationExpires: new Date(Date.now() - 1000),
    });

    await request(app)
      .get(`/api/password-reset/validate/${resetToken}`)
      .expect(400);
    await request(app)
      .get("/api/password-reset/validate/not-a-valid-token")
      .expect(400);
    await request(app)
      .get(`/api/email-verification/verify/${verificationToken}`)
      .expect(400);
    await request(app)
      .get("/api/email-verification/verify/not-a-valid-token")
      .expect(400);
  });
});

describe("resource ownership", () => {
  test("foreign results and notification mutations do not reveal resources", async () => {
    const owner = await createUser();
    const other = await createUser();
    const score = await Score.create({
      user: owner._id,
      category: "Java",
      answers: [],
      score: 0,
      attemptedQuestions: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      unansweredQuestions: 1,
      totalQuestions: 1,
      accuracy: 0,
      xpEarned: 0,
      timeTakenSeconds: 1,
    });
    const notification = await Notification.create({
      user: owner._id,
      title: "Private",
      message: "Owner only",
    });

    await request(app)
      .get(`/api/quiz/result/${score._id}`)
      .set("Cookie", authCookie(other))
      .expect(404);
    await request(app)
      .patch(`/api/notifications/${notification._id}/read`)
      .set("Cookie", authCookie(other))
      .expect(404);
    await request(app)
      .delete(`/api/notifications/${notification._id}`)
      .set("Cookie", authCookie(other))
      .expect(404);
  });

  test("profile and settings mutations cannot target another user", async () => {
    const owner = await createUser();
    const other = await createUser({
      firstName: "Other",
      lastName: "Person",
    });

    await request(app)
      .patch("/api/settings/profile")
      .set("Cookie", authCookie(owner))
      .send({
        userId: other._id,
        firstName: "Updated",
        lastName: "Owner",
        email: owner.email,
      })
      .expect(200);

    const unchangedOther = await User.findById(other._id).lean();
    expect(unchangedOther.firstName).toBe("Other");
    expect(unchangedOther.lastName).toBe("Person");
  });

  test("avatar upload rejects HTML disguised with an image MIME type", async () => {
    const user = await createUser();
    const response = await request(app)
      .post("/api/profile/avatar")
      .set("Cookie", authCookie(user))
      .attach("avatar", Buffer.from("<html>not an image</html>"), {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/content does not match/i);
  });
});
