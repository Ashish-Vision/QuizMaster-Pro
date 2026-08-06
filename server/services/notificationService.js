"use strict";

const Notification = require("../models/Notification");
const { normalizeText } = require("../utils/normalize");

const ALLOWED_TYPES = new Set([
  "quiz",
  "achievement",
  "xp",
  "streak",
  "account",
  "system",
]);

async function createNotification({
  userId,
  type = "system",
  title,
  message,
  icon = "🔔",
  link = "",
  metadata = {},
}) {
  if (!userId) {
    throw new Error("Notification user ID is required.");
  }

  const normalizedTitle = normalizeText(title);
  const normalizedMessage = normalizeText(message);

  if (!normalizedTitle || !normalizedMessage) {
    throw new Error("Notification title and message are required.");
  }

  return Notification.create({
    user: userId,
    type: ALLOWED_TYPES.has(type) ? type : "system",
    title: normalizedTitle,
    message: normalizedMessage,
    icon: normalizeText(icon) || "🔔",
    link: normalizeText(link),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  });
}

async function createQuizNotifications({
  userId,
  resultId,
  category,
  score,
  totalQuestions,
  accuracy,
  xpEarned,
  currentStreak,
  previousStreak,
  achievements = [],
  session = null,
}) {
  const notifications = [];

  notifications.push({
    userId,
    type: "quiz",
    title: "Quiz Completed",
    message: `You scored ${score}/${totalQuestions} in ${category} with ${accuracy}% accuracy.`,
    icon: "🧠",
    link: `/result/${resultId}`,
    metadata: {
      resultId,
      category,
      score,
      totalQuestions,
      accuracy,
    },
  });

  if (Number(xpEarned) > 0) {
    notifications.push({
      userId,
      type: "xp",
      title: "XP Earned",
      message: `You earned ${xpEarned} XP from your ${category} quiz.`,
      icon: "⚡",
      link: `/result/${resultId}`,
      metadata: {
        resultId,
        category,
        xpEarned,
      },
    });
  }

  if (
    Number(currentStreak) > Number(previousStreak) &&
    Number(currentStreak) > 1
  ) {
    notifications.push({
      userId,
      type: "streak",
      title: "Streak Increased",
      message: `Your quiz streak is now ${currentStreak} days.`,
      icon: "🔥",
      link: "/dashboard",
      metadata: {
        currentStreak,
        previousStreak,
      },
    });
  }

  for (const achievement of achievements) {
    notifications.push({
      userId,
      type: "achievement",
      title: "Achievement Unlocked",
      message: `${achievement.title}: ${achievement.description}`,
      icon: achievement.icon || "🏆",
      link: "/achievements",
      metadata: {
        achievementId: achievement.id || achievement._id || null,
        code: achievement.code,
        category: achievement.category,
        threshold: achievement.threshold,
      },
    });
  }

  if (notifications.length === 0) {
    return [];
  }

  const documents = notifications.map((notification) => ({
    user: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    icon: notification.icon,
    link: notification.link,
    metadata: notification.metadata,
  }));

  return Notification.insertMany(documents, session ? { session } : {});
}

async function createAccountNotification({
  userId,
  title,
  message,
  icon = "👤",
  link = "/settings",
  metadata = {},
}) {
  return createNotification({
    userId,
    type: "account",
    title,
    message,
    icon,
    link,
    metadata,
  });
}

module.exports = {
  createNotification,
  createQuizNotifications,
  createAccountNotification,
};
