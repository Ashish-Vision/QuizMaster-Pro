"use strict";

const mongoose = require("mongoose");

const dailyChallengeCompletionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    xpAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },

    result: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Score",
      default: null,
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const dailyChallengeSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        "Daily challenge date must use YYYY-MM-DD format.",
      ],
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      default: "Daily Challenge",
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      default: "Complete today's special quiz to earn bonus XP.",
    },

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Mixed"],
      required: true,
      default: "Mixed",
      index: true,
    },

    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
        required: true,
      },
    ],

    questionCount: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
      max: 25,
    },

    rewardXp: {
      type: Number,
      required: true,
      default: 100,
      min: 0,
      max: 10000,
    },

    rewardBadge: {
      code: {
        type: String,
        trim: true,
        uppercase: true,
        default: "DAILY_CHALLENGER",
      },

      title: {
        type: String,
        trim: true,
        default: "Daily Challenger",
      },

      icon: {
        type: String,
        trim: true,
        default: "🔥",
      },
    },

    startsAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    completions: {
      type: [dailyChallengeCompletionSchema],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

dailyChallengeSchema.index({
  dateKey: 1,
  isActive: 1,
});

dailyChallengeSchema.index({
  "completions.user": 1,
  dateKey: 1,
});

dailyChallengeSchema.path("questions").validate(function validateQuestions(
  questions,
) {
  return Array.isArray(questions) && questions.length === this.questionCount;
}, "The number of challenge questions must match questionCount.");

dailyChallengeSchema.path("expiresAt").validate(function validateExpiration(
  expiresAt,
) {
  return Boolean(this.startsAt && expiresAt && expiresAt > this.startsAt);
}, "Daily challenge expiration must be after its start time.");

dailyChallengeSchema.methods.hasUserCompleted = function hasUserCompleted(
  userId,
) {
  if (!userId) {
    return false;
  }

  return this.completions.some(
    (completion) => String(completion.user) === String(userId),
  );
};

dailyChallengeSchema.methods.getUserCompletion = function getUserCompletion(
  userId,
) {
  if (!userId) {
    return null;
  }

  return (
    this.completions.find(
      (completion) => String(completion.user) === String(userId),
    ) || null
  );
};

dailyChallengeSchema.methods.isCurrentlyAvailable =
  function isCurrentlyAvailable() {
    const now = new Date();

    return Boolean(
      this.isActive && this.startsAt <= now && this.expiresAt > now,
    );
  };

dailyChallengeSchema.statics.getDateKey = function getDateKey(
  date = new Date(),
) {
  const safeDate = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(safeDate.getTime())) {
    throw new Error("A valid date is required to create a challenge date key.");
  }

  return safeDate.toISOString().slice(0, 10);
};

dailyChallengeSchema.statics.getUtcDayRange = function getUtcDayRange(
  date = new Date(),
) {
  const safeDate = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(safeDate.getTime())) {
    throw new Error("A valid date is required to create a UTC day range.");
  }

  const startsAt = new Date(
    Date.UTC(
      safeDate.getUTCFullYear(),
      safeDate.getUTCMonth(),
      safeDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const expiresAt = new Date(
    Date.UTC(
      safeDate.getUTCFullYear(),
      safeDate.getUTCMonth(),
      safeDate.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );

  return {
    startsAt,
    expiresAt,
  };
};

const DailyChallenge = mongoose.model("DailyChallenge", dailyChallengeSchema);

module.exports = DailyChallenge;
