"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");
const { getLevelInformation } = require("../services/levelService");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required."],
      trim: true,
      minlength: [2, "First name must contain at least 2 characters."],
      maxlength: [50, "First name cannot exceed 50 characters."],
    },

    lastName: {
      type: String,
      required: [true, "Last name is required."],
      trim: true,
      minlength: [2, "Last name must contain at least 2 characters."],
      maxlength: [50, "Last name cannot exceed 50 characters."],
    },

    email: {
      type: String,
      required: [true, "Email address is required."],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: "Enter a valid email address.",
      },
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false,
    },

    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must contain at least 8 characters."],
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    avatar: {
      type: String,
      default: "",
    },

    totalXp: {
      type: Number,
      default: 0,
      min: 0,
    },

    quizzesCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },

    correctAnswers: {
      type: Number,
      default: 0,
      min: 0,
    },

    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastQuizDate: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.virtual("fullName").get(function getFullName() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  const saltRounds = 12;

  this.password = await bcrypt.hash(this.password, saltRounds);
});

userSchema.methods.comparePassword = async function comparePassword(
  candidatePassword,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const levelInformation = getLevelInformation(this.totalXp);

  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: `${this.firstName} ${this.lastName}`,
    email: this.email,
    emailVerified: this.emailVerified,
    emailVerifiedAt: this.emailVerifiedAt,
    role: this.role,
    avatar: this.avatar,
    totalXp: this.totalXp,
    quizzesCompleted: this.quizzesCompleted,
    correctAnswers: this.correctAnswers,
    currentStreak: this.currentStreak,
    lastQuizDate: this.lastQuizDate,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,

    level: levelInformation.level,
    rankTitle: levelInformation.rankTitle,
    levelProgress: levelInformation.progressPercentage,
    xpRemainingForNextLevel: levelInformation.xpRemainingForNextLevel,
    nextLevelTitle: levelInformation.nextLevelTitle || null,
    isMaximumLevel: levelInformation.isMaximumLevel,
  };
};

const User = mongoose.model("User", userSchema);

module.exports = User;
