"use strict";

/* global afterAll, beforeAll, jest */

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "quiz-transaction-replay-secret-that-is-at-least-thirty-two-bytes";

const app = require("../server/app");
const Achievement = require("../server/models/Achievement");
const DailyChallenge = require("../server/models/DailyChallenge");
const Notification = require("../server/models/Notification");
const Question = require("../server/models/Question");
const QuizSession = require("../server/models/QuizSession");
const Score = require("../server/models/Score");
const User = require("../server/models/User");
const {
  createDailyChallenge,
} = require("../server/services/dailyChallengeService");
const { createAuthToken } = require("../server/utils/authToken");

const SYSTEM_MONGOD = "/usr/bin/mongod";
const MONGODB_VERSION = "8.0.28";
const CATEGORY = "Replay Safety";

let replicaSet;
let primaryUser;
let foreignUser;

function authCookie(user) {
  return `quizmaster_token=${createAuthToken({
    userId: user._id,
    tokenVersion: user.tokenVersion,
  })}`;
}

async function createUser(email) {
  return User.create({
    firstName: "Replay",
    lastName: "Tester",
    email,
    password: "StageThreePassword123!",
    emailVerified: true,
  });
}

async function createQuestion(question = "Which answer is correct?") {
  return Question.create({
    question,
    options: ["Correct", "Wrong 1", "Wrong 2", "Wrong 3"],
    correctAnswer: 0,
    category: CATEGORY,
    difficulty: "Easy",
    explanation: "The first answer is correct.",
    isActive: true,
  });
}

async function startStandardQuiz(user = primaryUser, questionCount = 20) {
  return request(app)
    .get(
      `/api/quiz/start/${encodeURIComponent(CATEGORY)}?limit=${questionCount}`,
    )
    .set("Accept", "application/json")
    .set("Cookie", authCookie(user));
}

async function createDirectSession({
  user = primaryUser,
  questions,
  status = "active",
  mode = "standard",
  dailyChallenge = null,
  expired = false,
} = {}) {
  const startedAt = expired
    ? new Date(Date.now() - 60 * 60 * 1000)
    : new Date();

  return QuizSession.create({
    user: user._id,
    category: CATEGORY,
    questions: questions.map((question) => question._id || question),
    mode,
    dailyChallenge,
    status,
    startedAt,
    expiresAt: expired
      ? new Date(Date.now() - 60 * 1000)
      : new Date(Date.now() + 30 * 60 * 1000),
  });
}

function submissionPayload(sessionId, questions, overrides = {}) {
  return {
    quizSessionId: sessionId,
    answers: questions.map((question) => ({
      questionId: String(question._id || question.id || question),
      selectedAnswer: 0,
    })),
    ...overrides,
  };
}

async function submit(user, payload) {
  return request(app)
    .post("/api/quiz/submit")
    .set("Accept", "application/json")
    .set("Cookie", authCookie(user))
    .send(payload);
}

async function startDailyQuiz(user = primaryUser) {
  const challenge = await createDailyChallenge({ questionCount: 1 });
  const response = await request(app)
    .post(`/api/daily-challenge/${challenge._id}/start`)
    .set("Accept", "application/json")
    .set("Cookie", authCookie(user));

  return { challenge, response };
}

async function readAuthoritativeState(userId = primaryUser._id) {
  const [user, scoreCount, achievementCount, notificationCount] =
    await Promise.all([
      User.findById(userId).lean(),
      Score.countDocuments({ user: userId }),
      Achievement.countDocuments({ user: userId }),
      Notification.countDocuments({ user: userId }),
    ]);

  return {
    totalXp: user.totalXp,
    quizzesCompleted: user.quizzesCompleted,
    correctAnswers: user.correctAnswers,
    scoreCount,
    achievementCount,
    notificationCount,
  };
}

async function expectRolledBack(sessionId, challengeId = null) {
  const [state, session, challenge] = await Promise.all([
    readAuthoritativeState(),
    QuizSession.findOne({ sessionId }).lean(),
    challengeId ? DailyChallenge.findById(challengeId).lean() : null,
  ]);

  expect(state).toEqual({
    totalXp: 0,
    quizzesCompleted: 0,
    correctAnswers: 0,
    scoreCount: 0,
    achievementCount: 0,
    notificationCount: 0,
  });
  expect(session.status).toBe("active");
  expect(session.result).toBeNull();
  expect(session.completedAt).toBeNull();
  if (challenge) expect(challenge.completions).toHaveLength(0);
}

