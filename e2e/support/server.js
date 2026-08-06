"use strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "e2e-only-secret-that-is-at-least-thirty-two-bytes";

const app = require("../../server/app");
const User = require("../../server/models/User");

const USER_ID = "64b000000000000000000001";
const ADMIN_ID = "64b000000000000000000002";

User.findById = (id) => ({
  select: async () => {
    if (![USER_ID, ADMIN_ID].includes(String(id))) return null;
    return {
      _id: id,
      id: String(id),
      firstName: String(id) === ADMIN_ID ? "Admin" : "Test",
      lastName: "User",
      email: "test@example.invalid",
      role: String(id) === ADMIN_ID ? "admin" : "user",
      tokenVersion: 0,
      isActive: true,
      totalXp: 0,
      quizzesCompleted: 0,
      correctAnswers: 0,
      currentStreak: 0,
    };
  },
});

app.listen(5000, "127.0.0.1");
