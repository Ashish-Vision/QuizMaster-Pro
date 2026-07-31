"use strict";

const User = require("../models/User");

async function getLeaderboard(req, res, next) {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1 &&
      requestedLimit <= 100
        ? requestedLimit
        : 20;

    const users = await User.find({})
      .select(
        "firstName lastName totalXp quizzesCompleted correctAnswers currentStreak",
      )
      .sort({
        totalXp: -1,
        correctAnswers: -1,
        quizzesCompleted: 1,
        createdAt: 1,
      })
      .limit(limit)
      .lean();

    const leaderboard = users.map((user, index) => {
      const quizzesCompleted = user.quizzesCompleted || 0;

      const correctAnswers = user.correctAnswers || 0;

      const averageCorrect =
        quizzesCompleted > 0
          ? Number((correctAnswers / quizzesCompleted).toFixed(1))
          : 0;

      return {
        rank: index + 1,
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName || "",
        totalXp: user.totalXp || 0,
        quizzesCompleted,
        correctAnswers,
        currentStreak: user.currentStreak || 0,
        averageCorrect,
        isCurrentUser: String(user._id) === String(req.user._id),
      };
    });

    const currentUserEntry =
      leaderboard.find((entry) => entry.isCurrentUser) || null;

    return res.status(200).json({
      success: true,
      totalPlayers: leaderboard.length,
      currentUser: currentUserEntry,
      leaderboard,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getLeaderboard,
};
