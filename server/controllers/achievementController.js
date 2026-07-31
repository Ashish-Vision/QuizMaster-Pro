"use strict";

const Achievement = require("../models/Achievement");

const {
  checkAndUnlockAchievements,
  getAchievementDefinitions,
  getUserAchievementStatistics,
} = require("../services/achievementService");

async function getAchievements(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;

    /*
     * This also unlocks achievements earned before
     * the achievement system was introduced.
     */
    const { newlyUnlocked } = await checkAndUnlockAchievements(userId);

    const unlockedAchievements = await Achievement.find({
      user: userId,
    })
      .sort({
        unlockedAt: -1,
      })
      .lean();

    const definitions = getAchievementDefinitions();

    const unlockedCodes = new Set(
      unlockedAchievements.map((achievement) => achievement.code),
    );

    const statistics = await getUserAchievementStatistics(userId);

    const achievements = definitions.map((definition) => {
      const unlockedAchievement = unlockedAchievements.find(
        (achievement) => achievement.code === definition.code,
      );

      return {
        ...definition,
        isUnlocked: unlockedCodes.has(definition.code),
        unlockedAt: unlockedAchievement?.unlockedAt || null,
      };
    });

    return res.status(200).json({
      success: true,
      totalAchievements: achievements.length,
      unlockedCount: unlockedAchievements.length,
      lockedCount: achievements.length - unlockedAchievements.length,
      newlyUnlocked,
      statistics,
      achievements,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAchievements,
};