beforeAll(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  replicaSet = await MongoMemoryReplSet.create({
    binary: { systemBinary: SYSTEM_MONGOD, version: MONGODB_VERSION },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  await mongoose.connect(replicaSet.getUri("quizmaster-stage-three"));
  await Promise.all([
    Achievement.init(),
    DailyChallenge.init(),
    Notification.init(),
    Question.init(),
    QuizSession.init(),
    Score.init(),
    User.init(),
  ]);
});

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});

  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );

  primaryUser = await createUser("primary-replay@example.invalid");
  foreignUser = await createUser("foreign-replay@example.invalid");
});

afterAll(async () => {
  jest.restoreAllMocks();
  await mongoose.disconnect();
  await replicaSet?.stop();
});

describe("server-authoritative standard completion", () => {
  test("minimal session-and-answers payload completes exactly once", async () => {
    await createQuestion();
    const start = await startStandardQuiz();
    const payload = submissionPayload(
      start.body.quizSessionId,
      start.body.questions,
      {
        remainingSeconds: 0,
        quizDurationSeconds: 999999,
      },
    );

    const response = await submit(primaryUser, payload);
    const session = await QuizSession.findOne({
      sessionId: start.body.quizSessionId,
    }).lean();
    const score = await Score.findOne({ quizSession: session._id }).lean();
    const state = await readAuthoritativeState();

    expect(response.status).toBe(201);
    expect(response.body.result).toEqual(
      expect.objectContaining({
        score: 1,
        correctAnswers: 1,
        xpEarned: 30,
        isDailyChallenge: false,
        dailyChallengeId: null,
      }),
    );
    expect(response.body.result.timeTakenSeconds).toBeLessThan(30);
    expect(session.status).toBe("completed");
    expect(String(session.result)).toBe(String(score._id));
    expect(state.totalXp).toBe(30);
    expect(state.quizzesCompleted).toBe(1);
    expect(state.correctAnswers).toBe(1);
    expect(state.scoreCount).toBe(1);
  });

  test("completed replay returns its result ID without additional side effects", async () => {
    await createQuestion();
    const start = await startStandardQuiz();
    const payload = submissionPayload(
      start.body.quizSessionId,
      start.body.questions,
    );
    const first = await submit(primaryUser, payload);
    const stateAfterFirst = await readAuthoritativeState();

    const replay = await submit(primaryUser, payload);
    const stateAfterReplay = await readAuthoritativeState();

    expect(replay.status).toBe(409);
    expect(replay.body).toEqual(
      expect.objectContaining({
        success: false,
        replayed: true,
        existingResultId: first.body.result.resultId,
      }),
    );
    expect(stateAfterReplay).toEqual(stateAfterFirst);
  });

  test("two identical concurrent requests create one score and one reward", async () => {
    await createQuestion();
    const start = await startStandardQuiz();
    const payload = submissionPayload(
      start.body.quizSessionId,
      start.body.questions,
    );

    const responses = await Promise.all([
      submit(primaryUser, payload),
      submit(primaryUser, payload),
    ]);
    const state = await readAuthoritativeState();

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(state.totalXp).toBe(30);
    expect(state.quizzesCompleted).toBe(1);
    expect(state.correctAnswers).toBe(1);
    expect(state.scoreCount).toBe(1);
  });

  test("question order does not bypass or invalidate exact-set matching", async () => {
    await createQuestion("Question one");
    await createQuestion("Question two");
    const start = await startStandardQuiz();
    const reversed = [...start.body.questions].reverse();

    const response = await submit(
      primaryUser,
      submissionPayload(start.body.quizSessionId, reversed),
    );

    expect(response.status).toBe(201);
    expect(await Score.countDocuments()).toBe(1);
  });
});

