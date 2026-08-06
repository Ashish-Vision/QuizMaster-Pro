"use strict";

const FIXTURE_DATE = "2026-08-06T00:00:00.000Z";

const account = {
  id: "64b000000000000000000001",
  firstName: "Test",
  lastName: "User",
  fullName: "Test User",
  email: "test@example.invalid",
  role: "user",
  avatar: "",
  totalXp: 120,
  quizzesCompleted: 4,
  correctAnswers: 18,
  currentStreak: 2,
  isActive: true,
  createdAt: FIXTURE_DATE,
};

const emptyPagination = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  totalNotifications: 0,
  totalQuestions: 0,
  totalUsers: 0,
  totalAttempts: 0,
  limit: 20,
  hasPreviousPage: false,
  hasNextPage: false,
};

function getApiFixture(pathname) {
  if (pathname === "/api/quiz/categories") {
    return { success: true, categories: ["Java", "Python"] };
  }

  if (pathname === "/api/quiz/start/Java") {
    return {
      success: true,
      quizSessionId: "stage-one-standard-quiz-session",
      category: "Java",
      totalQuestions: 1,
      questions: [
        {
          _id: "64b000000000000000000031",
          question: "Which keyword declares a class in Java?",
          options: ["class", "type", "struct", "object"],
          category: "Java",
          difficulty: "Easy",
        },
      ],
    };
  }

  if (pathname === "/api/leaderboard") {
    return {
      success: true,
      totalPlayers: 1,
      leaderboard: [
        { ...account, rank: 1, userId: account.id, isCurrentUser: true },
      ],
      currentUser: {
        ...account,
        rank: 1,
        userId: account.id,
        isCurrentUser: true,
      },
    };
  }

  if (pathname === "/api/achievements") {
    return {
      success: true,
      totalAchievements: 1,
      unlockedCount: 1,
      lockedCount: 0,
      newlyUnlocked: [],
      statistics: {},
      achievements: [
        {
          code: "FIRST_QUIZ",
          title: "First Steps",
          description: "Complete your first quiz.",
          icon: "🏆",
          category: "progress",
          isUnlocked: true,
          unlockedAt: FIXTURE_DATE,
        },
      ],
    };
  }

  if (pathname === "/api/daily-challenge") {
    return {
      success: true,
      challenge: {
        id: "64b000000000000000000021",
        title: "Daily Challenge",
        description: "Complete today's quiz challenge.",
        category: "Java",
        difficulty: "Mixed",
        questionCount: 5,
        rewardXp: 50,
        rewardBadge: "Daily Challenger",
        completed: false,
        isAvailable: true,
        startsAt: FIXTURE_DATE,
        expiresAt: "2027-08-06T00:00:00.000Z",
        millisecondsRemaining: 86400000,
      },
    };
  }

  if (
    pathname === "/api/notifications" ||
    pathname === "/api/notifications/unread-count"
  ) {
    return {
      success: true,
      unreadCount: 0,
      notifications: [],
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/history") {
    return {
      success: true,
      history: [],
      categories: [],
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/profile") {
    return {
      success: true,
      profile: {
        ...account,
        statistics: {},
        recentAchievements: [],
        recentAttempts: [],
        favoriteCategory: null,
        weeklyActivity: [],
      },
    };
  }

  if (pathname === "/api/settings") {
    return { success: true, account };
  }

  if (pathname === "/api/analytics") {
    return {
      success: true,
      summary: {},
      userStats: {},
      strongestCategory: null,
      weakestCategory: null,
      answerBreakdown: {},
      performanceComparison: {},
      monthlyPerformance: [],
      dailyPerformance: [],
      categoryPerformance: [],
      recentPerformance: [],
      generatedAt: FIXTURE_DATE,
    };
  }

  if (pathname === "/api/admin/dashboard") {
    return {
      success: true,
      overview: {},
      answerStatistics: {},
      trends: {},
      categoryStatistics: [],
      recentUsers: [],
      recentAttempts: [],
    };
  }

  if (pathname === "/api/admin/questions") {
    return {
      success: true,
      questions: [],
      categories: [],
      difficultyStatistics: {},
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/admin/categories") {
    return { success: true, categories: [], summary: {} };
  }

  if (pathname === "/api/admin/users") {
    return {
      success: true,
      users: [],
      currentAdminId: "64b000000000000000000002",
      summary: {},
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/admin/attempts") {
    return {
      success: true,
      attempts: [],
      categories: [],
      users: [],
      summary: {},
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/admin/analytics") {
    return {
      success: true,
      overview: {},
      answerStatistics: {},
      dailyTrends: [],
      categoryStatistics: [],
      difficultyStatistics: [],
      accuracyDistribution: [],
      topUsers: [],
      recentAttempts: [],
      generatedAt: FIXTURE_DATE,
      period: { days: 30 },
    };
  }

  if (pathname === "/api/admin/achievements") {
    return {
      success: true,
      achievements: [],
      recentUnlocks: [],
      summary: {},
    };
  }

  if (pathname === "/api/admin/notifications") {
    return {
      success: true,
      notifications: [],
      users: [],
      summary: {},
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/admin/reports/summary") {
    return { success: true, summary: {}, period: { days: 30 } };
  }

  if (pathname === "/api/admin/activity-logs/summary") {
    return { success: true, summary: {} };
  }

  if (pathname === "/api/admin/activity-logs") {
    return {
      success: true,
      activityLogs: [],
      logs: [],
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/admin/settings") {
    return { success: true, settings: [] };
  }

  return null;
}

module.exports = { getApiFixture };
