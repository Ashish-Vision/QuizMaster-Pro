"use strict";

const analyticsState = {
  isLoading: false,
  data: null,
};

const elements = {
  loading: document.getElementById("analyticsLoading"),
  error: document.getElementById("analyticsError"),
  errorMessage: document.getElementById("analyticsErrorMessage"),
  retryButton: document.getElementById("analyticsRetryButton"),
  content: document.getElementById("analyticsContent"),

  totalQuizzes: document.getElementById("totalQuizzes"),
  averageAccuracy: document.getElementById("averageAccuracy"),
  bestAccuracy: document.getElementById("bestAccuracy"),
  totalXpEarned: document.getElementById("totalXpEarned"),
  currentStreak: document.getElementById("currentStreak"),

  correctAnswers: document.getElementById("correctAnswers"),
  wrongAnswers: document.getElementById("wrongAnswers"),
  unansweredAnswers: document.getElementById("unansweredAnswers"),

  correctPercentage: document.getElementById("correctPercentage"),
  wrongPercentage: document.getElementById("wrongPercentage"),
  unansweredPercentage: document.getElementById("unansweredPercentage"),

  correctProgress: document.getElementById("correctProgress"),
  wrongProgress: document.getElementById("wrongProgress"),
  unansweredProgress: document.getElementById("unansweredProgress"),

  correctProgressTrack: document.getElementById("correctProgressTrack"),
  wrongProgressTrack: document.getElementById("wrongProgressTrack"),
  unansweredProgressTrack: document.getElementById("unansweredProgressTrack"),

  strongestCategory: document.getElementById("strongestCategory"),
  strongestCategoryAccuracy: document.getElementById(
    "strongestCategoryAccuracy",
  ),
  strongestCategoryProgress: document.getElementById(
    "strongestCategoryProgress",
  ),

  weakestCategory: document.getElementById("weakestCategory"),
  weakestCategoryAccuracy: document.getElementById("weakestCategoryAccuracy"),
  weakestCategoryProgress: document.getElementById("weakestCategoryProgress"),

  perfectScores: document.getElementById("perfectScores"),
  averageTime: document.getElementById("averageTime"),
  fastestQuiz: document.getElementById("fastestQuiz"),
  longestQuiz: document.getElementById("longestQuiz"),
  totalQuestions: document.getElementById("totalQuestions"),

  recentAccuracy: document.getElementById("recentAccuracy"),
  previousAccuracy: document.getElementById("previousAccuracy"),
  accuracyChange: document.getElementById("accuracyChange"),
  xpChange: document.getElementById("xpChange"),
  recentQuizCount: document.getElementById("recentQuizCount"),
  previousQuizCount: document.getElementById("previousQuizCount"),
  performanceDirection: document.getElementById("performanceDirection"),
  performanceComparisonText: document.getElementById(
    "performanceComparisonText",
  ),

  monthlyPerformanceChart: document.getElementById("monthlyPerformanceChart"),

  dailyActivityGrid: document.getElementById("dailyActivityGrid"),

  categoryAnalyticsList: document.getElementById("categoryAnalyticsList"),

  recentPerformanceGrid: document.getElementById("recentPerformanceGrid"),

  analyticsGeneratedAt: document.getElementById("analyticsGeneratedAt"),
};

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function clampPercentage(value) {
  return Math.min(100, Math.max(0, getNumber(value)));
}

function formatNumber(value) {
  return getNumber(value).toLocaleString("en-IN");
}

