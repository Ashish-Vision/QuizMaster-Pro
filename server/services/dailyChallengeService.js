"use strict";

const mongoose = require("mongoose");

const DailyChallenge = require("../models/DailyChallenge");
const Question = require("../models/Question");

const DEFAULT_QUESTION_COUNT = 5;
const DEFAULT_REWARD_XP = 100;

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function normalizeQuestionCount(value) {
  const parsedCount = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedCount) || parsedCount < 1) {
    return DEFAULT_QUESTION_COUNT;
  }

  return Math.min(parsedCount, 25);
}

function getDateKey(date = new Date()) {
  return DailyChallenge.getDateKey(date);
}

function getUtcDayRange(date = new Date()) {
  return DailyChallenge.getUtcDayRange(date);
}

function getMillisecondsRemaining(expiresAt) {
  const expirationTime = new Date(expiresAt).getTime();

  if (Number.isNaN(expirationTime)) {
    return 0;
  }

  return Math.max(expirationTime - Date.now(), 0);
}

function createDateSeed(dateKey) {
  return String(dateKey)
    .split("")
    .reduce(
      (seed, character) => (seed * 31 + character.charCodeAt(0)) >>> 0,
      0,
    );
}

function getUserCompletion(challenge, userId) {
  if (!challenge || !userId) {
    return null;
  }

  const completions = Array.isArray(challenge.completions)
    ? challenge.completions
    : [];

  return (
    completions.find(
      (completion) =>
        String(completion.user?._id || completion.user) === String(userId),
    ) || null
  );
}

function serializeQuestion(question) {
  if (!question) {
    return null;
  }

  return {
    id: question._id || question.id,
    question: question.question,
    options: Array.isArray(question.options) ? question.options : [],
    category: question.category,
    difficulty: question.difficulty,
    explanation: question.explanation || "",
  };
}

function serializeCompletion(completion) {
  if (!completion) {
    return null;
  }

  return {
    score: normalizeNumber(completion.score),
    totalQuestions: normalizeNumber(completion.totalQuestions),
    accuracy: normalizeNumber(completion.accuracy),
    xpAwarded: normalizeNumber(completion.xpAwarded),
    resultId: completion.result?._id || completion.result || null,
    completedAt: completion.completedAt || null,
  };
}

function serializeDailyChallenge(challenge, userId = null) {
  if (!challenge) {
    return null;
  }

  const completion = getUserCompletion(challenge, userId);

  const questions = Array.isArray(challenge.questions)
    ? challenge.questions.map(serializeQuestion).filter(Boolean)
    : [];

  const now = new Date();

  return {
    id: challenge._id || challenge.id,
    dateKey: challenge.dateKey,
    title: challenge.title,
    description: challenge.description,
    category: challenge.category,
    difficulty: challenge.difficulty,
    questionCount: challenge.questionCount,
    rewardXp: challenge.rewardXp,

    rewardBadge: {
      code: challenge.rewardBadge?.code || "DAILY_CHALLENGER",

      title: challenge.rewardBadge?.title || "Daily Challenger",

      icon: challenge.rewardBadge?.icon || "🔥",
    },

    startsAt: challenge.startsAt,
    expiresAt: challenge.expiresAt,

    millisecondsRemaining: getMillisecondsRemaining(challenge.expiresAt),

    isActive: Boolean(challenge.isActive),

    isAvailable: Boolean(
      challenge.isActive &&
      new Date(challenge.startsAt) <= now &&
      new Date(challenge.expiresAt) > now,
    ),

    completed: Boolean(completion),

    completion: serializeCompletion(completion),

    questions,
  };
}

/*
 * A category is eligible when it has enough questions
 * across all difficulties combined.
 */
async function getAvailableChallengeGroups(
  questionCount = DEFAULT_QUESTION_COUNT,
) {
  const requiredCount = normalizeQuestionCount(questionCount);

  return Question.aggregate([
    {
      $match: {
        category: {
          $type: "string",
          $ne: "",
        },

        difficulty: {
          $in: ["Easy", "Medium", "Hard"],
        },

        isActive: {
          $ne: false,
        },
      },
    },

    {
      $group: {
        _id: "$category",

        questionCount: {
          $sum: 1,
        },

        difficulties: {
          $addToSet: "$difficulty",
        },
      },
    },

    {
      $match: {
        questionCount: {
          $gte: requiredCount,
        },
      },
    },

    {
      $project: {
        _id: 0,
        category: "$_id",
        questionCount: 1,
        difficulties: 1,
      },
    },

    {
      $sort: {
        category: 1,
      },
    },
  ]);
}

