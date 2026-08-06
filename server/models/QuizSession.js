"use strict";

const crypto = require("crypto");
const mongoose = require("mongoose");

const QUIZ_SESSION_IDENTIFIER_BYTES = 32;
const QUIZ_SESSION_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function createQuizSessionIdentifier() {
  return crypto
    .randomBytes(QUIZ_SESSION_IDENTIFIER_BYTES)
    .toString("base64url");
}

const quizSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: createQuizSessionIdentifier,
      match: [
        QUIZ_SESSION_IDENTIFIER_PATTERN,
        "Quiz session identifier is invalid.",
      ],
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },

    questions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: true,
        },
      ],
      required: true,
      immutable: true,
      validate: [
        {
          validator(questions) {
            return Array.isArray(questions) && questions.length >= 1;
          },
          message: "A quiz session must contain at least one question.",
        },
        {
          validator(questions) {
            return Array.isArray(questions) && questions.length <= 25;
          },
          message: "A quiz session cannot contain more than 25 questions.",
        },
        {
          validator(questions) {
            if (!Array.isArray(questions)) {
              return false;
            }

            return new Set(questions.map(String)).size === questions.length;
          },
          message: "A quiz session cannot contain duplicate questions.",
        },
      ],
    },

    mode: {
      type: String,
      enum: ["standard", "daily"],
      required: true,
      immutable: true,
      index: true,
    },

    dailyChallenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyChallenge",
      default: null,
      immutable: true,
      required() {
        return this.mode === "daily";
      },
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: ["active", "processing", "completed", "expired", "cancelled"],
      required: true,
      default: "active",
    },

    completedAt: {
      type: Date,
      default: null,
    },

    result: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Score",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

quizSessionSchema.path("expiresAt").validate(function validateExpiration(
  expiresAt,
) {
  return Boolean(this.startedAt && expiresAt && expiresAt > this.startedAt);
}, "Quiz session expiration must be after its start time.");

quizSessionSchema
  .path("dailyChallenge")
  .validate(function validateDailyChallenge(dailyChallenge) {
    return this.mode === "daily" || !dailyChallenge;
  }, "Only daily quiz sessions may reference a daily challenge.");

quizSessionSchema.index({
  user: 1,
  status: 1,
  expiresAt: 1,
});

quizSessionSchema.index({
  user: 1,
  startedAt: -1,
});

quizSessionSchema.index(
  {
    result: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      result: {
        $type: "objectId",
      },
    },
  },
);

quizSessionSchema.index(
  {
    user: 1,
    dailyChallenge: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      mode: "daily",
    },
  },
);

quizSessionSchema.index({
  expiresAt: 1,
});

const QuizSession = mongoose.model("QuizSession", quizSessionSchema);

module.exports = QuizSession;
module.exports.createQuizSessionIdentifier = createQuizSessionIdentifier;