describe("session states, ownership, and exact answer sets", () => {
  test("foreign user cannot submit or discover the result", async () => {
    const question = await createQuestion();
    const session = await createDirectSession({ questions: [question] });
    const payload = submissionPayload(session.sessionId, [question]);

    const foreignSubmission = await submit(foreignUser, payload);
    expect(foreignSubmission.status).toBe(404);

    const completion = await submit(primaryUser, payload);
    const foreignResult = await request(app)
      .get(`/api/quiz/result/${completion.body.result.resultId}`)
      .set("Accept", "application/json")
      .set("Cookie", authCookie(foreignUser));
    expect(foreignResult.status).toBe(404);
  });

  test.each([
    ["expired", "expired", true, 410, /expired/i],
    ["cancelled", "cancelled", false, 409, /cancelled/i],
    ["processing", "processing", false, 409, /already being processed/i],
  ])(
    "%s session is rejected without writes",
    async (_label, status, expired, expectedStatus, message) => {
      const question = await createQuestion();
      const session = await createDirectSession({
        questions: [question],
        status,
        expired,
      });

      const response = await submit(
        primaryUser,
        submissionPayload(session.sessionId, [question]),
      );

      expect(response.status).toBe(expectedStatus);
      expect(response.body.message).toMatch(message);
      expect(await readAuthoritativeState()).toEqual({
        totalXp: 0,
        quizzesCompleted: 0,
        correctAnswers: 0,
        scoreCount: 0,
        achievementCount: 0,
        notificationCount: 0,
      });
    },
  );

  test("missing question is rejected", async () => {
    const first = await createQuestion("First expected question");
    const second = await createQuestion("Second expected question");
    const session = await createDirectSession({ questions: [first, second] });

    const response = await submit(
      primaryUser,
      submissionPayload(session.sessionId, [first]),
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/do not match/i);
  });

  test("extra question is rejected", async () => {
    const expected = await createQuestion("Expected question");
    const extra = await createQuestion("Extra question");
    const session = await createDirectSession({ questions: [expected] });

    const response = await submit(
      primaryUser,
      submissionPayload(session.sessionId, [expected, extra]),
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/do not match/i);
  });

  test("duplicate submitted question ID is rejected", async () => {
    const question = await createQuestion();
    const session = await createDirectSession({ questions: [question] });
    const payload = submissionPayload(session.sessionId, [question]);
    payload.answers.push({ ...payload.answers[0] });

    const response = await submit(primaryUser, payload);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/same question/i);
  });

  test("invalid selected-answer index is rejected", async () => {
    const question = await createQuestion();
    const session = await createDirectSession({ questions: [question] });
    const payload = submissionPayload(session.sessionId, [question]);
    payload.answers[0].selectedAnswer = 4;

    const response = await submit(primaryUser, payload);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/selected answer/i);
  });

  test("null answer preserves the existing unanswered policy", async () => {
    const question = await createQuestion();
    const session = await createDirectSession({ questions: [question] });
    const payload = submissionPayload(session.sessionId, [question]);
    payload.answers[0].selectedAnswer = null;

    const response = await submit(primaryUser, payload);

    expect(response.status).toBe(201);
    expect(response.body.result).toEqual(
      expect.objectContaining({
        attemptedQuestions: 0,
        unansweredQuestions: 1,
        xpEarned: 0,
      }),
    );
  });

  test("legacy category mismatch is rejected but category omission is accepted", async () => {
    const question = await createQuestion();
    const mismatchedSession = await createDirectSession({
      questions: [question],
    });
    const mismatch = await submit(
      primaryUser,
      submissionPayload(mismatchedSession.sessionId, [question], {
        category: "Client Override",
      }),
    );
    expect(mismatch.status).toBe(400);

    const minimalSession = await createDirectSession({ questions: [question] });
    const minimal = await submit(
      primaryUser,
      submissionPayload(minimalSession.sessionId, [question]),
    );
    expect(minimal.status).toBe(201);
  });

  test("legacy mode mismatch is rejected but mode omission is accepted", async () => {
    const question = await createQuestion();
    const mismatchedSession = await createDirectSession({
      questions: [question],
    });
    const mismatch = await submit(
      primaryUser,
      submissionPayload(mismatchedSession.sessionId, [question], {
        mode: "daily",
      }),
    );
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.message).toMatch(/mode does not match/i);

    const minimalSession = await createDirectSession({ questions: [question] });
    const minimal = await submit(
      primaryUser,
      submissionPayload(minimalSession.sessionId, [question]),
    );
    expect(minimal.status).toBe(201);
  });

  test("standard and daily identity cannot be confused by legacy fields", async () => {
    const question = await createQuestion();
    const standardSession = await createDirectSession({
      questions: [question],
    });
    const response = await submit(
      primaryUser,
      submissionPayload(standardSession.sessionId, [question], {
        dailyChallengeId: new mongoose.Types.ObjectId().toString(),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/daily challenge does not match/i);
  });
});