function formatPercentage(value, decimals = 1) {
  const number = getNumber(value);

  return `${number.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function formatSignedNumber(value, suffix = "") {
  const number = getNumber(value);

  const prefix = number > 0 ? "+" : "";

  return `${prefix}${number.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function formatDuration(secondsValue) {
  const totalSeconds = Math.max(0, Math.floor(getNumber(secondsValue)));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Unknown date";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(dateValue) {
  if (!dateValue) {
    return "Not available";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateNumber(
  element,
  finalValue,
  { duration = 850, decimals = 0, prefix = "", suffix = "" } = {},
) {
  if (!element) {
    return;
  }

  const targetValue = getNumber(finalValue);

  if (prefersReducedMotion()) {
    element.textContent = `${prefix}${targetValue.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

    return;
  }

  const startTime = performance.now();

  function updateCounter(currentTime) {
    const elapsed = currentTime - startTime;

    const progress = Math.min(elapsed / duration, 1);

    const easedProgress = 1 - Math.pow(1 - progress, 3);

    const currentValue = targetValue * easedProgress;

    element.textContent = `${prefix}${currentValue.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

    if (progress < 1) {
      window.requestAnimationFrame(updateCounter);
    }
  }

  window.requestAnimationFrame(updateCounter);
}

function setProgress(element, track, value) {
  const percentage = clampPercentage(value);

  if (track) {
    track.setAttribute("aria-valuenow", String(Math.round(percentage)));
  }

  if (!element) {
    return;
  }

  element.style.width = "0%";

  if (prefersReducedMotion()) {
    element.style.width = `${percentage}%`;
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      element.style.width = `${percentage}%`;
    });
  });
}

function showLoading() {
  toggleElement(elements.loading, true);
  toggleElement(elements.error, false);
  toggleElement(elements.content, false);
}

function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message || "Unable to load analytics.";
  }

  toggleElement(elements.loading, false);
  toggleElement(elements.error, true);
  toggleElement(elements.content, false);
}

function showContent() {
  toggleElement(elements.loading, false);
  toggleElement(elements.error, false);
  toggleElement(elements.content, true);
}

function renderSummary(data) {
  const summary = data.summary || {};
  const userStats = data.userStats || {};

  animateNumber(elements.totalQuizzes, summary.totalQuizzes);

  animateNumber(elements.averageAccuracy, summary.averageAccuracy, {
    decimals: 1,
    suffix: "%",
  });

  animateNumber(elements.bestAccuracy, summary.bestAccuracy, {
    decimals: 1,
    suffix: "%",
  });

  animateNumber(elements.totalXpEarned, summary.totalXpEarned);

  const streak = getNumber(userStats.currentStreak);

  if (elements.currentStreak) {
    elements.currentStreak.textContent = `${formatNumber(streak)} ${
      streak === 1 ? "day" : "days"
    }`;
  }

  animateNumber(elements.perfectScores, summary.perfectScores);

  animateNumber(elements.totalQuestions, summary.totalQuestions);

  if (elements.averageTime) {
    elements.averageTime.textContent = formatDuration(
      summary.averageTimeTakenSeconds,
    );
  }

  if (elements.fastestQuiz) {
    elements.fastestQuiz.textContent = formatDuration(
      summary.fastestQuizSeconds,
    );
  }

  if (elements.longestQuiz) {
    elements.longestQuiz.textContent = formatDuration(
      summary.longestQuizSeconds,
    );
  }
}

function renderAnswerBreakdown(answerBreakdown = {}) {
  const correct = getNumber(answerBreakdown.correct);
  const wrong = getNumber(answerBreakdown.wrong);
  const unanswered = getNumber(answerBreakdown.unanswered);

  const correctPercentage = clampPercentage(answerBreakdown.correctPercentage);

  const wrongPercentage = clampPercentage(answerBreakdown.wrongPercentage);

  const unansweredPercentage = clampPercentage(
    answerBreakdown.unansweredPercentage,
  );

  animateNumber(elements.correctAnswers, correct);
  animateNumber(elements.wrongAnswers, wrong);
  animateNumber(elements.unansweredAnswers, unanswered);

  if (elements.correctPercentage) {
    elements.correctPercentage.textContent =
      formatPercentage(correctPercentage);
  }

  if (elements.wrongPercentage) {
    elements.wrongPercentage.textContent = formatPercentage(wrongPercentage);
  }

  if (elements.unansweredPercentage) {
    elements.unansweredPercentage.textContent =
      formatPercentage(unansweredPercentage);
  }

  setProgress(
    elements.correctProgress,
    elements.correctProgressTrack,
    correctPercentage,
  );

  setProgress(
    elements.wrongProgress,
    elements.wrongProgressTrack,
    wrongPercentage,
  );

  setProgress(
    elements.unansweredProgress,
    elements.unansweredProgressTrack,
    unansweredPercentage,
  );
}