function chooseDailyGroup(groups, dateKey) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return null;
  }

  const seed = createDateSeed(dateKey);

  return groups[seed % groups.length];
}

async function selectChallengeQuestions({ category, questionCount }) {
  const safeQuestionCount = normalizeQuestionCount(questionCount);

  const questions = await Question.aggregate([
    {
      $match: {
        category,

        isActive: {
          $ne: false,
        },
      },
    },

    {
      $sample: {
        size: safeQuestionCount,
      },
    },

    {
      $project: {
        _id: 1,
      },
    },
  ]);

  if (questions.length !== safeQuestionCount) {
    throw new Error(`Not enough questions are available for ${category}.`);
  }

  return questions.map((question) => question._id);
}

async function populateChallenge(challenge) {
  if (!challenge) {
    return null;
  }

  await challenge.populate({
    path: "questions",

    select: [
      "question",
      "options",
      "category",
      "difficulty",
      "explanation",
    ].join(" "),
  });

  return challenge;
}

async function findChallengeByDate(
  date = new Date(),
  { populateQuestions = true } = {},
) {
  let query = DailyChallenge.findOne({
    dateKey: getDateKey(date),
    isActive: true,
  });

  if (populateQuestions) {
    query = query.populate({
      path: "questions",

      select: [
        "question",
        "options",
        "category",
        "difficulty",
        "explanation",
      ].join(" "),
    });
  }

  return query;
}

async function createDailyChallenge({
  date = new Date(),
  questionCount = DEFAULT_QUESTION_COUNT,
  createdBy = null,
} = {}) {
  const safeQuestionCount = normalizeQuestionCount(questionCount);

  const dateKey = getDateKey(date);

  const existingChallenge = await findChallengeByDate(date);

  if (existingChallenge) {
    return existingChallenge;
  }

  const groups = await getAvailableChallengeGroups(safeQuestionCount);

  if (groups.length === 0) {
    throw new Error(`No category has at least ${safeQuestionCount} questions.`);
  }

  const selectedGroup = chooseDailyGroup(groups, dateKey);

  const questionIds = await selectChallengeQuestions({
    category: selectedGroup.category,
    questionCount: safeQuestionCount,
  });

  const { startsAt, expiresAt } = getUtcDayRange(date);

  try {
    const challenge = await DailyChallenge.create({
      dateKey,

      title: "Daily Challenge",

      description: "Complete today's mixed-difficulty quiz to earn bonus XP.",

      category: selectedGroup.category,

      difficulty: "Mixed",

      questions: questionIds,

      questionCount: safeQuestionCount,

      rewardXp: DEFAULT_REWARD_XP,

      rewardBadge: {
        code: "DAILY_CHALLENGER",
        title: "Daily Challenger",
        icon: "🔥",
      },

      startsAt,
      expiresAt,

      isActive: true,

      completions: [],

      createdBy:
        createdBy && mongoose.Types.ObjectId.isValid(createdBy)
          ? createdBy
          : null,
    });

    return populateChallenge(challenge);
  } catch (error) {
    if (error?.code === 11000) {
      const challenge = await findChallengeByDate(date);

      if (challenge) {
        return challenge;
      }
    }

    throw error;
  }
}

async function getOrCreateDailyChallenge({
  date = new Date(),
  questionCount = DEFAULT_QUESTION_COUNT,
  createdBy = null,
} = {}) {
  const existingChallenge = await findChallengeByDate(date);

  if (existingChallenge) {
    return existingChallenge;
  }

  return createDailyChallenge({
    date,
    questionCount,
    createdBy,
  });
}

async function getDailyChallengeForUser({ userId, date = new Date() } = {}) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("A valid user ID is required to load the daily challenge.");
  }

  const challenge = await getOrCreateDailyChallenge({
    date,
  });

  return serializeDailyChallenge(challenge, userId);
}

