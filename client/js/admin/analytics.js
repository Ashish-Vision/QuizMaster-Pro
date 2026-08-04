"use strict";

const state = {
  isLoading: false,
  selectedDays: 30,
};

const elements = {
  loading: document.getElementById("analyticsLoadingState"),
  error: document.getElementById("analyticsErrorState"),
  errorMessage: document.getElementById("analyticsErrorMessage"),
  retryButton: document.getElementById("retryAnalyticsButton"),
  content: document.getElementById("analyticsContent"),

  periodFilter: document.getElementById("analyticsPeriodFilter"),
  refreshButton: document.getElementById("refreshAnalyticsButton"),
  printButton: document.getElementById("printAnalyticsButton"),

  generatedAt: document.getElementById("analyticsGeneratedAt"),
  updatedText: document.getElementById("analyticsUpdatedText"),
  periodText: document.getElementById("analyticsPeriodText"),

  totalUsers: document.getElementById("totalUsers"),
  activeUsersText: document.getElementById("activeUsersText"),

  totalQuestions: document.getElementById("totalQuestions"),
  activeQuestionsText: document.getElementById("activeQuestionsText"),

  totalAttempts: document.getElementById("totalAttempts"),
  totalXpEarned: document.getElementById("totalXpEarned"),
  averageAccuracy: document.getElementById("averageAccuracy"),
  averageQuizTime: document.getElementById("averageQuizTime"),
  totalCategories: document.getElementById("totalCategories"),
  perfectScores: document.getElementById("perfectScores"),

  periodAttemptTotal: document.getElementById("periodAttemptTotal"),
  periodXpTotal: document.getElementById("periodXpTotal"),
  periodUserTotal: document.getElementById("periodUserTotal"),

  correctAnswers: document.getElementById("correctAnswers"),
  wrongAnswers: document.getElementById("wrongAnswers"),
  unansweredAnswers: document.getElementById("unansweredAnswers"),

  correctAnswersProgress: document.getElementById("correctAnswersProgress"),

  wrongAnswersProgress: document.getElementById("wrongAnswersProgress"),

  unansweredAnswersProgress: document.getElementById(
    "unansweredAnswersProgress",
  ),

  categoryGrid: document.getElementById("categoryAnalyticsGrid"),
  topUsersList: document.getElementById("topUsersList"),
  recentAttemptsGrid: document.getElementById("recentAttemptsGrid"),
};

function showElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value;
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

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function getInitials(user) {
  if (!user) {
    return "U";
  }

  const firstInitial = String(user.firstName || "")
    .charAt(0)
    .toUpperCase();

  const lastInitial = String(user.lastName || "")
    .charAt(0)
    .toUpperCase();

  return `${firstInitial}${lastInitial}` || "U";
}

function createAvatarMarkup(user, className) {
  const fullName =
    user?.fullName ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Unknown User";

  if (user?.avatar) {
    return `
      <div
        class="${className} has-image"
        style="background-image: url('${escapeHtml(user.avatar)}')"
        role="img"
        aria-label="${escapeHtml(fullName)} profile picture"
      ></div>
    `;
  }

  return `
    <div class="${className}">
      ${escapeHtml(getInitials(user))}
    </div>
  `;
}

function showLoading() {
  showElement(elements.loading, true);
  showElement(elements.error, false);
  showElement(elements.content, false);
}

function showError(message) {
  setText(
    elements.errorMessage,
    message || "Unable to load administrator analytics.",
  );

  showElement(elements.loading, false);
  showElement(elements.error, true);
  showElement(elements.content, false);
}

function showContent() {
  showElement(elements.loading, false);
  showElement(elements.error, false);
  showElement(elements.content, true);
}

function renderOverview(data) {
  const overview = data.overview || {};

  setText(elements.totalUsers, formatNumber(overview.totalUsers));

  setText(
    elements.activeUsersText,
    `${formatNumber(overview.totalActiveUsers)} active users`,
  );

  setText(elements.totalQuestions, formatNumber(overview.totalQuestions));

  setText(
    elements.activeQuestionsText,
    `${formatNumber(overview.totalActiveQuestions)} active questions`,
  );

  setText(elements.totalAttempts, formatNumber(overview.totalAttempts));

  setText(elements.totalXpEarned, formatNumber(overview.totalXpEarned));

  setText(elements.averageAccuracy, `${getNumber(overview.averageAccuracy)}%`);

  setText(
    elements.averageQuizTime,
    formatDuration(overview.averageTimeTakenSeconds),
  );

  setText(elements.totalCategories, formatNumber(overview.totalCategories));

  setText(elements.perfectScores, formatNumber(overview.perfectScores));
}