function renderHighlights(data) {
  const strongest = data.strongestCategory || null;
  const weakest = data.weakestCategory || null;

  if (strongest) {
    if (elements.strongestCategory) {
      elements.strongestCategory.textContent = strongest.category || "Unknown";
    }

    if (elements.strongestCategoryAccuracy) {
      elements.strongestCategoryAccuracy.textContent = `${formatPercentage(
        strongest.averageAccuracy,
      )} average accuracy across ${formatNumber(strongest.quizzesCompleted)} ${
        getNumber(strongest.quizzesCompleted) === 1 ? "quiz" : "quizzes"
      }.`;
    }

    setProgress(
      elements.strongestCategoryProgress,
      null,
      strongest.averageAccuracy,
    );
  } else {
    if (elements.strongestCategory) {
      elements.strongestCategory.textContent = "No data yet";
    }

    if (elements.strongestCategoryAccuracy) {
      elements.strongestCategoryAccuracy.textContent =
        "Complete quizzes to discover your strongest category.";
    }

    setProgress(elements.strongestCategoryProgress, null, 0);
  }

  if (weakest) {
    if (elements.weakestCategory) {
      elements.weakestCategory.textContent = weakest.category || "Unknown";
    }

    if (elements.weakestCategoryAccuracy) {
      elements.weakestCategoryAccuracy.textContent = `${formatPercentage(
        weakest.averageAccuracy,
      )} average accuracy. Focus here to improve.`;
    }

    setProgress(
      elements.weakestCategoryProgress,
      null,
      weakest.averageAccuracy,
    );
  } else {
    if (elements.weakestCategory) {
      elements.weakestCategory.textContent = "No data yet";
    }

    if (elements.weakestCategoryAccuracy) {
      elements.weakestCategoryAccuracy.textContent =
        "Complete quizzes to view category insights.";
    }

    setProgress(elements.weakestCategoryProgress, null, 0);
  }
}

function renderPerformanceComparison(comparison = {}) {
  const available = Boolean(comparison.available);

  if (!available) {
    if (elements.recentAccuracy) {
      elements.recentAccuracy.textContent = "0%";
    }

    if (elements.previousAccuracy) {
      elements.previousAccuracy.textContent = "0%";
    }

    if (elements.accuracyChange) {
      elements.accuracyChange.textContent = "0%";
      elements.accuracyChange.className = "";
    }

    if (elements.xpChange) {
      elements.xpChange.textContent = "0 XP";
      elements.xpChange.className = "";
    }

    if (elements.performanceDirection) {
      elements.performanceDirection.textContent = "Stable";
      elements.performanceDirection.className = "performance-direction stable";
    }

    if (elements.performanceComparisonText) {
      elements.performanceComparisonText.textContent =
        "Complete more quizzes to generate a comparison.";
    }

    if (elements.recentQuizCount) {
      elements.recentQuizCount.textContent = `${formatNumber(
        comparison.recentQuizCount,
      )} recent quizzes`;
    }

    if (elements.previousQuizCount) {
      elements.previousQuizCount.textContent = "No previous comparison group";
    }

    return;
  }

  const direction = comparison.direction || "stable";

  if (elements.recentAccuracy) {
    elements.recentAccuracy.textContent = formatPercentage(
      comparison.recentAccuracy,
    );
  }

  if (elements.previousAccuracy) {
    elements.previousAccuracy.textContent = formatPercentage(
      comparison.previousAccuracy,
    );
  }

  if (elements.accuracyChange) {
    const accuracyChange = getNumber(comparison.accuracyChange);

    elements.accuracyChange.textContent = formatSignedNumber(
      accuracyChange,
      "%",
    );

    elements.accuracyChange.className =
      accuracyChange > 0
        ? "positive-change"
        : accuracyChange < 0
          ? "negative-change"
          : "neutral-change";
  }

  if (elements.xpChange) {
    const xpChange = getNumber(comparison.xpChange);

    elements.xpChange.textContent = formatSignedNumber(xpChange, " XP");

    elements.xpChange.className =
      xpChange > 0
        ? "positive-change"
        : xpChange < 0
          ? "negative-change"
          : "neutral-change";
  }

  if (elements.recentQuizCount) {
    elements.recentQuizCount.textContent = `${formatNumber(
      comparison.recentQuizCount,
    )} recent quizzes`;
  }

  if (elements.previousQuizCount) {
    elements.previousQuizCount.textContent = `${formatNumber(
      comparison.previousQuizCount,
    )} previous quizzes`;
  }

  if (elements.performanceDirection) {
    const directionLabels = {
      improving: "Improving ↑",
      declining: "Declining ↓",
      stable: "Stable →",
    };

    elements.performanceDirection.textContent =
      directionLabels[direction] || directionLabels.stable;

    elements.performanceDirection.className = `performance-direction ${direction}`;
  }

  if (elements.performanceComparisonText) {
    if (direction === "improving") {
      elements.performanceComparisonText.textContent =
        "Your recent average accuracy is higher than your previous quizzes.";
    } else if (direction === "declining") {
      elements.performanceComparisonText.textContent =
        "Your recent accuracy is lower. Review weak categories and retry mistakes.";
    } else {
      elements.performanceComparisonText.textContent =
        "Your recent performance is consistent with your previous quizzes.";
    }
  }
}

