"use strict";

const elements = {
  loading: document.getElementById("adminLoading"),

  error: document.getElementById("adminError"),

  errorMessage: document.getElementById("adminErrorMessage"),

  retryButton: document.getElementById("adminRetryButton"),

  content: document.getElementById("adminContent"),

  logoutButton: document.getElementById("adminLogoutButton"),

  totalUsers: document.getElementById("totalUsers"),

  regularUserText: document.getElementById("regularUserText"),

  totalAttempts: document.getElementById("totalAttempts"),

  totalXp: document.getElementById("totalXp"),

  totalAchievements: document.getElementById("totalAchievements"),

  averageAccuracy: document.getElementById("averageAccuracy"),

  highestAccuracy: document.getElementById("highestAccuracy"),

  averageQuizTime: document.getElementById("averageQuizTime"),

  totalQuestions: document.getElementById("totalQuestions"),

  correctAnswers: document.getElementById("correctAnswers"),

  wrongAnswers: document.getElementById("wrongAnswers"),

  correctProgress: document.getElementById("correctProgress"),

  wrongProgress: document.getElementById("wrongProgress"),

  categoryGrid: document.getElementById("categoryGrid"),

  recentUsersList: document.getElementById("recentUsersList"),

  recentAttemptsList: document.getElementById("recentAttemptsList"),

  weeklyAttemptTotal: document.getElementById("weeklyAttemptTotal"),

  weeklyXpTotal: document.getElementById("weeklyXpTotal"),

  weeklyUserTotal: document.getElementById("weeklyUserTotal"),
};

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function formatDuration(secondsValue) {
  const totalSeconds = Math.max(0, Number(secondsValue) || 0);

  const minutes = Math.floor(totalSeconds / 60);

  const seconds = Math.floor(totalSeconds % 60);

  return `${minutes}m ${seconds}s`;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderOverview(data) {
  const overview = data.overview || {};
  const answers = data.answerStatistics || {};

  elements.totalUsers.textContent = Number(overview.totalUsers) || 0;

  elements.regularUserText.textContent = `${
    Number(overview.totalRegularUsers) || 0
  } regular user${Number(overview.totalRegularUsers) === 1 ? "" : "s"}`;

  elements.totalAttempts.textContent = Number(overview.totalQuizAttempts) || 0;

  elements.totalXp.textContent = Number(overview.totalXpEarned) || 0;

  elements.totalAchievements.textContent =
    Number(overview.totalAchievementsUnlocked) || 0;

  elements.averageAccuracy.textContent = `${
    Number(overview.averageAccuracy) || 0
  }%`;

  elements.highestAccuracy.textContent = `${
    Number(overview.highestAccuracy) || 0
  }%`;

  elements.averageQuizTime.textContent = formatDuration(
    overview.averageQuizTimeSeconds,
  );

  const totalQuestions = Number(answers.totalQuestions) || 0;

  const correctAnswers = Number(answers.correctAnswers) || 0;

  const wrongAnswers = Number(answers.wrongAnswers) || 0;

  elements.totalQuestions.textContent = totalQuestions;

  elements.correctAnswers.textContent = correctAnswers;

  elements.wrongAnswers.textContent = wrongAnswers;

  const correctPercentage =
    totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

  const wrongPercentage =
    totalQuestions > 0 ? (wrongAnswers / totalQuestions) * 100 : 0;

  elements.correctProgress.style.width = `${Math.min(correctPercentage, 100)}%`;

  elements.wrongProgress.style.width = `${Math.min(wrongPercentage, 100)}%`;
}

function renderCategories(categories) {
  elements.categoryGrid.innerHTML = "";

  if (!Array.isArray(categories) || categories.length === 0) {
    elements.categoryGrid.innerHTML = `
      <div class="empty-state">
        Category statistics will appear after users complete quizzes.
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  categories.forEach((category) => {
    const card = document.createElement("article");

    card.className = "category-stat-card";

    card.innerHTML = `
      <div class="category-stat-header">
        <span class="category-icon">
          📚
        </span>

        <strong>
          ${escapeHtml(category.category)}
        </strong>
      </div>

      <div class="category-metrics">
        <div>
          <span>Attempts</span>
          <strong>
            ${Number(category.attempts) || 0}
          </strong>
        </div>

        <div>
          <span>Accuracy</span>
          <strong>
            ${Number(category.averageAccuracy) || 0}%
          </strong>
        </div>

        <div>
          <span>XP Earned</span>
          <strong>
            ${Number(category.totalXpEarned) || 0}
          </strong>
        </div>
      </div>
    `;

    fragment.appendChild(card);
  });

  elements.categoryGrid.appendChild(fragment);
}

function renderRecentUsers(users) {
  elements.recentUsersList.innerHTML = "";

  if (!Array.isArray(users) || users.length === 0) {
    elements.recentUsersList.innerHTML = `
      <div class="empty-state">
        No users found.
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  users.forEach((user) => {
    const row = document.createElement("article");

    row.className = "table-row";

    const fullName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User";

    const initial = fullName.charAt(0).toUpperCase();

    row.innerHTML = `
      <div class="user-cell">
        <span class="row-avatar">
          ${escapeHtml(initial)}
        </span>

        <div>
          <strong>
            ${escapeHtml(fullName)}
          </strong>

          <small>
            ${escapeHtml(user.email)}
          </small>
        </div>
      </div>

      <div class="row-meta">
        <span class="role-badge ${user.role === "admin" ? "admin" : ""}">
          ${escapeHtml(user.role || "user")}
        </span>

        <small>
          ${formatDate(user.createdAt)}
        </small>
      </div>
    `;

    fragment.appendChild(row);
  });

  elements.recentUsersList.appendChild(fragment);
}

function renderRecentAttempts(attempts) {
  elements.recentAttemptsList.innerHTML = "";

  if (!Array.isArray(attempts) || attempts.length === 0) {
    elements.recentAttemptsList.innerHTML = `
      <div class="empty-state">
        No quiz attempts found.
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  attempts.forEach((attempt) => {
    const row = document.createElement("article");

    row.className = "table-row";

    const userName = attempt.user
      ? `${attempt.user.firstName || ""} ${attempt.user.lastName || ""}`.trim()
      : "Deleted User";

    row.innerHTML = `
      <div>
        <strong>
          ${escapeHtml(userName || "Unknown User")}
        </strong>

        <small>
          ${escapeHtml(attempt.category || "Unknown Category")}
          •
          ${Number(attempt.score) || 0} /
          ${Number(attempt.totalQuestions) || 0}
        </small>
      </div>

      <div class="row-meta">
        <strong class="accuracy-text">
          ${Number(attempt.accuracy) || 0}%
        </strong>

        <small>
          ${formatDate(attempt.completedAt || attempt.createdAt)}
        </small>
      </div>
    `;

    fragment.appendChild(row);
  });

  elements.recentAttemptsList.appendChild(fragment);
}

function renderCharts(data) {
  const trends = data.trends || {};

  const daily = Array.isArray(trends.daily) ? trends.daily : [];

  const accuracyDistribution = Array.isArray(trends.accuracyDistribution)
    ? trends.accuracyDistribution
    : [];

  const categories = Array.isArray(data.categoryStatistics)
    ? data.categoryStatistics
    : [];

  const labels = daily.map((item) => item.label);

  const attemptValues = daily.map((item) => Number(item.attempts) || 0);

  const xpValues = daily.map((item) => Number(item.xpEarned) || 0);

  const userValues = daily.map((item) => Number(item.newUsers) || 0);

  const weeklyAttempts = attemptValues.reduce(
    (total, value) => total + value,
    0,
  );

  const weeklyXp = xpValues.reduce((total, value) => total + value, 0);

  const weeklyUsers = userValues.reduce((total, value) => total + value, 0);

  if (elements.weeklyAttemptTotal) {
    elements.weeklyAttemptTotal.textContent = weeklyAttempts;
  }

  if (elements.weeklyXpTotal) {
    elements.weeklyXpTotal.textContent = `${weeklyXp} XP`;
  }

  if (elements.weeklyUserTotal) {
    elements.weeklyUserTotal.textContent = weeklyUsers;
  }

  if (!window.AdminCharts) {
    console.warn("Admin chart utilities were not loaded.");

    return;
  }

  window.AdminCharts.drawLineChart("attemptsTrendChart", labels, attemptValues);

  window.AdminCharts.drawLineChart("xpTrendChart", labels, xpValues, {
    color: "#f3b84a",
  });

  window.AdminCharts.drawLineChart("usersTrendChart", labels, userValues, {
    color: "#2ed3a7",
  });

  window.AdminCharts.drawBarChart(
    "categoryDistributionChart",
    categories.map((category) => category.category),
    categories.map((category) => Number(category.attempts) || 0),
  );

  window.AdminCharts.drawBarChart(
    "accuracyDistributionChart",
    accuracyDistribution.map((item) => item.label),
    accuracyDistribution.map((item) => Number(item.count) || 0),
    {
      color: "#7657ff",
    },
  );
}

function renderDashboard(data) {
  renderOverview(data);

  renderCategories(data.categoryStatistics);

  renderRecentUsers(data.recentUsers);

  renderRecentAttempts(data.recentAttempts);

  /*
   * The chart canvases must be visible before
   * their dimensions can be calculated.
   */
  toggleElement(elements.content, true);

  window.requestAnimationFrame(() => {
    renderCharts(data);
  });
}

function showLoading() {
  toggleElement(elements.loading, true);
  toggleElement(elements.error, false);
  toggleElement(elements.content, false);
}

function showError(message) {
  elements.errorMessage.textContent =
    message || "Unable to load administrator dashboard.";

  toggleElement(elements.loading, false);
  toggleElement(elements.error, true);
  toggleElement(elements.content, false);
}

async function loadAdminDashboard() {
  showLoading();

  try {
    const response = await fetch("/api/admin/dashboard", {
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

    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load administrator dashboard.",
      );
    }

    renderDashboard(data);

    toggleElement(elements.loading, false);

    toggleElement(elements.error, false);

    toggleElement(elements.content, true);
  } catch (error) {
    console.error("Admin dashboard error:", error);

    showError(error.message);
  }
}

async function logoutAdmin() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Unable to log out.");
    }

    window.location.href = "/login";
  } catch (error) {
    console.error("Admin logout error:", error);

    alert(error.message || "Unable to log out.");
  }
}

elements.retryButton?.addEventListener("click", loadAdminDashboard);

elements.logoutButton?.addEventListener("click", logoutAdmin);

document.addEventListener("DOMContentLoaded", loadAdminDashboard);
