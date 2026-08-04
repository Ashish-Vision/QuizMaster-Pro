"use strict";

const adminDashboardState = {
  isLoading: false,
};

const elements = {
  loading: document.getElementById("adminLoading"),
  error: document.getElementById("adminError"),
  errorMessage: document.getElementById("adminErrorMessage"),
  retryButton: document.getElementById("adminRetryButton"),
  content: document.getElementById("adminContent"),
  logoutButton: document.getElementById("adminLogoutButton"),

  totalUsers: document.getElementById("totalUsers"),
  totalAdmins: document.getElementById("totalAdmins"),
  totalActiveUsers: document.getElementById("totalActiveUsers"),

  regularUserText: document.getElementById("regularUserText"),

  usersLoggedInTodayText: document.getElementById("usersLoggedInTodayText"),

  totalAttempts: document.getElementById("totalAttempts"),

  totalQuestionsAvailable: document.getElementById("totalQuestionsAvailable"),

  totalCategories: document.getElementById("totalCategories"),
  totalXp: document.getElementById("totalXp"),

  totalAchievements: document.getElementById("totalAchievements"),

  averageAccuracy: document.getElementById("averageAccuracy"),
  highestAccuracy: document.getElementById("highestAccuracy"),
  averageQuizTime: document.getElementById("averageQuizTime"),
  totalQuestions: document.getElementById("totalQuestions"),

  correctAnswers: document.getElementById("correctAnswers"),
  wrongAnswers: document.getElementById("wrongAnswers"),

  unansweredAnswers: document.getElementById("unansweredAnswers"),

  correctProgress: document.getElementById("correctProgress"),
  wrongProgress: document.getElementById("wrongProgress"),

  unansweredProgress: document.getElementById("unansweredProgress"),

  correctProgressTrack: document.getElementById("correctProgressTrack"),

  wrongProgressTrack: document.getElementById("wrongProgressTrack"),

  unansweredProgressTrack: document.getElementById("unansweredProgressTrack"),

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

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getNumber(value).toLocaleString("en-IN");
}

function formatDuration(secondsValue) {
  const totalSeconds = Math.max(0, Math.floor(getNumber(secondsValue)));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

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

function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value;
}

function setProgress(element, track, percentageValue) {
  const percentage = Math.min(100, Math.max(0, getNumber(percentageValue)));

  if (element) {
    element.style.width = `${percentage}%`;
  }

  if (track) {
    track.setAttribute("aria-valuenow", String(Math.round(percentage)));
  }
}