function createMonthlyChartColumn(item, maximumXp) {
  const column = document.createElement("article");

  column.className = "monthly-chart-column";

  const chartBarArea = document.createElement("div");

  chartBarArea.className = "monthly-chart-bar-area";

  const xpBar = document.createElement("div");

  xpBar.className = "monthly-xp-bar";

  const xpValue = getNumber(item.totalXpEarned);

  const heightPercentage =
    maximumXp > 0 ? Math.max(8, (xpValue / maximumXp) * 100) : 0;

  xpBar.style.height = prefersReducedMotion() ? `${heightPercentage}%` : "0%";

  xpBar.setAttribute(
    "aria-label",
    `${formatNumber(xpValue)} XP earned in ${item.label || "this month"}`,
  );

  const xpLabel = document.createElement("strong");

  xpLabel.textContent = `${formatNumber(xpValue)} XP`;

  xpBar.appendChild(xpLabel);

  chartBarArea.appendChild(xpBar);

  const monthLabel = document.createElement("span");

  monthLabel.className = "monthly-chart-label";

  monthLabel.textContent = item.label || `${item.month}/${item.year}`;

  const details = document.createElement("small");

  details.textContent = `${formatNumber(
    item.quizzesCompleted,
  )} quizzes • ${formatPercentage(item.averageAccuracy)}`;

  column.append(chartBarArea, monthLabel, details);

  if (!prefersReducedMotion()) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        xpBar.style.height = `${heightPercentage}%`;
      });
    });
  }

  return column;
}

function renderMonthlyPerformance(months) {
  if (!elements.monthlyPerformanceChart) {
    return;
  }

  elements.monthlyPerformanceChart.innerHTML = "";

  if (!Array.isArray(months) || months.length === 0) {
    const emptyState = document.createElement("div");

    emptyState.className = "analytics-empty";

    emptyState.textContent =
      "Complete quizzes to generate monthly performance analytics.";

    elements.monthlyPerformanceChart.appendChild(emptyState);

    return;
  }

  const maximumXp = Math.max(
    ...months.map((item) => getNumber(item.totalXpEarned)),
    1,
  );

  const fragment = document.createDocumentFragment();

  months.forEach((item) => {
    fragment.appendChild(createMonthlyChartColumn(item, maximumXp));
  });

  elements.monthlyPerformanceChart.appendChild(fragment);
}

function getActivityLevel(day) {
  const quizzes = getNumber(day.quizzesCompleted);

  if (quizzes <= 0) {
    return 0;
  }

  if (quizzes === 1) {
    return 1;
  }

  if (quizzes <= 3) {
    return 2;
  }

  return 3;
}

function createActivityDay(day) {
  const item = document.createElement("article");

  const activityLevel = getActivityLevel(day);

  item.className = `daily-activity-day level-${activityLevel}`;

  if (day.isToday) {
    item.classList.add("today");
  }

  const dayName = document.createElement("span");

  dayName.className = "activity-day-name";

  dayName.textContent = day.dayLabel || "-";

  const activitySquare = document.createElement("div");

  activitySquare.className = "activity-square";

  const quizCount = getNumber(day.quizzesCompleted);

  activitySquare.textContent = quizCount > 0 ? String(quizCount) : "";

  const dateText = document.createElement("small");

  dateText.textContent = day.date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(day.date))
    : day.dateKey || "";

  item.title = [
    day.dateKey || "",
    `${formatNumber(quizCount)} ${quizCount === 1 ? "quiz" : "quizzes"}`,
    `${formatNumber(day.xpEarned)} XP`,
    `${formatPercentage(day.averageAccuracy)} accuracy`,
  ].join(" • ");

  item.tabIndex = 0;

  item.setAttribute("aria-label", item.title);

  item.append(dayName, activitySquare, dateText);

  return item;
}

