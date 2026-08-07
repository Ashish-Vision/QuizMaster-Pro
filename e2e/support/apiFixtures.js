"use strict";

const FIXTURE_DATE = "2026-08-06T00:00:00.000Z";

const account = {
  id: "64b000000000000000000001",
  firstName: "Avery",
  lastName: "Morgan",
  fullName: "Avery Morgan",
  email: "avery.morgan@example.invalid",
  role: "user",
  avatar: "",
  totalXp: 2480,
  quizzesCompleted: 36,
  correctAnswers: 284,
  currentStreak: 7,
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
    const leaderboard = [
      {
        ...account,
        firstName: "Jordan",
        lastName: "Lee",
        fullName: "Jordan Lee",
        totalXp: 4210,
        rank: 1,
        userId: "64b000000000000000000011",
      },
      {
        ...account,
        firstName: "Samira",
        lastName: "Patel",
        fullName: "Samira Patel",
        totalXp: 3760,
        rank: 2,
        userId: "64b000000000000000000012",
      },
      {
        ...account,
        firstName: "Noah",
        lastName: "Kim",
        fullName: "Noah Kim",
        totalXp: 3090,
        rank: 3,
        userId: "64b000000000000000000013",
      },
      { ...account, rank: 4, userId: account.id, isCurrentUser: true },
    ];
    return {
      success: true,
      totalPlayers: leaderboard.length,
      leaderboard,
      currentUser: leaderboard[3],
    };
  }

  if (pathname === "/api/achievements") {
    return {
      success: true,
      totalAchievements: 3,
      unlockedCount: 2,
      lockedCount: 1,
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
        {
          code: "STREAK_7",
          title: "On a Roll",
          description: "Maintain a seven-day streak.",
          icon: "🔥",
          category: "streak",
          isUnlocked: true,
          unlockedAt: FIXTURE_DATE,
        },
        {
          code: "QUIZ_MASTER",
          title: "Quiz Master",
          description: "Complete 50 quizzes.",
          icon: "👑",
          category: "progress",
          isUnlocked: false,
          unlockedAt: null,
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
      history: [
        {
          _id: "64b000000000000000000041",
          category: "Java",
          score: 9,
          totalQuestions: 10,
          correctAnswers: 9,
          wrongAnswers: 1,
          unansweredQuestions: 0,
          accuracy: 90,
          xpEarned: 90,
          timeTakenSeconds: 312,
          completedAt: FIXTURE_DATE,
        },
      ],
      categories: ["Java", "Python", "JavaScript"],
      pagination: { ...emptyPagination, totalItems: 1, totalAttempts: 1 },
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
      overview: {
        totalUsers: 128,
        totalAdmins: 4,
        totalActiveUsers: 119,
        usersLoggedInToday: 37,
        totalRegularUsers: 124,
        totalQuizAttempts: 1840,
        totalQuestionsAvailable: 240,
        totalCategories: 3,
        totalXpEarned: 148200,
        totalAchievementsUnlocked: 286,
        averageAccuracy: 81,
        highestAccuracy: 100,
        averageQuizTimeSeconds: 342,
      },
      answerStatistics: {
        totalQuestions: 17820,
        correctAnswers: 14280,
        wrongAnswers: 3120,
        unansweredQuestions: 420,
      },
      trends: {},
      categoryStatistics: [],
      recentUsers: [],
      recentAttempts: [],
    };
  }

  if (pathname === "/api/admin/questions") {
    return {
      success: true,
      questions: [
        {
          _id: "q1",
          question: "Which keyword declares a class in Java?",
          options: ["class", "type", "struct", "object"],
          correctAnswer: 0,
          category: "Java",
          difficulty: "Easy",
          createdAt: FIXTURE_DATE,
        },
        {
          _id: "q2",
          question: "Which collection preserves insertion order?",
          options: ["HashSet", "ArrayList", "TreeSet", "Map"],
          correctAnswer: 1,
          category: "Java",
          difficulty: "Medium",
          createdAt: FIXTURE_DATE,
        },
      ],
      categories: ["Java", "Python", "JavaScript"],
      difficultyStatistics: { Easy: 84, Medium: 92, Hard: 64 },
      pagination: {
        ...emptyPagination,
        totalQuestions: 240,
        totalItems: 240,
        totalPages: 120,
      },
    };
  }

  if (pathname === "/api/admin/categories") {
    return {
      success: true,
      categories: [
        {
          name: "Java",
          totalQuestions: 82,
          easyQuestions: 28,
          mediumQuestions: 31,
          hardQuestions: 23,
          quizAttempts: 690,
          averageAccuracy: 84,
          totalXpEarned: 56200,
          updatedAt: FIXTURE_DATE,
        },
        {
          name: "Python",
          totalQuestions: 76,
          easyQuestions: 27,
          mediumQuestions: 29,
          hardQuestions: 20,
          quizAttempts: 610,
          averageAccuracy: 79,
          totalXpEarned: 48900,
          updatedAt: FIXTURE_DATE,
        },
        {
          name: "JavaScript",
          totalQuestions: 82,
          easyQuestions: 29,
          mediumQuestions: 32,
          hardQuestions: 21,
          quizAttempts: 540,
          averageAccuracy: 81,
          totalXpEarned: 43100,
          updatedAt: FIXTURE_DATE,
        },
      ],
      summary: {
        totalCategories: 3,
        totalQuestions: 240,
        totalAttempts: 1840,
        mostPopularCategory: "Java",
      },
    };
  }

  if (pathname === "/api/admin/users") {
    return {
      success: true,
      users: [
        { ...account },
        {
          ...account,
          id: "u2",
          firstName: "Samira",
          lastName: "Patel",
          fullName: "Samira Patel",
          email: "samira.patel@example.invalid",
          totalXp: 3760,
        },
        {
          ...account,
          id: "u3",
          firstName: "Noah",
          lastName: "Kim",
          fullName: "Noah Kim",
          email: "noah.kim@example.invalid",
          totalXp: 3090,
        },
      ],
      currentAdminId: "64b000000000000000000002",
      summary: {
        totalUsers: 128,
        totalAdmins: 4,
        activeUsers: 119,
        disabledUsers: 9,
      },
      pagination: {
        ...emptyPagination,
        totalUsers: 128,
        totalItems: 128,
        totalPages: 43,
      },
    };
  }

  if (pathname === "/api/admin/attempts") {
    return {
      success: true,
      attempts: [
        {
          _id: "a1",
          user: account,
          category: "Java",
          score: 9,
          totalQuestions: 10,
          accuracy: 90,
          xpEarned: 90,
          timeTakenSeconds: 312,
          completedAt: FIXTURE_DATE,
        },
        {
          _id: "a2",
          user: {
            ...account,
            fullName: "Samira Patel",
            email: "samira.patel@example.invalid",
          },
          category: "Python",
          score: 8,
          totalQuestions: 10,
          accuracy: 80,
          xpEarned: 80,
          timeTakenSeconds: 355,
          completedAt: FIXTURE_DATE,
        },
      ],
      categories: ["Java", "Python", "JavaScript"],
      users: [account],
      summary: {
        totalAttempts: 1840,
        totalXpEarned: 148200,
        averageAccuracy: 81,
        perfectScores: 214,
      },
      pagination: {
        ...emptyPagination,
        totalAttempts: 1840,
        totalItems: 1840,
        totalPages: 920,
      },
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
      achievements: [
        {
          code: "FIRST_QUIZ",
          title: "First Steps",
          description: "Complete a first quiz.",
          icon: "🏆",
          category: "progress",
          unlockCount: 112,
          unlockPercentage: 87.5,
        },
        {
          code: "STREAK_7",
          title: "On a Roll",
          description: "Maintain a seven-day streak.",
          icon: "🔥",
          category: "streak",
          unlockCount: 48,
          unlockPercentage: 37.5,
        },
      ],
      recentUnlocks: [],
      summary: {
        totalDefinitions: 12,
        totalUnlocks: 286,
        usersWithAchievements: 96,
        overallUnlockPercentage: 75,
      },
    };
  }

  if (pathname === "/api/admin/notifications") {
    return {
      success: true,
      notifications: [],
      users: [account],
      summary: {
        totalNotifications: 14,
        unreadNotifications: 37,
        readNotifications: 91,
        totalRecipients: 128,
      },
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/admin/reports/summary") {
    return {
      success: true,
      summary: {
        totalUsers: 128,
        totalQuestions: 240,
        totalAttempts: 1840,
        totalXpEarned: 148200,
      },
      period: { days: 30 },
    };
  }

  if (pathname === "/api/admin/activity-logs/summary") {
    return {
      success: true,
      summary: {
        totalLogs: 684,
        todayLogs: 42,
        exportLogs: 18,
        systemLogs: 96,
      },
    };
  }

  if (pathname === "/api/admin/activity-logs") {
    return {
      success: true,
      activityLogs: [
        {
          _id: "l1",
          action: "USER_ROLE_UPDATED",
          category: "user",
          actor: { fullName: "Admin User", email: "admin@example.invalid" },
          description: "Updated a synthetic learner role",
          createdAt: FIXTURE_DATE,
          metadata: {},
        },
        {
          _id: "l2",
          action: "QUESTIONS_EXPORTED",
          category: "export",
          actor: { fullName: "Admin User", email: "admin@example.invalid" },
          description: "Exported the question report",
          createdAt: FIXTURE_DATE,
          metadata: {},
        },
      ],
      logs: [],
      pagination: emptyPagination,
    };
  }

  if (pathname === "/api/admin/settings") {
    return {
      success: true,
      settings: [
        {
          key: "platformName",
          value: "QuizMaster Pro",
          category: "general",
          label: "Platform name",
          description: "Public platform title",
          type: "text",
          updatedAt: FIXTURE_DATE,
        },
        {
          key: "dailyChallengeEnabled",
          value: true,
          category: "features",
          label: "Daily challenges",
          description: "Offer daily challenges",
          type: "boolean",
          updatedAt: FIXTURE_DATE,
        },
      ],
    };
  }

  if (pathname === "/api/quiz/result/64b000000000000000000041") {
    return {
      success: true,
      result: {
        resultId: "64b000000000000000000041",
        category: "Java",
        score: 9,
        totalQuestions: 10,
        correctAnswers: 9,
        wrongAnswers: 1,
        unansweredQuestions: 0,
        accuracy: 90,
        percentage: 90,
        xpEarned: 90,
        timeTakenSeconds: 312,
        completedAt: FIXTURE_DATE,
        answers: [],
      },
    };
  }

  return null;
}

module.exports = { getApiFixture };