describe("daily challenge transactional replay protection", () => {
  test("daily mode is derived from the session and rewards are granted once", async () => {
    await createQuestion();
    const { challenge, response: start } = await startDailyQuiz();
    const payload = submissionPayload(
      start.body.quizSessionId,
      start.body.challenge.questions,
    );

    const completion = await submit(primaryUser, payload);
    const replay = await submit(primaryUser, payload);
    const state = await readAuthoritativeState();
    const savedChallenge = await DailyChallenge.findById(challenge._id).lean();

    expect(completion.status).toBe(201);
    expect(completion.body.result.isDailyChallenge).toBe(true);
    expect(completion.body.result.dailyChallengeId).toBe(String(challenge._id));
    expect(completion.body.result.xpEarned).toBe(130);
    expect(replay.status).toBe(409);
    expect(state.totalXp).toBe(130);
    expect(state.scoreCount).toBe(1);
    expect(savedChallenge.completions).toHaveLength(1);
  });

  test("two concurrent daily submissions complete and reward once", async () => {
    await createQuestion();
    const { challenge, response: start } = await startDailyQuiz();
    const payload = submissionPayload(
      start.body.quizSessionId,
      start.body.challenge.questions,
    );

    const responses = await Promise.all([
      submit(primaryUser, payload),
      submit(primaryUser, payload),
    ]);
    const state = await readAuthoritativeState();
    const savedChallenge = await DailyChallenge.findById(challenge._id).lean();

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(state.totalXp).toBe(130);
    expect(state.scoreCount).toBe(1);
    expect(savedChallenge.completions).toHaveLength(1);
  });

  test("daily session rejects a mismatched legacy challenge identity", async () => {
    await createQuestion();
    const { response: start } = await startDailyQuiz();
    const payload = submissionPayload(
      start.body.quizSessionId,
      start.body.challenge.questions,
      { dailyChallengeId: new mongoose.Types.ObjectId().toString() },
    );

    const response = await submit(primaryUser, payload);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/daily challenge does not match/i);
  });

  test("disabled-after-issuance daily question remains valid for its session", async () => {
    const question = await createQuestion();
    const { response: start } = await startDailyQuiz();
    await Question.updateOne({ _id: question._id }, { isActive: false });

    const response = await submit(
      primaryUser,
      submissionPayload(
        start.body.quizSessionId,
        start.body.challenge.questions,
      ),
    );

    expect(response.status).toBe(201);
  });
});

describe("transaction failure rollback and retry policy", () => {
  const FAILURE_CASES = [
    {
      name: "after claim before score creation",
      installFailure() {
        return jest
          .spyOn(Score, "create")
          .mockRejectedValueOnce(new Error("Injected score failure"));
      },
    },
    {
      name: "after score creation before user update",
      installFailure() {
        return jest
          .spyOn(User, "findOneAndUpdate")
          .mockRejectedValueOnce(new Error("Injected user update failure"));
      },
    },
    {
      name: "during achievement writes",
      installFailure() {
        return jest
          .spyOn(Achievement, "create")
          .mockRejectedValueOnce(new Error("Injected achievement failure"));
      },
    },
    {
      name: "during notification writes",
      installFailure() {
        return jest
          .spyOn(Notification, "insertMany")
          .mockRejectedValueOnce(new Error("Injected notification failure"));
      },
    },
    {
      name: "before final session completion",
      installFailure() {
        return jest
          .spyOn(QuizSession.prototype, "save")
          .mockRejectedValueOnce(new Error("Injected final session failure"));
      },
    },
  ];

  test.each(FAILURE_CASES)(
    "rolls back $name and permits a safe retry",
    async ({ installFailure }) => {
      await createQuestion();
      const start = await startStandardQuiz();
      const payload = submissionPayload(
        start.body.quizSessionId,
        start.body.questions,
      );
      const failure = installFailure();

      const failedResponse = await submit(primaryUser, payload);
      failure.mockRestore();

      expect(failedResponse.status).toBe(500);
      await expectRolledBack(start.body.quizSessionId);

      const retry = await submit(primaryUser, payload);
      expect(retry.status).toBe(201);
      expect((await readAuthoritativeState()).scoreCount).toBe(1);
    },
  );

  test("rolls back user, score, and session when daily completion fails", async () => {
    await createQuestion();
    const { challenge, response: start } = await startDailyQuiz();
    const payload = submissionPayload(
      start.body.quizSessionId,
      start.body.challenge.questions,
    );
    const failure = jest
      .spyOn(DailyChallenge, "findOneAndUpdate")
      .mockRejectedValueOnce(new Error("Injected daily completion failure"));

    const failedResponse = await submit(primaryUser, payload);
    failure.mockRestore();

    expect(failedResponse.status).toBe(500);
    await expectRolledBack(start.body.quizSessionId, challenge._id);

    const retry = await submit(primaryUser, payload);
    expect(retry.status).toBe(201);
    expect((await readAuthoritativeState()).totalXp).toBe(130);
  });
});
