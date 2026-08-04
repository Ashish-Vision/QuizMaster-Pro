"use strict";

const Achievement = require("../models/Achievement");
const User = require("../models/User");

const { getAchievementDefinitions } = require("../services/achievementService");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function roundNumber(value, decimalPlaces = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(decimalPlaces));
}

function createSafeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id),

    firstName: user.firstName || "",

    lastName: user.lastName || "",

    fullName:
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User",

    email: user.email || "",

    avatar: user.avatar || "",
  };
}

/**
 * GET /api/admin/achievements
 *
 * Returns achievement definition analytics and recent unlocks.
 */
async function getAdminAchievements(req, res, next) {
  try {
    const search = normalizeText(req.query.search).toLowerCase();

    const category = normalizeText(req.query.category).toLowerCase() || "all";

    const sort = normalizeText(req.query.sort).toLowerCase() || "most-unlocked";

    const allowedCategories = new Set([
      "all",
      "quiz",
      "xp",
      "accuracy",
      "streak",
      "category",
    ]);

    const allowedSorts = new Set([
      "most-unlocked",
      "least-unlocked",
      "title-asc",
      "title-desc",
      "category",
    ]);

    if (!allowedCategories.has(category)) {
      return res.status(400).json({
        success: false,
        message: "Achievement category filter is invalid.",
      });
    }

    if (!allowedSorts.has(sort)) {
      return res.status(400).json({
        success: false,
        message: "Achievement sort option is invalid.",
      });
    }

    const definitions = getAchievementDefinitions();

    const [
      totalUsers,
      totalUnlocks,
      unlockStatistics,
      usersWithAchievementsResult,
      recentUnlocks,
      categoryUnlockStatistics,
    ] = await Promise.all([
      User.countDocuments(),

      Achievement.countDocuments(),

      Achievement.aggregate([
        {
          $group: {
            _id: "$code",

            unlockCount: {
              $sum: 1,
            },

            latestUnlockAt: {
              $max: "$unlockedAt",
            },

            firstUnlockAt: {
              $min: "$unlockedAt",
            },
          },
        },
      ]),

      Achievement.aggregate([
        {
          $group: {
            _id: "$user",
          },
        },

        {
          $count: "count",
        },
      ]),

      Achievement.find()
        .populate({
          path: "user",
          select: "firstName lastName email avatar",
        })
        .select(
          "user code title description icon category threshold unlockedAt createdAt",
        )
        .sort({
          unlockedAt: -1,
          createdAt: -1,
          _id: -1,
        })
        .limit(12)
        .lean(),

      Achievement.aggregate([
        {
          $group: {
            _id: "$category",

            unlockCount: {
              $sum: 1,
            },

            uniqueUsers: {
              $addToSet: "$user",
            },
          },
        },
      ]),
    ]);

    const unlockMap = new Map(
      unlockStatistics.map((item) => [
        String(item._id),
        {
          unlockCount: Number(item.unlockCount) || 0,
          latestUnlockAt: item.latestUnlockAt || null,
          firstUnlockAt: item.firstUnlockAt || null,
        },
      ]),
    );

    let achievements = definitions.map((definition) => {
      const unlockData = unlockMap.get(definition.code) || {};

      const unlockCount = Number(unlockData.unlockCount) || 0;

      return {
        code: definition.code,
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        category: definition.category,
        threshold: Number(definition.threshold) || 0,

        unlockCount,

        unlockPercentage:
          totalUsers > 0 ? roundNumber((unlockCount / totalUsers) * 100) : 0,

        firstUnlockAt: unlockData.firstUnlockAt || null,

        latestUnlockAt: unlockData.latestUnlockAt || null,
      };
    });

    if (search) {
      achievements = achievements.filter((achievement) => {
        const searchableText = [
          achievement.code,
          achievement.title,
          achievement.description,
          achievement.category,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(search);
      });
    }

    if (category !== "all") {
      achievements = achievements.filter(
        (achievement) => achievement.category === category,
      );
    }

    const sortFunctions = {
      "most-unlocked": (first, second) =>
        second.unlockCount - first.unlockCount ||
        first.title.localeCompare(second.title),

      "least-unlocked": (first, second) =>
        first.unlockCount - second.unlockCount ||
        first.title.localeCompare(second.title),

      "title-asc": (first, second) => first.title.localeCompare(second.title),

      "title-desc": (first, second) => second.title.localeCompare(first.title),

      category: (first, second) =>
        first.category.localeCompare(second.category) ||
        first.title.localeCompare(second.title),
    };

    achievements.sort(sortFunctions[sort]);

    const allAchievements = definitions.map((definition) => {
      const unlockData = unlockMap.get(definition.code) || {};

      return {
        ...definition,
        unlockCount: Number(unlockData.unlockCount) || 0,
      };
    });

    const sortedByUnlockCount = [...allAchievements].sort(
      (first, second) =>
        second.unlockCount - first.unlockCount ||
        first.title.localeCompare(second.title),
    );

    const mostUnlockedAchievement =
      sortedByUnlockCount.length > 0 && sortedByUnlockCount[0].unlockCount > 0
        ? sortedByUnlockCount[0]
        : null;

    const leastUnlockedAchievement =
      sortedByUnlockCount.length > 0
        ? sortedByUnlockCount[sortedByUnlockCount.length - 1]
        : null;

    const categoryDefinitionCounts = definitions.reduce((map, definition) => {
      map.set(definition.category, (map.get(definition.category) || 0) + 1);

      return map;
    }, new Map());

    const categoryUnlockMap = new Map(
      categoryUnlockStatistics.map((item) => [
        String(item._id),
        {
          unlockCount: Number(item.unlockCount) || 0,
          uniqueUsers: Array.isArray(item.uniqueUsers)
            ? item.uniqueUsers.length
            : 0,
        },
      ]),
    );

    const categoryStatistics = [
      "quiz",
      "xp",
      "accuracy",
      "streak",
      "category",
    ].map((categoryName) => {
      const unlockData = categoryUnlockMap.get(categoryName) || {};

      return {
        category: categoryName,

        definitionCount:
          Number(categoryDefinitionCounts.get(categoryName)) || 0,

        unlockCount: Number(unlockData.unlockCount) || 0,

        uniqueUsers: Number(unlockData.uniqueUsers) || 0,
      };
    });

    const usersWithAchievements =
      Number(usersWithAchievementsResult[0]?.count) || 0;

    return res.status(200).json({
      success: true,

      generatedAt: new Date().toISOString(),

      summary: {
        totalDefinitions: definitions.length,

        totalUnlocks,

        totalUsers,

        usersWithAchievements,

        usersWithoutAchievements: Math.max(
          totalUsers - usersWithAchievements,
          0,
        ),

        overallUnlockPercentage:
          totalUsers > 0 && definitions.length > 0
            ? roundNumber(
                (totalUnlocks / (totalUsers * definitions.length)) * 100,
              )
            : 0,

        mostUnlockedAchievement: mostUnlockedAchievement
          ? {
              code: mostUnlockedAchievement.code,
              title: mostUnlockedAchievement.title,
              icon: mostUnlockedAchievement.icon,
              unlockCount: mostUnlockedAchievement.unlockCount,
            }
          : null,

        leastUnlockedAchievement: leastUnlockedAchievement
          ? {
              code: leastUnlockedAchievement.code,
              title: leastUnlockedAchievement.title,
              icon: leastUnlockedAchievement.icon,
              unlockCount: leastUnlockedAchievement.unlockCount,
            }
          : null,
      },

      filters: {
        search,
        category,
        sort,
      },

      categoryStatistics,

      achievements,

      recentUnlocks: recentUnlocks.map((achievement) => ({
        id: String(achievement._id),

        code: achievement.code || "",

        title: achievement.title || "",

        description: achievement.description || "",

        icon: achievement.icon || "🏆",

        category: achievement.category || "",

        threshold: Number(achievement.threshold) || 0,

        unlockedAt: achievement.unlockedAt || achievement.createdAt || null,

        user: createSafeUser(achievement.user),
      })),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/admin/achievements/:code
 *
 * Returns one achievement definition and users who unlocked it.
 */
async function getAdminAchievementByCode(req, res, next) {
  try {
    const code = normalizeText(req.params.code).toUpperCase();

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Achievement code is required.",
      });
    }

    const definitions = getAchievementDefinitions();

    const definition = definitions.find(
      (achievement) => achievement.code === code,
    );

    if (!definition) {
      return res.status(404).json({
        success: false,
        message: "Achievement definition was not found.",
      });
    }

    const [totalUsers, unlockRecords] = await Promise.all([
      User.countDocuments(),

      Achievement.find({
        code,
      })
        .populate({
          path: "user",
          select: "firstName lastName email avatar",
        })
        .select("user unlockedAt createdAt")
        .sort({
          unlockedAt: -1,
          createdAt: -1,
        })
        .lean(),
    ]);

    const unlockedUsers = unlockRecords
      .filter((record) => record.user)
      .map((record) => ({
        user: createSafeUser(record.user),

        unlockedAt: record.unlockedAt || record.createdAt || null,
      }));

    return res.status(200).json({
      success: true,

      achievement: {
        ...definition,

        unlockCount: unlockedUsers.length,

        unlockPercentage:
          totalUsers > 0
            ? roundNumber((unlockedUsers.length / totalUsers) * 100)
            : 0,
      },

      unlockedUsers,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAdminAchievements,
  getAdminAchievementByCode,
};