function renderDailyActivity(days) {
  if (!elements.dailyActivityGrid) {
    return;
  }

  elements.dailyActivityGrid.innerHTML = "";

  if (!Array.isArray(days) || days.length === 0) {
    const emptyState = document.createElement("div");

    emptyState.className = "analytics-empty";

    emptyState.textContent = "Daily activity is not available yet.";

    elements.dailyActivityGrid.appendChild(emptyState);

    return;
  }

  const fragment = document.createDocumentFragment();

  days.forEach((day) => {
    fragment.appendChild(createActivityDay(day));
  });

  elements.dailyActivityGrid.appendChild(fragment);
}

function createCategoryRow(category) {
  const row = document.createElement("article");

  row.className = "analytics-table-row";

  const categoryCell = document.createElement("div");

  categoryCell.className = "category-name-cell";

  const icon = document.createElement("span");

  icon.textContent = "📚";
  icon.setAttribute("aria-hidden", "true");

  const categoryInformation = document.createElement("div");

  categoryInformation.className = "category-name-information";

  const categoryName = document.createElement("strong");

  categoryName.textContent = category.category || "Unknown";

  const categoryDetails = document.createElement("small");

  categoryDetails.textContent = `${formatNumber(
    category.correctAnswers,
  )} correct • ${formatDuration(category.averageTimeTakenSeconds)} avg`;

  categoryInformation.append(categoryName, categoryDetails);

  categoryCell.append(icon, categoryInformation);

  const quizzes = document.createElement("span");

  quizzes.textContent = formatNumber(category.quizzesCompleted);

  const accuracyCell = document.createElement("div");

  accuracyCell.className = "category-accuracy-cell";

  const accuracyValue = document.createElement("strong");

  accuracyValue.textContent = formatPercentage(category.averageAccuracy);

  const accuracyTrack = document.createElement("div");

  accuracyTrack.className = "category-progress-track";

  const accuracyBar = document.createElement("div");

  accuracyBar.className = "category-progress-fill";

  const accuracy = clampPercentage(category.averageAccuracy);

  accuracyBar.style.width = prefersReducedMotion() ? `${accuracy}%` : "0%";

  accuracyTrack.appendChild(accuracyBar);

  accuracyCell.append(accuracyValue, accuracyTrack);

  const best = document.createElement("span");

  best.textContent = formatPercentage(category.bestAccuracy);

  const xp = document.createElement("strong");

  xp.className = "category-xp";

  xp.textContent = `${formatNumber(category.xpEarned)} XP`;

  row.append(categoryCell, quizzes, accuracyCell, best, xp);

  if (!prefersReducedMotion()) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        accuracyBar.style.width = `${accuracy}%`;
      });
    });
  }

  return row;
}

function renderCategoryAnalytics(categories) {
  if (!elements.categoryAnalyticsList) {
    return;
  }

  elements.categoryAnalyticsList.innerHTML = "";

  if (!Array.isArray(categories) || categories.length === 0) {
    const emptyState = document.createElement("div");

    emptyState.className = "analytics-empty";

    emptyState.textContent = "Complete quizzes to generate category analytics.";

    elements.categoryAnalyticsList.appendChild(emptyState);

    return;
  }

  const fragment = document.createDocumentFragment();

  categories.forEach((category) => {
    fragment.appendChild(createCategoryRow(category));
  });

  elements.categoryAnalyticsList.appendChild(fragment);
}

