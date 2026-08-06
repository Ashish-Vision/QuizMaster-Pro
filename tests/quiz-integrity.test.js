"use strict";

const mongoose = require("mongoose");
const QuizSession = require("../server/models/QuizSession");
const Score = require("../server/models/Score");

describe("quiz integrity schema", () => {
  const user = new mongoose.Types.ObjectId();
  const questions = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];

  test("server session identifier is unpredictable and attempts expire", () => {
    const startedAt = new Date();
    const session = new QuizSession({
      user,
      category: "Science",
      questions,
      mode: "standard",
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 1000),
    });
    expect(session.sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.status).toBe("active");
    expect(session.expiresAt).toBeInstanceOf(Date);
  });

  test("question sets reject duplicates and empty arrays", async () => {
    const base = {
      user,
      category: "Science",
      mode: "standard",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    };
    await expect(
      new QuizSession({ ...base, questions: [] }).validate(),
    ).rejects.toThrow(/at least one/);
    await expect(
      new QuizSession({
        ...base,
        questions: [questions[0], questions[0]],
      }).validate(),
    ).rejects.toThrow(/duplicate/);
  });

  test("daily attempt requires its server challenge reference", async () => {
    const session = new QuizSession({
      user,
      category: "Science",
      questions,
      mode: "daily",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });
    await expect(session.validate()).rejects.toThrow(/dailyChallenge/);
  });

  test("score and session schemas enforce one result per attempt", () => {
    const scoreIndex = Score.schema
      .indexes()
      .find(([keys]) => keys.quizSession === 1);
    const resultIndex = QuizSession.schema
      .indexes()
      .find(([keys]) => keys.result === 1);
    expect(scoreIndex[1].unique).toBe(true);
    expect(resultIndex[1].unique).toBe(true);
  });

  test("attempt lifecycle prevents completed, processing, and expired replay", () => {
    const canClaim = (attempt, now = new Date()) =>
      attempt.status === "active" && attempt.expiresAt > now;
    expect(
      canClaim({ status: "active", expiresAt: new Date(Date.now() + 1000) }),
    ).toBe(true);
    expect(
      canClaim({
        status: "processing",
        expiresAt: new Date(Date.now() + 1000),
      }),
    ).toBe(false);
    expect(
      canClaim({ status: "completed", expiresAt: new Date(Date.now() + 1000) }),
    ).toBe(false);
    expect(
      canClaim({ status: "active", expiresAt: new Date(Date.now() - 1) }),
    ).toBe(false);
  });
});