async function getDailyChallengeDocument({
  challengeId = null,
  date = new Date(),
  populateQuestions = true,
} = {}) {
  let query;

  if (challengeId) {
    if (!mongoose.Types.ObjectId.isValid(challengeId)) {
      return null;
    }

    query = DailyChallenge.findById(challengeId);
  } else {
    query = DailyChallenge.findOne({
      dateKey: getDateKey(date),
      isActive: true,
    });
  }

  if (populateQuestions) {
    query = query.populate({
      path: "questions",

      select: [
        "question",
        "options",
        "category",
        "difficulty",
        "explanation",
      ].join(" "),
    });
  }

  return query;
}

async function completeDailyChallenge({
  challengeId,
  userId,
  resultId = null,
  score = 0,
  totalQuestions = 0,
  accuracy = 0,
  xpAwarded = 0,
  session = null,
}) {
  if (!mongoose.Types.ObjectId.isValid(challengeId)) {
    throw new Error("A valid daily challenge ID is required.");
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("A valid user ID is required.");
  }

  if (resultId && !mongoose.Types.ObjectId.isValid(resultId)) {
    throw new Error("The quiz result ID is invalid.");
  }

  const challengeQuery = DailyChallenge.findOne({
    _id: challengeId,
    isActive: true,
  });
  if (session) challengeQuery.session(session);
  const challenge = await challengeQuery;

  if (!challenge) {
    return {
      success: false,
      reason: "not_found",
      challenge: null,
      alreadyCompleted: false,
    };
  }

  if (!challenge.isCurrentlyAvailable()) {
    return {
      success: false,
      reason: "expired",
      challenge,
      alreadyCompleted: challenge.hasUserCompleted(userId),
    };
  }

  const existingCompletion = challenge.getUserCompletion(userId);

  if (existingCompletion) {
    return {
      success: true,
      reason: "already_completed",
      challenge,
      completion: existingCompletion,
      alreadyCompleted: true,
      xpAwarded: 0,
    };
  }

  const completion = {
    user: userId,

    score: Math.max(0, normalizeNumber(score)),

    totalQuestions: Math.max(0, normalizeNumber(totalQuestions)),

    accuracy: Math.min(100, Math.max(0, normalizeNumber(accuracy))),

    xpAwarded: Math.max(0, normalizeNumber(xpAwarded)),

    result: resultId || null,

    completedAt: new Date(),
  };

  const updatedChallenge = await DailyChallenge.findOneAndUpdate(
    {
      _id: challengeId,
      isActive: true,

      expiresAt: {
        $gt: new Date(),
      },

      "completions.user": {
        $ne: userId,
      },
    },

    {
      $push: {
        completions: completion,
      },
    },

    {
      new: true,
      runValidators: true,
      session,
    },
  );

  if (!updatedChallenge) {
    const latestQuery = DailyChallenge.findById(challengeId);
    if (session) latestQuery.session(session);
    const latestChallenge = await latestQuery;

    const latestCompletion = latestChallenge?.getUserCompletion(userId);

    if (latestCompletion) {
      return {
        success: true,
        reason: "already_completed",
        challenge: latestChallenge,
        completion: latestCompletion,
        alreadyCompleted: true,
        xpAwarded: 0,
      };
    }

    return {
      success: false,
      reason: "completion_failed",
      challenge: latestChallenge,
      alreadyCompleted: false,
    };
  }

  const savedCompletion = updatedChallenge.getUserCompletion(userId);

  return {
    success: true,
    reason: "completed",
    challenge: updatedChallenge,
    completion: savedCompletion,
    alreadyCompleted: false,
    xpAwarded: normalizeNumber(savedCompletion?.xpAwarded),
  };
}

async function deactivateExpiredChallenges() {
  const result = await DailyChallenge.updateMany(
    {
      isActive: true,

      expiresAt: {
        $lte: new Date(),
      },
    },

    {
      $set: {
        isActive: false,
      },
    },
  );

  return {
    matchedCount: result.matchedCount || 0,

    modifiedCount: result.modifiedCount || 0,
  };
}

module.exports = {
  DEFAULT_QUESTION_COUNT,
  DEFAULT_REWARD_XP,

  getDateKey,
  getUtcDayRange,
  getMillisecondsRemaining,

  serializeDailyChallenge,

  getAvailableChallengeGroups,
  findChallengeByDate,
  createDailyChallenge,
  getOrCreateDailyChallenge,
  getDailyChallengeForUser,
  getDailyChallengeDocument,
  completeDailyChallenge,
  deactivateExpiredChallenges,
};