function createRecentPerformanceCard(score) {
  const card = document.createElement("a");

  card.className = "recent-performance-card";

  card.href = score.id ? `/result/${encodeURIComponent(score.id)}` : "/history";

  const header = document.createElement("div");

  header.className = "recent-performance-header";

  const category = document.createElement("span");

  category.textContent = score.category || "Unknown";

  const accuracy = document.createElement("strong");

  const accuracyValue = getNumber(score.accuracy);

  accuracy.textContent = formatPercentage(accuracyValue);

  if (accuracyValue >= 80) {
    accuracy.classList.add("good-score");
  } else if (accuracyValue >= 60) {
    accuracy.classList.add("average-score");
  } else {
    accuracy.classList.add("low-score");
  }

  header.append(category, accuracy);

  const scoreValue = document.createElement("h3");

  scoreValue.textContent = `${formatNumber(score.score)} / ${formatNumber(
    score.totalQuestions,
  )}`;

  const answerDetails = document.createElement("div");

  answerDetails.className = "recent-answer-details";

  const correct = document.createElement("span");

  correct.textContent = `✓ ${formatNumber(score.correctAnswers)}`;

  const wrong = document.createElement("span");

  wrong.textContent = `✕ ${formatNumber(score.wrongAnswers)}`;

  const time = document.createElement("span");

  time.textContent = `⏱ ${formatDuration(score.timeTakenSeconds)}`;

  answerDetails.append(correct, wrong, time);

  const footer = document.createElement("div");

  footer.className = "recent-performance-footer";

  const date = document.createElement("span");

  date.textContent = formatDate(score.completedAt);

  const xp = document.createElement("strong");

  xp.textContent = `+${formatNumber(score.xpEarned)} XP`;

  footer.append(date, xp);

  card.append(header, scoreValue, answerDetails, footer);

  return card;
}

function renderRecentPerformance(scores) {
  if (!elements.recentPerformanceGrid) {
    return;
  }

  elements.recentPerformanceGrid.innerHTML = "";

  if (!Array.isArray(scores) || scores.length === 0) {
    const emptyState = document.createElement("div");

    emptyState.className = "analytics-empty";

    emptyState.textContent = "Your recent quiz attempts will appear here.";

    elements.recentPerformanceGrid.appendChild(emptyState);

    return;
  }

  const fragment = document.createDocumentFragment();

  scores.slice(0, 6).forEach((score) => {
    fragment.appendChild(createRecentPerformanceCard(score));
  });

  elements.recentPerformanceGrid.appendChild(fragment);
}

function animateCards() {
  if (prefersReducedMotion()) {
    return;
  }

  const cards = document.querySelectorAll(
    [
      ".overview-card",
      ".analytics-card",
      ".highlight-card",
      ".answer-summary-grid article",
      ".recent-performance-card",
      ".monthly-chart-column",
    ].join(","),
  );

  cards.forEach((card, index) => {
    card.animate(
      [
        {
          opacity: 0,
          transform: "translateY(16px)",
        },
        {
          opacity: 1,
          transform: "translateY(0)",
        },
      ],
      {
        duration: 440,
        delay: Math.min(index * 45, 420),
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      },
    );
  });
}

function renderAnalytics(data) {
  analyticsState.data = data;

  renderSummary(data);

  renderAnswerBreakdown(data.answerBreakdown);

  renderHighlights(data);

  renderPerformanceComparison(data.performanceComparison);

  renderMonthlyPerformance(data.monthlyPerformance);

  renderDailyActivity(data.dailyPerformance);

  renderCategoryAnalytics(data.categoryPerformance);

  renderRecentPerformance(data.recentPerformance);

  if (elements.analyticsGeneratedAt) {
    elements.analyticsGeneratedAt.textContent = formatDateTime(
      data.generatedAt,
    );
  }

  window.requestAnimationFrame(() => {
    animateCards();
  });
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid analytics response.");
  }

  return response.json();
}

async function loadAnalytics() {
  if (analyticsState.isLoading) {
    return;
  }

  analyticsState.isLoading = true;

  showLoading();

  try {
    const response = await fetch("/api/analytics", {
      method: "GET",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load analytics.");
    }

    showContent();

    window.requestAnimationFrame(() => {
      renderAnalytics(data);
    });
  } catch (error) {
    console.error("Analytics loading error:", error);

    showError(error.message || "Unable to load analytics.");
  } finally {
    analyticsState.isLoading = false;
  }
}

function initializeAnalyticsPage() {
  elements.retryButton?.addEventListener("click", loadAnalytics);

  loadAnalytics();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAnalyticsPage);
} else {
  initializeAnalyticsPage();
}
