"use strict";

const mongoose = require("mongoose");

const Score = require("../models/Score");
const User = require("../models/User");

async function getAnalytics(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to view analytics.",
      });
    }

    const objectId = new mongoose.Types.ObjectId(String(userId));

    const user = await User.findById(objectId)
      .select("totalXp quizzesCompleted correctAnswers currentStreak")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const [summaryResult] = await Score.aggregate([
      {
        $match: {
          user: objectId,
        },
      },
      {
        $group: {
          _id: null,

          totalQuizzes: {
            $sum: 1,
          },

          totalQuestions: {
            $sum: "$totalQuestions",
          },

          totalAttemptedQuestions: {
            $sum: "$attemptedQuestions",
          },

          totalCorrectAnswers: {
            $sum: "$correctAnswers",
          },

          totalWrongAnswers: {
            $sum: "$wrongAnswers",
          },

          totalUnansweredQuestions: {
            $sum: "$unansweredQuestions",
          },

          totalXpEarned: {
            $sum: "$xpEarned",
          },

          averageAccuracy: {
            $avg: "$accuracy",
          },

          bestAccuracy: {
            $max: "$accuracy",
          },

          lowestAccuracy: {
            $min: "$accuracy",
          },

          averageTimeTakenSeconds: {
            $avg: "$timeTakenSeconds",
          },

          fastestQuizSeconds: {
            $min: "$timeTakenSeconds",
          },

          longestQuizSeconds: {
            $max: "$timeTakenSeconds",
          },
        },
      },
    ]);

    const categoryPerformance = await Score.aggregate([
      {
        $match: {
          user: objectId,
        },
      },
      {
        $group: {
          _id: "$category",

          quizzesCompleted: {
            $sum: 1,
          },

          totalQuestions: {
            $sum: "$totalQuestions",
          },

          correctAnswers: {
            $sum: "$correctAnswers",
          },

          wrongAnswers: {
            $sum: "$wrongAnswers",
          },

          unansweredQuestions: {
            $sum: "$unansweredQuestions",
          },

          xpEarned: {
            $sum: "$xpEarned",
          },

          averageAccuracy: {
            $avg: "$accuracy",
          },

          bestAccuracy: {
            $max: "$accuracy",
          },

          averageTimeTakenSeconds: {
            $avg: "$timeTakenSeconds",
          },
        },
      },
      {
        $sort: {
          averageAccuracy: -1,
          quizzesCompleted: -1,
        },
      },
    ]);

    const recentPerformance = await Score.find({
      user: objectId,
    })
      .select(
        "category score totalQuestions accuracy xpEarned timeTakenSeconds completedAt",
      )
      .sort({
        completedAt: -1,
      })
      .limit(10)
      .lean();

    const monthlyPerformance = await Score.aggregate([
      {
        $match: {
          user: objectId,
        },
      },
      {
        $group: {
          _id: {
            year: {
              $year: "$completedAt",
            },
            month: {
              $month: "$completedAt",
            },
          },

          quizzesCompleted: {
            $sum: 1,
          },

          totalXpEarned: {
            $sum: "$xpEarned",
          },

          averageAccuracy: {
            $avg: "$accuracy",
          },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
      {
        $limit: 12,
      },
    ]);

    const summary = summaryResult || {
      totalQuizzes: 0,
      totalQuestions: 0,
      totalAttemptedQuestions: 0,
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      totalUnansweredQuestions: 0,
      totalXpEarned: 0,
      averageAccuracy: 0,
      bestAccuracy: 0,
      lowestAccuracy: 0,
      averageTimeTakenSeconds: 0,
      fastestQuizSeconds: 0,
      longestQuizSeconds: 0,
    };

    const normalizedCategoryPerformance = categoryPerformance.map(
      (category) => ({
        category: category._id,
        quizzesCompleted: category.quizzesCompleted || 0,
        totalQuestions: category.totalQuestions || 0,
        correctAnswers: category.correctAnswers || 0,
        wrongAnswers: category.wrongAnswers || 0,
        unansweredQuestions: category.unansweredQuestions || 0,
        xpEarned: category.xpEarned || 0,
        averageAccuracy: Number((category.averageAccuracy || 0).toFixed(2)),
        bestAccuracy: Number((category.bestAccuracy || 0).toFixed(2)),
        averageTimeTakenSeconds: Math.round(
          category.averageTimeTakenSeconds || 0,
        ),
      }),
    );

    const strongestCategory = normalizedCategoryPerformance[0] || null;

    const weakestCategory =
      normalizedCategoryPerformance.length > 1
        ? normalizedCategoryPerformance[
            normalizedCategoryPerformance.length - 1
          ]
        : normalizedCategoryPerformance[0] || null;

    return res.status(200).json({
      success: true,

      userStats: {
        totalXp: user.totalXp || 0,
        quizzesCompleted: user.quizzesCompleted || 0,
        correctAnswers: user.correctAnswers || 0,
        currentStreak: user.currentStreak || 0,
      },

      summary: {
        totalQuizzes: summary.totalQuizzes || 0,

        totalQuestions: summary.totalQuestions || 0,

        totalAttemptedQuestions: summary.totalAttemptedQuestions || 0,

        totalCorrectAnswers: summary.totalCorrectAnswers || 0,

        totalWrongAnswers: summary.totalWrongAnswers || 0,

        totalUnansweredQuestions: summary.totalUnansweredQuestions || 0,

        totalXpEarned: summary.totalXpEarned || 0,

        averageAccuracy: Number((summary.averageAccuracy || 0).toFixed(2)),

        bestAccuracy: Number((summary.bestAccuracy || 0).toFixed(2)),

        lowestAccuracy: Number((summary.lowestAccuracy || 0).toFixed(2)),

        averageTimeTakenSeconds: Math.round(
          summary.averageTimeTakenSeconds || 0,
        ),

        fastestQuizSeconds: Math.round(summary.fastestQuizSeconds || 0),

        longestQuizSeconds: Math.round(summary.longestQuizSeconds || 0),
      },

      strongestCategory,
      weakestCategory,
      categoryPerformance: normalizedCategoryPerformance,

      recentPerformance: recentPerformance.reverse(),

      monthlyPerformance: monthlyPerformance.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        quizzesCompleted: item.quizzesCompleted || 0,
        totalXpEarned: item.totalXpEarned || 0,
        averageAccuracy: Number((item.averageAccuracy || 0).toFixed(2)),
      })),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAnalytics,
};