function renderAnswerStatistics(data) {
  const answers = data.answerStatistics || {};

  const correct = getNumber(answers.correctAnswers);
  const wrong = getNumber(answers.wrongAnswers);
  const unanswered = getNumber(answers.unansweredQuestions);

  const total = correct + wrong + unanswered;

  const correctPercentage = total > 0 ? (correct / total) * 100 : 0;

  const wrongPercentage = total > 0 ? (wrong / total) * 100 : 0;

  const unansweredPercentage = total > 0 ? (unanswered / total) * 100 : 0;

  setText(elements.correctAnswers, formatNumber(correct));
  setText(elements.wrongAnswers, formatNumber(wrong));
  setText(elements.unansweredAnswers, formatNumber(unanswered));

  if (elements.correctAnswersProgress) {
    elements.correctAnswersProgress.style.width = `${correctPercentage}%`;
  }

  if (elements.wrongAnswersProgress) {
    elements.wrongAnswersProgress.style.width = `${wrongPercentage}%`;
  }

  if (elements.unansweredAnswersProgress) {
    elements.unansweredAnswersProgress.style.width = `${unansweredPercentage}%`;
  }
}

function renderCategoryAnalytics(categories) {
  if (!elements.categoryGrid) {
    return;
  }

  elements.categoryGrid.innerHTML = "";

  if (!Array.isArray(categories) || categories.length === 0) {
    elements.categoryGrid.innerHTML = `
      <div class="empty-state">
        No category analytics are available yet.
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  categories.forEach((category) => {
    const card = document.createElement("article");

    card.className = "category-card";

    const totalAnswers =
      getNumber(category.totalCorrectAnswers) +
      getNumber(category.totalWrongAnswers);

    const correctPercentage =
      totalAnswers > 0
        ? (getNumber(category.totalCorrectAnswers) / totalAnswers) * 100
        : 0;

    card.innerHTML = `
      <div class="category-card-header">
        <span class="category-icon">📚</span>

        <div>
          <strong>${escapeHtml(category.category || "Unknown")}</strong>
          <small>${formatNumber(category.attempts)} attempts</small>
        </div>
      </div>

      <div class="category-stat-grid">
        <div>
          <span>Accuracy</span>
          <strong>${getNumber(category.averageAccuracy)}%</strong>
        </div>

        <div>
          <span>XP Earned</span>
          <strong>${formatNumber(category.totalXpEarned)}</strong>
        </div>

        <div>
          <span>Average Time</span>
          <strong>${formatDuration(category.averageTimeTakenSeconds)}</strong>
        </div>
      </div>

      <div class="category-progress-track">
        <div
          class="category-progress-fill"
          style="width: ${Math.min(100, correctPercentage)}%"
        ></div>
      </div>
    `;

    fragment.appendChild(card);
  });

  elements.categoryGrid.appendChild(fragment);
}

function renderTopUsers(users) {
  if (!elements.topUsersList) {
    return;
  }

  elements.topUsersList.innerHTML = "";

  if (!Array.isArray(users) || users.length === 0) {
    elements.topUsersList.innerHTML = `
      <div class="empty-state">
        No user performance records are available yet.
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  users.forEach((user, index) => {
    const row = document.createElement("article");

    row.className = "top-user-row";

    const avatarMarkup = createAvatarMarkup(user, "analytics-avatar");

    const statusClass = user.isActive ? "status-active" : "status-disabled";

    const statusText = user.isActive ? "Active" : "Disabled";

    row.innerHTML = `
      <strong class="rank-number">
        ${index + 1}
      </strong>

      <div class="top-user-identity">
        ${avatarMarkup}

        <div>
          <strong>${escapeHtml(user.fullName || "Unknown User")}</strong>
          <small>${escapeHtml(user.email || "")}</small>
        </div>
      </div>

      <strong>${formatNumber(user.totalXp)} XP</strong>

      <span>${formatNumber(user.quizzesCompleted)}</span>

      <span>${formatNumber(user.correctAnswers)}</span>

      <span class="status-badge ${statusClass}">
        ${statusText}
      </span>
    `;

    fragment.appendChild(row);
  });

  elements.topUsersList.appendChild(fragment);
}

function renderRecentAttempts(attempts) {
  if (!elements.recentAttemptsGrid) {
    return;
  }

  elements.recentAttemptsGrid.innerHTML = "";

  if (!Array.isArray(attempts) || attempts.length === 0) {
    elements.recentAttemptsGrid.innerHTML = `
      <div class="empty-state">
        No recent quiz attempts are available.
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  attempts.forEach((attempt) => {
    const card = document.createElement("article");

    card.className = "recent-attempt-card";

    const avatarMarkup = createAvatarMarkup(attempt.user, "attempt-avatar");

    const accuracy = getNumber(attempt.accuracy);

    const accuracyClass =
      accuracy >= 80 ? "high" : accuracy >= 60 ? "medium" : "low";

    card.innerHTML = `
      <div class="recent-attempt-user">
        ${avatarMarkup}

        <div>
          <strong>
            ${escapeHtml(attempt.user?.fullName || "Unknown User")}
          </strong>

          <small>
            ${escapeHtml(attempt.user?.email || "")}
          </small>
        </div>
      </div>

      <div class="recent-attempt-main">
        <span>${escapeHtml(attempt.category || "Unknown")}</span>

        <strong>
          ${formatNumber(attempt.score)}
          /
          ${formatNumber(attempt.totalQuestions)}
        </strong>
      </div>

      <div class="recent-attempt-meta">
        <span class="accuracy-badge ${accuracyClass}">
          ${accuracy}%
        </span>

        <span>+${formatNumber(attempt.xpEarned)} XP</span>

        <span>${formatDuration(attempt.timeTakenSeconds)}</span>
      </div>

      <small class="recent-attempt-date">
        ${formatDateTime(attempt.completedAt)}
      </small>
    `;

    fragment.appendChild(card);
  });

  elements.recentAttemptsGrid.appendChild(fragment);
}

function renderCharts(data) {
  if (!window.AdminCharts) {
    console.warn("Admin chart helper is not available.");
    return;
  }

  const dailyTrends = Array.isArray(data.dailyTrends) ? data.dailyTrends : [];

  const categories = Array.isArray(data.categoryStatistics)
    ? data.categoryStatistics
    : [];

  const difficulties = Array.isArray(data.difficultyStatistics)
    ? data.difficultyStatistics
    : [];

  const accuracyDistribution = Array.isArray(data.accuracyDistribution)
    ? data.accuracyDistribution
    : [];

  const labels = dailyTrends.map((item) => item.label);

  const attempts = dailyTrends.map((item) => getNumber(item.attempts));

  const xp = dailyTrends.map((item) => getNumber(item.xpEarned));

  const users = dailyTrends.map((item) => getNumber(item.newUsers));

  setText(
    elements.periodAttemptTotal,
    `${formatNumber(attempts.reduce((sum, value) => sum + value, 0))} attempts`,
  );

  setText(
    elements.periodXpTotal,
    `${formatNumber(xp.reduce((sum, value) => sum + value, 0))} XP`,
  );

  setText(
    elements.periodUserTotal,
    `${formatNumber(users.reduce((sum, value) => sum + value, 0))} users`,
  );

  window.AdminCharts.drawLineChart("attemptsTrendChart", labels, attempts);

  window.AdminCharts.drawLineChart("xpTrendChart", labels, xp, {
    color: "#f3b84a",
  });

  window.AdminCharts.drawLineChart("usersTrendChart", labels, users, {
    color: "#2ed3a7",
  });

  window.AdminCharts.drawBarChart(
    "categoryDistributionChart",
    categories.map((item) => item.category),
    categories.map((item) => getNumber(item.attempts)),
  );

  window.AdminCharts.drawBarChart(
    "difficultyDistributionChart",
    difficulties.map((item) => item.label),
    difficulties.map((item) => getNumber(item.count)),
    {
      color: "#7657ff",
    },
  );

  window.AdminCharts.drawBarChart(
    "accuracyDistributionChart",
    accuracyDistribution.map((item) => item.label),
    accuracyDistribution.map((item) => getNumber(item.count)),
    {
      color: "#16c4df",
    },
  );
}

function renderAnalytics(data) {
  renderOverview(data);
  renderAnswerStatistics(data);
  renderCategoryAnalytics(data.categoryStatistics);
  renderTopUsers(data.topUsers);
  renderRecentAttempts(data.recentAttempts);

  setText(
    elements.generatedAt,
    `Generated ${formatDateTime(data.generatedAt)}`,
  );

  setText(
    elements.updatedText,
    `Analytics last updated: ${formatDateTime(data.generatedAt)}`,
  );

  setText(elements.periodText, `Last ${getNumber(data.period?.days)} days`);

  showContent();

  window.requestAnimationFrame(() => {
    renderCharts(data);
  });
}

async function loadAnalytics() {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;

  showLoading();

  try {
    const response = await fetch(
      `/api/admin/analytics?days=${state.selectedDays}`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",

        headers: {
          Accept: "application/json",
        },
      },
    );

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error("The server returned an invalid analytics response.");
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load administrator analytics.",
      );
    }

    renderAnalytics(data);
  } catch (error) {
    console.error("Admin analytics error:", error);

    showError(error.message || "Unable to load administrator analytics.");
  } finally {
    state.isLoading = false;
  }
}

function initializeAnalytics() {
  state.selectedDays = getNumber(elements.periodFilter?.value) || 30;

  elements.periodFilter?.addEventListener("change", () => {
    state.selectedDays = getNumber(elements.periodFilter.value) || 30;

    loadAnalytics();
  });

  elements.refreshButton?.addEventListener("click", loadAnalytics);

  elements.retryButton?.addEventListener("click", loadAnalytics);

  elements.printButton?.addEventListener("click", () => {
    window.print();
  });

  loadAnalytics();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAnalytics, {
    once: true,
  });
} else {
  initializeAnalytics();
}
