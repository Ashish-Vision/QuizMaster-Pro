"use strict";

const LEVELS = [
  {
    level: 1,
    minimumXp: 0,
    title: "Beginner",
  },
  {
    level: 2,
    minimumXp: 100,
    title: "Learner",
  },
  {
    level: 3,
    minimumXp: 250,
    title: "Skilled Learner",
  },
  {
    level: 4,
    minimumXp: 450,
    title: "Quiz Expert",
  },
  {
    level: 5,
    minimumXp: 700,
    title: "Quiz Master",
  },
  {
    level: 6,
    minimumXp: 1000,
    title: "Knowledge Champion",
  },
  {
    level: 7,
    minimumXp: 1400,
    title: "Elite Scholar",
  },
  {
    level: 8,
    minimumXp: 1900,
    title: "Grand Master",
  },
  {
    level: 9,
    minimumXp: 2500,
    title: "Legend",
  },
  {
    level: 10,
    minimumXp: 3200,
    title: "QuizMaster Pro",
  },
];

function normalizeXp(value) {
  const parsedXp = Number(value);

  if (!Number.isFinite(parsedXp)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsedXp));
}

function getLevelDefinition(totalXp) {
  const safeXp = normalizeXp(totalXp);

  let currentLevel = LEVELS[0];

  for (const levelDefinition of LEVELS) {
    if (safeXp >= levelDefinition.minimumXp) {
      currentLevel = levelDefinition;
    } else {
      break;
    }
  }

  return currentLevel;
}

function getNextLevelDefinition(currentLevel) {
  return (
    LEVELS.find(
      (levelDefinition) => levelDefinition.level === currentLevel.level + 1,
    ) || null
  );
}

function getLevelInformation(totalXp) {
  const safeXp = normalizeXp(totalXp);

  const currentLevel = getLevelDefinition(safeXp);

  const nextLevel = getNextLevelDefinition(currentLevel);

  const currentLevelMinimumXp = currentLevel.minimumXp;

  if (!nextLevel) {
    return {
      level: currentLevel.level,
      rankTitle: currentLevel.title,
      totalXp: safeXp,
      currentLevelMinimumXp,
      nextLevelMinimumXp: null,
      xpEarnedInCurrentLevel: safeXp - currentLevelMinimumXp,
      xpRequiredForNextLevel: 0,
      xpRemainingForNextLevel: 0,
      progressPercentage: 100,
      isMaximumLevel: true,
    };
  }

  const xpRange = nextLevel.minimumXp - currentLevelMinimumXp;

  const xpEarnedInCurrentLevel = safeXp - currentLevelMinimumXp;

  const xpRemainingForNextLevel = Math.max(nextLevel.minimumXp - safeXp, 0);

  const progressPercentage =
    xpRange > 0
      ? Math.min(
          100,
          Number(((xpEarnedInCurrentLevel / xpRange) * 100).toFixed(2)),
        )
      : 100;

  return {
    level: currentLevel.level,
    rankTitle: currentLevel.title,
    totalXp: safeXp,
    currentLevelMinimumXp,
    nextLevelMinimumXp: nextLevel.minimumXp,
    nextLevelTitle: nextLevel.title,
    xpEarnedInCurrentLevel,
    xpRequiredForNextLevel: xpRange,
    xpRemainingForNextLevel,
    progressPercentage,
    isMaximumLevel: false,
  };
}

function didLevelIncrease(previousTotalXp, newTotalXp) {
  const previousLevel = getLevelInformation(previousTotalXp);

  const currentLevel = getLevelInformation(newTotalXp);

  return {
    leveledUp: currentLevel.level > previousLevel.level,

    previousLevel: previousLevel.level,

    currentLevel: currentLevel.level,

    previousRankTitle: previousLevel.rankTitle,

    currentRankTitle: currentLevel.rankTitle,
  };
}

module.exports = {
  LEVELS,
  getLevelInformation,
  didLevelIncrease,
};
