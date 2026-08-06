"use strict";

/* global afterAll, beforeAll */

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "inactive-question-policy-secret-that-is-at-least-thirty-two-bytes";

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
  getAvailableChallengeGroups,
} = require("../server/services/dailyChallengeService");
const { createAuthToken } = require("../server/utils/authToken");

const SYSTEM_MONGOD = "/usr/bin/mongod";
const CATEGORY = "Inactive Policy";

let replicaSet;
let primaryUser;
let secondUser;

function authCookie(user) {
  return `quizmaster_token=${createAuthToken({
    userId: user._id,
    tokenVersion: user.tokenVersion,
  })}`;
}

async function createUser(email) {
  return User.create({
    firstName: "Policy",
    lastName: "Tester",
    email,
    password: "StageTwoPassword123!",
    emailVerified: true,
  });
}

async function createQuestion({
  category = CATEGORY,
  isActive = true,
  question = "Which option is correct?",
} = {}) {
  return Question.create({
    question,
    options: ["Correct", "Wrong 1", "Wrong 2", "Wrong 3"],
    correctAnswer: 0,
    category,
    difficulty: "Easy",
    explanation: "The first option is correct.",
    isActive,
  });
}

async function createLegacyQuestion({ category = CATEGORY } = {}) {
  const result = await Question.collection.insertOne({
    question: "Which legacy option is correct?",
    options: ["Correct", "Wrong 1", "Wrong 2", "Wrong 3"],
    correctAnswer: 0,
    category,
    difficulty: "Easy",
    explanation: "Legacy question without an activity field.",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return Question.findById(result.insertedId);
}

async function startStandardQuiz(user = primaryUser, category = CATEGORY) {
  return request(app)
    .get(`/api/quiz/start/${encodeURIComponent(category)}?limit=20`)
    .set("Accept", "application/json")
    .set("Cookie", authCookie(user));
}

function createSubmission({
  sessionId,
  questions,
  category = CATEGORY,
  dailyId,
}) {
  return {
    quizSessionId: sessionId,
    category,
    answers: questions.map((question) => ({
      questionId: String(question._id || question.id || question),
      selectedAnswer: 0,
    })),
    remainingSeconds: 500,
    quizDurationSeconds: 600,
    dailyChallengeId: dailyId || null,
  };
}

async function submitQuiz(user, payload) {
  return request(app)
    .post("/api/quiz/submit")
    .set("Accept", "application/json")
    .set("Cookie", authCookie(user))
    .send(payload);
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    binary: { systemBinary: SYSTEM_MONGOD, version: "8.0.28" },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  await mongoose.connect(replicaSet.getUri("quizmaster-stage-two"));
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
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );

  primaryUser = await createUser("primary-policy@example.invalid");
  secondUser = await createUser("second-policy@example.invalid");
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet?.stop();
});

describe("new standard quiz selection", () => {
  test("includes active and legacy questions while excluding inactive questions", async () => {
    const active = await createQuestion({
      question: "Active standard question",
    });
    const inactive = await createQuestion({
      question: "Inactive standard question",
      isActive: false,
    });
    const legacy = await createLegacyQuestion();

    const response = await startStandardQuiz();

    expect(response.status).toBe(200);
    const selectedIds = response.body.questions.map((question) => question._id);
    expect(selectedIds).toEqual(
      expect.arrayContaining([String(active._id), String(legacy._id)]),
    );
    expect(selectedIds).not.toContain(String(inactive._id));

    const session = await QuizSession.findOne({
      sessionId: response.body.quizSessionId,
    }).lean();
    expect(session.questions.map(String)).toEqual(
      expect.arrayContaining([String(active._id), String(legacy._id)]),
    );
    expect(session.questions.map(String)).not.toContain(String(inactive._id));
  });

  test("a question disabled before issuance cannot enter a new session", async () => {
    const disabled = await createQuestion({ isActive: false });
    const eligible = await createQuestion({ question: "Eligible replacement" });

    const response = await startStandardQuiz();

    expect(response.status).toBe(200);
    const session = await QuizSession.findOne({
      sessionId: response.body.quizSessionId,
    }).lean();
    expect(session.questions.map(String)).toEqual([String(eligible._id)]);
    expect(session.questions.map(String)).not.toContain(String(disabled._id));
  });
});

describe("daily challenge selection", () => {
  test("counts and samples active and legacy questions but excludes inactive ones", async () => {
    const active = await createQuestion({ question: "Active daily question" });
    const inactive = await createQuestion({
      question: "Inactive daily question",
      isActive: false,
    });
    const legacy = await createLegacyQuestion();

    const groups = await getAvailableChallengeGroups(2);
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: CATEGORY, questionCount: 2 }),
      ]),
    );

    const challenge = await createDailyChallenge({
      date: new Date(),
      questionCount: 2,
    });
    const selectedIds = challenge.questions.map((question) =>
      String(question._id || question),
    );
    expect(selectedIds).toEqual(
      expect.arrayContaining([String(active._id), String(legacy._id)]),
    );
    expect(selectedIds).not.toContain(String(inactive._id));
  });
});

