"use strict";

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

  correctAnswers: document.getElementById("correctAnswers"),

  wrongAnswers: document.getElementById("wrongAnswers"),

  unansweredAnswers: document.getElementById("unansweredAnswers"),

  averageTime: document.getElementById("averageTime"),

  strongestCategory: document.getElementById("strongestCategory"),

  strongestCategoryAccuracy: document.getElementById(
    "strongestCategoryAccuracy",
  ),

  weakestCategory: document.getElementById("weakestCategory"),

  weakestCategoryAccuracy: document.getElementById("weakestCategoryAccuracy"),

  currentStreak: document.getElementById("currentStreak"),

  categoryAnalyticsList: document.getElementById("categoryAnalyticsList"),

  recentPerformanceGrid: document.getElementById("recentPerformanceGrid"),
};

function showElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function formatDuration(secondsValue) {
  const seconds = Math.max(0, Number(secondsValue) || 0);

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function renderSummary(data) {
  const summary = data.summary || {};
  const userStats = data.userStats || {};

  elements.totalQuizzes.textContent = Number(summary.totalQuizzes) || 0;

  elements.averageAccuracy.textContent = `${Number(summary.averageAccuracy) || 0}%`;

  elements.bestAccuracy.textContent = `${Number(summary.bestAccuracy) || 0}%`;

  elements.totalXpEarned.textContent = Number(summary.totalXpEarned) || 0;

  elements.correctAnswers.textContent =
    Number(summary.totalCorrectAnswers) || 0;

  elements.wrongAnswers.textContent = Number(summary.totalWrongAnswers) || 0;

  elements.unansweredAnswers.textContent =
    Number(summary.totalUnansweredQuestions) || 0;

  elements.averageTime.textContent = formatDuration(
    summary.averageTimeTakenSeconds,
  );

  elements.currentStreak.textContent = `${Number(userStats.currentStreak) || 0} day${
    Number(userStats.currentStreak) === 1 ? "" : "s"
  }`;
}

function renderHighlights(data) {
  const strongest = data.strongestCategory;
  const weakest = data.weakestCategory;

  if (strongest) {
    elements.strongestCategory.textContent = strongest.category;

    elements.strongestCategoryAccuracy.textContent = `${strongest.averageAccuracy}% average accuracy`;
  }

  if (weakest) {
    elements.weakestCategory.textContent = weakest.category;

    elements.weakestCategoryAccuracy.textContent = `${weakest.averageAccuracy}% average accuracy`;
  }
}

function renderCategoryAnalytics(categories) {
  elements.categoryAnalyticsList.innerHTML = "";

  if (!Array.isArray(categories) || categories.length === 0) {
    elements.categoryAnalyticsList.innerHTML = `
      <div class="analytics-empty">
        Complete quizzes to generate category analytics.
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  categories.forEach((category) => {
    const row = document.createElement("article");

    row.className = "analytics-table-row";

    row.innerHTML = `
      <div class="category-name-cell">
        <span>📚</span>
        <strong>${category.category}</strong>
      </div>

      <span>${category.quizzesCompleted}</span>

      <span>
        ${category.averageAccuracy}%
      </span>

      <span>
        ${category.bestAccuracy}%
      </span>

      <strong class="category-xp">
        ${category.xpEarned} XP
      </strong>
    `;

    fragment.appendChild(row);
  });

  elements.categoryAnalyticsList.appendChild(fragment);
}

function renderRecentPerformance(scores) {
  elements.recentPerformanceGrid.innerHTML = "";

  if (!Array.isArray(scores) || scores.length === 0) {
    elements.recentPerformanceGrid.innerHTML = `
      <div class="analytics-empty">
        Your recent quiz attempts will appear here.
      </div>
    `;

    return;
  }

  const recentScores = [...scores].reverse().slice(0, 6);

  const fragment = document.createDocumentFragment();

  recentScores.forEach((score) => {
    const card = document.createElement("article");

    card.className = "recent-performance-card";

    card.innerHTML = `
      <div class="recent-performance-header">
        <span>${score.category}</span>

        <strong>${score.accuracy}%</strong>
      </div>

      <h3>
        ${score.score} / ${score.totalQuestions}
      </h3>

      <div class="recent-performance-footer">
        <span>${formatDate(score.completedAt)}</span>
        <span>${score.xpEarned} XP</span>
      </div>
    `;

    fragment.appendChild(card);
  });

  elements.recentPerformanceGrid.appendChild(fragment);
}

function renderAnalytics(data) {
  renderSummary(data);
  renderHighlights(data);

  renderCategoryAnalytics(data.categoryPerformance);

  renderRecentPerformance(data.recentPerformance);
}

function showLoading() {
  showElement(elements.loading, true);
  showElement(elements.error, false);
  showElement(elements.content, false);
}

function showError(message) {
  elements.errorMessage.textContent = message || "Unable to load analytics.";

  showElement(elements.loading, false);
  showElement(elements.error, true);
  showElement(elements.content, false);
}

async function loadAnalytics() {
  showLoading();

  try {
    const response = await fetch("/api/analytics", {
      method: "GET",

      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load analytics.");
    }

    renderAnalytics(data);

    showElement(elements.loading, false);
    showElement(elements.error, false);
    showElement(elements.content, true);
  } catch (error) {
    console.error("Analytics loading error:", error);

    showError(error.message);
  }
}

elements.retryButton?.addEventListener("click", loadAnalytics);

document.addEventListener("DOMContentLoaded", loadAnalytics);
