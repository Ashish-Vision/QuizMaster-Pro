"use strict";

const mongoose = require("mongoose");

const User = require("../models/User");

async function getLeaderboard(req, res, next) {
  try {
    const currentUserId = req.user?._id || req.user?.id;

    const users = await User.find({
      isActive: true,
      role: "user",
    })
      .select(
        "firstName lastName avatar totalXp quizzesCompleted correctAnswers currentStreak",
      )
      .sort({
        totalXp: -1,
        quizzesCompleted: -1,
        correctAnswers: -1,
        createdAt: 1,
      })
      .lean();

    const rankedUsers = users.map((user, index) => ({
      rank: index + 1,
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar || "",
      totalXp: user.totalXp || 0,
      quizzesCompleted: user.quizzesCompleted || 0,
      correctAnswers: user.correctAnswers || 0,
      currentStreak: user.currentStreak || 0,
      isCurrentUser:
        currentUserId &&
        mongoose.Types.ObjectId.isValid(currentUserId) &&
        String(user._id) === String(currentUserId),
    }));

    const topUsers = rankedUsers.slice(0, 10);

    const currentUser = rankedUsers.find((user) => user.isCurrentUser === true);

    return res.status(200).json({
      success: true,
      totalPlayers: rankedUsers.length,
      leaderboard: topUsers,
      currentUser: currentUser || null,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getLeaderboard,
};
