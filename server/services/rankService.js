"use strict";

const User = require("../models/User");

function normalizeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

async function getUserRankInformation(user) {
  if (!user?._id) {
    return {
      rank: null,
      totalPlayers: 0,
      topPercentage: 0,
    };
  }

  const totalXp = normalizeNumber(user.totalXp);

  const [playersAhead, totalPlayers] = await Promise.all([
    User.countDocuments({
      isActive: true,

      $or: [
        {
          totalXp: {
            $gt: totalXp,
          },
        },

        {
          totalXp,
          createdAt: {
            $lt: user.createdAt,
          },
        },
      ],
    }),

    User.countDocuments({
      isActive: true,
    }),
  ]);

  const rank = playersAhead + 1;

  const topPercentage =
    totalPlayers > 0
      ? Math.max(1, Math.min(100, Math.ceil((rank / totalPlayers) * 100)))
      : 0;

  return {
    rank,
    totalPlayers,
    topPercentage,
  };
}

function calculateProfileCompletion(profile) {
  const checks = [
    Boolean(profile?.firstName),
    Boolean(profile?.lastName),
    Boolean(profile?.email),
    Boolean(profile?.emailVerified),
    Boolean(profile?.avatar),
    normalizeNumber(profile?.quizzesCompleted) > 0,
    normalizeNumber(profile?.achievementCount) > 0,
    normalizeNumber(profile?.totalXp) > 0,
  ];

  const completedItems = checks.filter(Boolean).length;

  const completionPercentage = Math.round(
    (completedItems / checks.length) * 100,
  );

  const missingItems = [];

  if (!profile?.avatar) {
    missingItems.push("Add a profile picture");
  }

  if (!profile?.emailVerified) {
    missingItems.push("Verify your email address");
  }

  if (normalizeNumber(profile?.quizzesCompleted) === 0) {
    missingItems.push("Complete your first quiz");
  }

  if (normalizeNumber(profile?.achievementCount) === 0) {
    missingItems.push("Unlock your first achievement");
  }

  return {
    completionPercentage,
    completedItems,
    totalItems: checks.length,
    missingItems,
    isComplete: completionPercentage === 100,
  };
}

module.exports = {
  getUserRankInformation,
  calculateProfileCompletion,
};
