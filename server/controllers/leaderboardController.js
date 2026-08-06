"use strict";

const mongoose = require("mongoose");

const User = require("../models/User");

async function getLeaderboard(req, res, next) {
  try {
    const currentUserId = req.user?._id || req.user?.id;

    const eligibility = {
      isActive: true,
      role: "user",
    };
    const sort = {
      totalXp: -1,
      quizzesCompleted: -1,
      correctAnswers: -1,
      createdAt: 1,
      _id: 1,
    };

    const [users, totalPlayers, currentUserDocument] = await Promise.all([
      User.find(eligibility)
        .select(
          "firstName lastName avatar totalXp quizzesCompleted correctAnswers currentStreak",
        )
        .sort(sort)
        .limit(10)
        .lean(),
      User.countDocuments(eligibility),
      mongoose.Types.ObjectId.isValid(currentUserId)
        ? User.findOne({ ...eligibility, _id: currentUserId })
            .select(
              "firstName lastName avatar totalXp quizzesCompleted correctAnswers currentStreak createdAt",
            )
            .lean()
        : null,
    ]);

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

    const topUsers = rankedUsers;
    let currentUser =
      topUsers.find((user) => user.isCurrentUser === true) || null;

    if (!currentUser && currentUserDocument) {
      const {
        totalXp = 0,
        quizzesCompleted = 0,
        correctAnswers = 0,
        createdAt,
      } = currentUserDocument;
      const ahead = await User.countDocuments({
        ...eligibility,
        $or: [
          { totalXp: { $gt: totalXp } },
          { totalXp, quizzesCompleted: { $gt: quizzesCompleted } },
          {
            totalXp,
            quizzesCompleted,
            correctAnswers: { $gt: correctAnswers },
          },
          {
            totalXp,
            quizzesCompleted,
            correctAnswers,
            createdAt: { $lt: createdAt },
          },
          {
            totalXp,
            quizzesCompleted,
            correctAnswers,
            createdAt,
            _id: { $lt: currentUserDocument._id },
          },
        ],
      });
      currentUser = {
        rank: ahead + 1,
        userId: currentUserDocument._id,
        firstName: currentUserDocument.firstName,
        lastName: currentUserDocument.lastName,
        fullName: `${currentUserDocument.firstName} ${currentUserDocument.lastName}`,
        avatar: currentUserDocument.avatar || "",
        totalXp,
        quizzesCompleted,
        correctAnswers,
        currentStreak: currentUserDocument.currentStreak || 0,
        isCurrentUser: true,
      };
    }

    return res.status(200).json({
      success: true,
      totalPlayers,
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
