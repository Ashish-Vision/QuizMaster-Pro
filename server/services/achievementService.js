"use strict";

const mongoose = require("mongoose");

const Achievement = require("../models/Achievement");
const Score = require("../models/Score");
const User = require("../models/User");

const ACHIEVEMENT_DEFINITIONS = [
  {
    code: "FIRST_QUIZ",
    title: "First Step",
    description: "Complete your first quiz.",
    icon: "🎓",
    category: "quiz",
    threshold: 1,
  },
  {
    code: "QUIZ_EXPLORER",
    title: "Quiz Explorer",
    description: "Complete 10 quizzes.",
    icon: "🧭",
    category: "quiz",
    threshold: 10,
  },
  {
    code: "QUIZ_MASTER",
    title: "Quiz Master",
    description: "Complete 50 quizzes.",
    icon: "👑",
    category: "quiz",
    threshold: 50,
  },
  {
    code: "XP_BEGINNER",
    title: "XP Beginner",
    description: "Earn a total of 100 XP.",
    icon: "⚡",
    category: "xp",
    threshold: 100,
  },
  {
    code: "XP_CHAMPION",
    title: "XP Champion",
    description: "Earn a total of 1,000 XP.",
    icon: "🏆",
    category: "xp",
    threshold: 1000,
  },
  {
    code: "XP_LEGEND",
    title: "XP Legend",
    description: "Earn a total of 5,000 XP.",
    icon: "💎",
    category: "xp",
    threshold: 5000,
  },
  {
    code: "PERFECT_SCORE",
    title: "Perfect Score",
    description: "Complete a quiz with 100% accuracy.",
    icon: "💯",
    category: "accuracy",
    threshold: 100,
  },
  {
    code: "ACCURACY_EXPERT",
    title: "Accuracy Expert",
    description: "Complete 5 quizzes with at least 90% accuracy.",
    icon: "🎯",
    category: "accuracy",
    threshold: 5,
  },
  {
    code: "STREAK_STARTER",
    title: "Streak Starter",
    description: "Reach a 3-day quiz streak.",
    icon: "🔥",
    category: "streak",
    threshold: 3,
  },
  {
    code: "STREAK_MASTER",
    title: "Streak Master",
    description: "Reach a 7-day quiz streak.",
    icon: "🚀",
    category: "streak",
    threshold: 7,
  },
  {
    code: "CATEGORY_SPECIALIST",
    title: "Category Specialist",
    description: "Complete 10 quizzes in one category.",
    icon: "📚",
    category: "category",
    threshold: 10,
  },
];

async function getUserAchievementStatistics(userId) {
  const objectId = new mongoose.Types.ObjectId(String(userId));

  const user = await User.findById(objectId)
    .select("totalXp quizzesCompleted correctAnswers currentStreak")
    .lean();

  if (!user) {
    throw new Error("User not found while checking achievements.");
  }

  const scoreStatistics = await Score.aggregate([
    {
      $match: {
        user: objectId,
      },
    },
    {
      $group: {
        _id: null,

        perfectScoreCount: {
          $sum: {
            $cond: [
              {
                $eq: ["$accuracy", 100],
              },
              1,
              0,
            ],
          },
        },

        highAccuracyQuizCount: {
          $sum: {
            $cond: [
              {
                $gte: ["$accuracy", 90],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const categoryStatistics = await Score.aggregate([
    {
      $match: {
        user: objectId,
      },
    },
    {
      $group: {
        _id: "$category",
        attempts: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        attempts: -1,
      },
    },
    {
      $limit: 1,
    },
  ]);

  const scoreSummary = scoreStatistics[0] || {};
  const bestCategory = categoryStatistics[0] || null;

  return {
    totalXp: user.totalXp || 0,
    quizzesCompleted: user.quizzesCompleted || 0,
    correctAnswers: user.correctAnswers || 0,
    currentStreak: user.currentStreak || 0,
    perfectScoreCount: scoreSummary.perfectScoreCount || 0,
    highAccuracyQuizCount: scoreSummary.highAccuracyQuizCount || 0,
    highestCategoryAttempts: bestCategory?.attempts || 0,
    highestCategoryName: bestCategory?._id || null,
  };
}

function hasMetAchievementRequirement(definition, statistics) {
  switch (definition.code) {
    case "FIRST_QUIZ":
    case "QUIZ_EXPLORER":
    case "QUIZ_MASTER":
      return statistics.quizzesCompleted >= definition.threshold;

    case "XP_BEGINNER":
    case "XP_CHAMPION":
    case "XP_LEGEND":
      return statistics.totalXp >= definition.threshold;

    case "PERFECT_SCORE":
      return statistics.perfectScoreCount >= 1;

    case "ACCURACY_EXPERT":
      return statistics.highAccuracyQuizCount >= definition.threshold;

    case "STREAK_STARTER":
    case "STREAK_MASTER":
      return statistics.currentStreak >= definition.threshold;

    case "CATEGORY_SPECIALIST":
      return statistics.highestCategoryAttempts >= definition.threshold;

    default:
      return false;
  }
}

async function checkAndUnlockAchievements(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID for achievement check.");
  }

  const statistics = await getUserAchievementStatistics(userId);

  const existingAchievements = await Achievement.find({
    user: userId,
  })
    .select("code")
    .lean();

  const existingCodes = new Set(
    existingAchievements.map((achievement) => achievement.code),
  );

  const eligibleAchievements = ACHIEVEMENT_DEFINITIONS.filter(
    (definition) =>
      !existingCodes.has(definition.code) &&
      hasMetAchievementRequirement(definition, statistics),
  );

  const newlyUnlocked = [];

  for (const definition of eligibleAchievements) {
    try {
      const achievement = await Achievement.create({
        user: userId,
        ...definition,
      });

      newlyUnlocked.push(achievement);
    } catch (error) {
      /*
       * Ignore duplicate achievement errors caused by
       * simultaneous requests.
       */
      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  return {
    newlyUnlocked,
    statistics,
  };
}

function getAchievementDefinitions() {
  return ACHIEVEMENT_DEFINITIONS.map((achievement) => ({
    ...achievement,
  }));
}

module.exports = {
  checkAndUnlockAchievements,
  getAchievementDefinitions,
  getUserAchievementStatistics,
};
