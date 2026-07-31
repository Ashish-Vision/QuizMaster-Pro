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
    },

    correctAnswer: {
      type: Number,
      required: true,
    },

    isCorrect: {
      type: Boolean,
      required: true,
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

    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
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

    score: {
      type: Number,
      required: true,
      min: 0,
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
      default: 0,
    },

    timeTakenSeconds: {
      type: Number,
      min: 0,
      default: 0,
    },

    answers: {
      type: [answerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

scoreSchema.index({
  user: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Score", scoreSchema);