function renderOverview(data) {
  const overview = data.overview || {};
  const answers = data.answerStatistics || {};

  setText(elements.totalUsers, formatNumber(overview.totalUsers));

  setText(elements.totalAdmins, formatNumber(overview.totalAdmins));

  setText(elements.totalActiveUsers, formatNumber(overview.totalActiveUsers));

  const usersLoggedInToday = getNumber(overview.usersLoggedInToday);

  setText(
    elements.usersLoggedInTodayText,
    `${formatNumber(usersLoggedInToday)} logged in today`,
  );

  const regularUsers = getNumber(overview.totalRegularUsers);

  setText(
    elements.regularUserText,
    `${formatNumber(regularUsers)} regular ${
      regularUsers === 1 ? "user" : "users"
    }`,
  );

  setText(elements.totalAttempts, formatNumber(overview.totalQuizAttempts));

  setText(
    elements.totalQuestionsAvailable,
    formatNumber(overview.totalQuestionsAvailable),
  );

  setText(elements.totalCategories, formatNumber(overview.totalCategories));

  setText(elements.totalXp, formatNumber(overview.totalXpEarned));

  setText(
    elements.totalAchievements,
    formatNumber(overview.totalAchievementsUnlocked),
  );

  setText(elements.averageAccuracy, `${getNumber(overview.averageAccuracy)}%`);

  setText(elements.highestAccuracy, `${getNumber(overview.highestAccuracy)}%`);

  setText(
    elements.averageQuizTime,
    formatDuration(overview.averageQuizTimeSeconds),
  );

  const totalQuestions = getNumber(answers.totalQuestions);

  const correctAnswers = getNumber(answers.correctAnswers);

  const wrongAnswers = getNumber(answers.wrongAnswers);

  const unansweredAnswers = getNumber(answers.unansweredQuestions);

  setText(elements.totalQuestions, formatNumber(totalQuestions));

  setText(elements.correctAnswers, formatNumber(correctAnswers));

  setText(elements.wrongAnswers, formatNumber(wrongAnswers));

  setText(elements.unansweredAnswers, formatNumber(unansweredAnswers));

  const correctPercentage =
    totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

  const wrongPercentage =
    totalQuestions > 0 ? (wrongAnswers / totalQuestions) * 100 : 0;

  const unansweredPercentage =
    totalQuestions > 0 ? (unansweredAnswers / totalQuestions) * 100 : 0;

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

function renderCategories(categories) {
  if (!elements.categoryGrid) {
    return;
  }

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
        <span class="category-icon" aria-hidden="true">
          📚
        </span>

        <strong>
          ${escapeHtml(category.category || "Unknown")}
        </strong>
      </div>

      <div class="category-metrics">
        <div>
          <span>Attempts</span>

          <strong>
            ${formatNumber(category.attempts)}
          </strong>
        </div>

        <div>
          <span>Accuracy</span>

          <strong>
            ${getNumber(category.averageAccuracy)}%
          </strong>
        </div>

        <div>
          <span>XP Earned</span>

          <strong>
            ${formatNumber(category.totalXpEarned)}
          </strong>
        </div>
      </div>
    `;

    fragment.appendChild(card);
  });

  elements.categoryGrid.appendChild(fragment);
}

function createAvatarContent(user, fullName) {
  const initial = fullName.charAt(0).toUpperCase() || "U";

  if (!user.avatar) {
    return `
      <span class="row-avatar">
        ${escapeHtml(initial)}
      </span>
    `;
  }

  return `
    <span
      class="row-avatar has-image"
      style="background-image: url('${escapeHtml(user.avatar)}')"
      role="img"
      aria-label="${escapeHtml(fullName)} profile picture"
    ></span>
  `;
}

function renderRecentUsers(users) {
  if (!elements.recentUsersList) {
    return;
  }

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

    const avatarContent = createAvatarContent(user, fullName);

    const statusText = user.isActive ? "Active" : "Inactive";

    const statusClass = user.isActive ? "status-active" : "status-inactive";

    row.innerHTML = `
      <div class="user-cell">
        ${avatarContent}

        <div>
          <strong>
            ${escapeHtml(fullName)}
          </strong>

          <small>
            ${escapeHtml(user.email || "")}
          </small>
        </div>
      </div>

      <div class="row-meta">
        <span
          class="role-badge ${user.role === "admin" ? "admin" : ""}"
        >
          ${escapeHtml(user.role || "user")}
        </span>

        <span class="user-status ${statusClass}">
          ${statusText}
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
  if (!elements.recentAttemptsList) {
    return;
  }

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
    const row = document.createElement("a");

    row.className = "table-row attempt-row";

    row.href = attempt._id
      ? `/result/${encodeURIComponent(attempt._id)}`
      : "/admin/attempts";

    const userName = attempt.user
      ? `${attempt.user.firstName || ""} ${attempt.user.lastName || ""}`.trim()
      : "Deleted User";

    const accuracy = getNumber(attempt.accuracy);

    const accuracyClass =
      accuracy >= 80
        ? "accuracy-good"
        : accuracy >= 60
          ? "accuracy-average"
          : "accuracy-low";

    row.innerHTML = `
      <div>
        <strong>
          ${escapeHtml(userName || "Unknown User")}
        </strong>

        <small>
          ${escapeHtml(attempt.category || "Unknown Category")}
          •
          ${formatNumber(attempt.score)} /
          ${formatNumber(attempt.totalQuestions)}
          •
          +${formatNumber(attempt.xpEarned)} XP
        </small>
      </div>

      <div class="row-meta">
        <strong class="accuracy-text ${accuracyClass}">
          ${accuracy}%
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

  const attemptValues = daily.map((item) => getNumber(item.attempts));

  const xpValues = daily.map((item) => getNumber(item.xpEarned));

  const userValues = daily.map((item) => getNumber(item.newUsers));

  const weeklyAttempts = attemptValues.reduce(
    (total, value) => total + value,
    0,
  );

  const weeklyXp = xpValues.reduce((total, value) => total + value, 0);

  const weeklyUsers = userValues.reduce((total, value) => total + value, 0);

  setText(elements.weeklyAttemptTotal, formatNumber(weeklyAttempts));

  setText(elements.weeklyXpTotal, `${formatNumber(weeklyXp)} XP`);

  setText(elements.weeklyUserTotal, formatNumber(weeklyUsers));

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
    categories.map((category) => getNumber(category.attempts)),
  );

  window.AdminCharts.drawBarChart(
    "accuracyDistributionChart",
    accuracyDistribution.map((item) => item.label),
    accuracyDistribution.map((item) => getNumber(item.count)),
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
   * Canvas dimensions are calculated correctly only after
   * the dashboard content becomes visible.
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
  setText(
    elements.errorMessage,
    message || "Unable to load administrator dashboard.",
  );

  toggleElement(elements.loading, false);
  toggleElement(elements.error, true);
  toggleElement(elements.content, false);
}

function showDashboardContent() {
  toggleElement(elements.loading, false);
  toggleElement(elements.error, false);
  toggleElement(elements.content, true);
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "The server returned an invalid administrator dashboard response.",
    );
  }

  return response.json();
}

async function loadAdminDashboard(options = {}) {
  if (adminDashboardState.isLoading) {
    return;
  }

  const silent = Boolean(options.silent);

  adminDashboardState.isLoading = true;

  /*
   * Show the full loading screen only during the initial load
   * or when the user manually retries.
   */
  if (!silent || !adminDashboardState.hasLoadedOnce) {
    showLoading();
  }

  try {
    const response = await fetch("/api/admin/dashboard", {
      method: "GET",
      credentials: "include",
      cache: "no-store",

      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load administrator dashboard.",
      );
    }

    /*
     * Make the content visible before drawing canvas charts.
     */
    showDashboardContent();

    renderDashboard(data);

    adminDashboardState.hasLoadedOnce = true;
  } catch (error) {
    console.error("Admin dashboard error:", error);

    /*
     * During a silent refresh, keep already loaded content visible.
     */
    if (silent && adminDashboardState.hasLoadedOnce) {
      return;
    }

    showError(error.message || "Unable to load administrator dashboard.");
  } finally {
    adminDashboardState.isLoading = false;
  }
}

function renderDashboardDate() {
  if (!elements.dashboardDate) {
    return;
  }

  const now = new Date();

  elements.dashboardDate.textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

function startAutoRefresh() {
  stopAutoRefresh();

  adminDashboardState.refreshTimer = window.setInterval(() => {
    if (
      document.visibilityState === "visible" &&
      adminDashboardState.hasLoadedOnce &&
      !adminDashboardState.isLoading
    ) {
      loadAdminDashboard({
        silent: true,
      });
    }
  }, adminDashboardState.refreshIntervalMs);
}

function stopAutoRefresh() {
  if (!adminDashboardState.refreshTimer) {
    return;
  }

  window.clearInterval(adminDashboardState.refreshTimer);

  adminDashboardState.refreshTimer = null;
}

async function logoutAdmin() {
  if (elements.logoutButton) {
    elements.logoutButton.disabled = true;
    elements.logoutButton.textContent = "Logging out...";
  }

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Unable to log out.");
    }

    stopAutoRefresh();

    window.location.href = "/login";
  } catch (error) {
    console.error("Admin logout error:", error);

    alert(error.message || "Unable to log out.");

    if (elements.logoutButton) {
      elements.logoutButton.disabled = false;
      elements.logoutButton.textContent = "Logout";
    }
  }
}

function initializeAdminDashboard() {
  elements.retryButton?.addEventListener("click", () => {
    loadAdminDashboard({
      silent: false,
    });
  });

  elements.logoutButton?.addEventListener("click", logoutAdmin);

  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      adminDashboardState.hasLoadedOnce
    ) {
      renderDashboardDate();

      loadAdminDashboard({
        silent: true,
      });
    }
  });

  window.addEventListener("beforeunload", stopAutoRefresh);

  renderDashboardDate();

  loadAdminDashboard({
    silent: false,
  }).then(() => {
    startAutoRefresh();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAdminDashboard, {
    once: true,
  });
} else {
  initializeAdminDashboard();
}
