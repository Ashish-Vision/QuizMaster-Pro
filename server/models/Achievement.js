"use strict";

const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    icon: {
      type: String,
      required: true,
      trim: true,
      default: "🏆",
    },

    category: {
      type: String,
      enum: ["quiz", "xp", "accuracy", "streak", "category"],
      required: true,
    },

    threshold: {
      type: Number,
      required: true,
      min: 0,
    },

    unlockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

achievementSchema.index(
  {
    user: 1,
    code: 1,
  },
  {
    unique: true,
  },
);

const Achievement = mongoose.model("Achievement", achievementSchema);

module.exports = Achievement;
