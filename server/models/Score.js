"use strict";

const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },

    selectedAnswer: {
      type: Number,
      default: null,
      min: 0,
    },

    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
    },

    isCorrect: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    _id: false,
  },
);

const scoreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    quizSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizSession",
      default: null,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    answers: {
      type: [answerSchema],
      default: [],
    },

    score: {
      type: Number,
      required: true,
      min: 0,
    },

    attemptedQuestions: {
      type: Number,
      required: true,
      min: 0,
    },

    correctAnswers: {
      type: Number,
      required: true,
      min: 0,
    },

    wrongAnswers: {
      type: Number,
      required: true,
      min: 0,
    },

    unansweredQuestions: {
      type: Number,
      required: true,
      min: 0,
    },

    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },

    accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    xpEarned: {
      type: Number,
      required: true,
      min: 0,
    },

    timeTakenSeconds: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scoreSchema.index({
  user: 1,
  completedAt: -1,
});

scoreSchema.index({
  category: 1,
  score: -1,
});

scoreSchema.index(
  {
    quizSession: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      quizSession: {
        $type: "objectId",
      },
    },
  },
);

const Score = mongoose.model("Score", scoreSchema);

module.exports = Score;