describe("authoritative session submission", () => {
  test("completes a session once after its selected question is disabled", async () => {
    const question = await createQuestion();
    const start = await startStandardQuiz();
    const payload = createSubmission({
      sessionId: start.body.quizSessionId,
      questions: start.body.questions,
    });

    await Question.updateOne({ _id: question._id }, { isActive: false });

    const completion = await submitQuiz(primaryUser, payload);
    expect(completion.status).toBe(201);
    expect(completion.body.result.score).toBe(1);

    const userAfterFirstSubmission = await User.findById(
      primaryUser._id,
    ).lean();
    const replay = await submitQuiz(primaryUser, payload);
    const userAfterReplay = await User.findById(primaryUser._id).lean();

    expect(replay.status).toBe(409);
    expect(userAfterReplay.totalXp).toBe(userAfterFirstSubmission.totalXp);
    expect(userAfterReplay.quizzesCompleted).toBe(1);
    expect(await Score.countDocuments({ user: primaryUser._id })).toBe(1);
  });

  test("rejects an arbitrary inactive question outside the session", async () => {
    await createQuestion();
    const arbitraryInactive = await createQuestion({
      question: "Client substituted inactive question",
      isActive: false,
    });
    const start = await startStandardQuiz();
    const payload = createSubmission({
      sessionId: start.body.quizSessionId,
      questions: [arbitraryInactive],
    });

    const response = await submitQuiz(primaryUser, payload);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/do not match this quiz session/i);
    expect(await Score.countDocuments()).toBe(0);
  });

  test("rejects an altered or incomplete session question set", async () => {
    await createQuestion({ question: "Expected question one" });
    await createQuestion({ question: "Expected question two" });
    const start = await startStandardQuiz();
    const payload = createSubmission({
      sessionId: start.body.quizSessionId,
      questions: start.body.questions.slice(0, 1),
    });

    const response = await submitQuiz(primaryUser, payload);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/do not match this quiz session/i);
  });

  test("rejects another user's session", async () => {
    await createQuestion();
    const start = await startStandardQuiz(primaryUser);
    const payload = createSubmission({
      sessionId: start.body.quizSessionId,
      questions: start.body.questions,
    });

    const response = await submitQuiz(secondUser, payload);

    expect(response.status).toBe(404);
    expect(await Score.countDocuments()).toBe(0);
  });

  test("rejects an expired session", async () => {
    const question = await createQuestion();
    const startedAt = new Date(Date.now() - 60 * 60 * 1000);
    const session = await QuizSession.create({
      user: primaryUser._id,
      category: CATEGORY,
      questions: [question._id],
      mode: "standard",
      startedAt,
      expiresAt: new Date(Date.now() - 60 * 1000),
    });
    const payload = createSubmission({
      sessionId: session.sessionId,
      questions: [question],
    });

    const response = await submitQuiz(primaryUser, payload);

    expect(response.status).toBe(410);
    expect(await Score.countDocuments()).toBe(0);
  });

  test("rejects client category and mode values that disagree with the session", async () => {
    await createQuestion();
    const start = await startStandardQuiz();
    const wrongCategory = createSubmission({
      sessionId: start.body.quizSessionId,
      questions: start.body.questions,
      category: "Client Override",
    });

    const categoryResponse = await submitQuiz(primaryUser, wrongCategory);
    expect(categoryResponse.status).toBe(400);
    expect(categoryResponse.body.message).toMatch(
      /does not match this quiz session/i,
    );

    const wrongMode = {
      ...createSubmission({
        sessionId: start.body.quizSessionId,
        questions: start.body.questions,
      }),
      dailyChallengeId: new mongoose.Types.ObjectId().toString(),
    };
    const modeResponse = await submitQuiz(primaryUser, wrongMode);
    expect(modeResponse.status).toBe(400);
    expect(modeResponse.body.message).toMatch(
      /does not match this quiz session/i,
    );
  });
});

describe("historical and daily issued-session behavior", () => {
  test("historical result population still includes a now-disabled question", async () => {
    const question = await createQuestion();
    const start = await startStandardQuiz();
    const completion = await submitQuiz(
      primaryUser,
      createSubmission({
        sessionId: start.body.quizSessionId,
        questions: start.body.questions,
      }),
    );
    await Question.updateOne({ _id: question._id }, { isActive: false });

    const result = await request(app)
      .get(`/api/quiz/result/${completion.body.result.resultId}`)
      .set("Accept", "application/json")
      .set("Cookie", authCookie(primaryUser));

    expect(result.status).toBe(200);
    expect(result.body.result.answers[0].question._id).toBe(
      String(question._id),
    );
    expect(result.body.result.answers[0].question.question).toBe(
      "Which option is correct?",
    );
  });

  test("an issued daily session completes once after its question is disabled", async () => {
    const question = await createQuestion();
    const challenge = await createDailyChallenge({ questionCount: 1 });
    const start = await request(app)
      .post(`/api/daily-challenge/${challenge._id}/start`)
      .set("Accept", "application/json")
      .set("Cookie", authCookie(primaryUser));

    expect(start.status).toBe(200);
    await Question.updateOne({ _id: question._id }, { isActive: false });

    const payload = createSubmission({
      sessionId: start.body.quizSessionId,
      questions: start.body.challenge.questions,
      category: challenge.category,
      dailyId: String(challenge._id),
    });
    const completion = await submitQuiz(primaryUser, payload);
    const replay = await submitQuiz(primaryUser, payload);

    expect(completion.status).toBe(201);
    expect(completion.body.dailyChallenge.completed).toBe(true);
    expect(replay.status).toBe(409);
    expect(await Score.countDocuments({ user: primaryUser._id })).toBe(1);

    const savedChallenge = await DailyChallenge.findById(challenge._id).lean();
    expect(savedChallenge.completions).toHaveLength(1);
  });

  test("a stored challenge cannot create a new session after a question is disabled", async () => {
    const question = await createQuestion();
    const challenge = await createDailyChallenge({ questionCount: 1 });
    await Question.updateOne({ _id: question._id }, { isActive: false });

    const response = await request(app)
      .post(`/api/daily-challenge/${challenge._id}/start`)
      .set("Accept", "application/json")
      .set("Cookie", authCookie(primaryUser));

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/no longer available/i);
    expect(
      await QuizSession.countDocuments({
        user: primaryUser._id,
        dailyChallenge: challenge._id,
      }),
    ).toBe(0);
  });
});
