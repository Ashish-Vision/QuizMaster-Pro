"use strict";

const elements = {
  categoryFilter: document.getElementById("categoryFilter"),

  refreshButton: document.getElementById("refreshButton"),

  logoutButton: document.getElementById("logoutButton"),

  loadingState: document.getElementById("loadingState"),

  errorState: document.getElementById("errorState"),

  errorMessage: document.getElementById("errorMessage"),

  retryButton: document.getElementById("retryButton"),

  emptyState: document.getElementById("emptyState"),

  historyContent: document.getElementById("historyContent"),

  historyList: document.getElementById("historyList"),

  totalAttemptsValue: document.getElementById("totalAttemptsValue"),

  currentPageValue: document.getElementById("currentPageValue"),

  totalPagesValue: document.getElementById("totalPagesValue"),

  previousButton: document.getElementById("previousButton"),

  nextButton: document.getElementById("nextButton"),

  paginationText: document.getElementById("paginationText"),
};

const state = {
  currentPage: 1,
  totalPages: 1,
  selectedCategory: "all",
  categoriesLoaded: false,
};

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(getNumber(totalSeconds)));

  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPerformanceClass(accuracy) {
  const value = getNumber(accuracy);

  if (value >= 80) {
    return "excellent";
  }

  if (value >= 60) {
    return "good";
  }

  return "needs-improvement";
}

function showLoading() {
  elements.loadingState?.classList.remove("hidden");
  elements.errorState?.classList.add("hidden");
  elements.emptyState?.classList.add("hidden");
  elements.historyContent?.classList.add("hidden");
}

function showError(message) {
  elements.loadingState?.classList.add("hidden");
  elements.emptyState?.classList.add("hidden");
  elements.historyContent?.classList.add("hidden");
  elements.errorState?.classList.remove("hidden");

  if (elements.errorMessage) {
    elements.errorMessage.textContent = message || "Please try again.";
  }
}

function showEmpty() {
  elements.loadingState?.classList.add("hidden");
  elements.errorState?.classList.add("hidden");
  elements.historyContent?.classList.add("hidden");
  elements.emptyState?.classList.remove("hidden");
}

function showHistory() {
  elements.loadingState?.classList.add("hidden");
  elements.errorState?.classList.add("hidden");
  elements.emptyState?.classList.add("hidden");
  elements.historyContent?.classList.remove("hidden");
}

function createStat(label, value, className = "") {
  const item = document.createElement("div");

  item.className = `attempt-stat ${className}`.trim();

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.textContent = value;

  item.append(labelElement, valueElement);

  return item;
}

function createHistoryCard(attempt) {
  const card = document.createElement("article");

  card.className = "history-card";

  const header = document.createElement("div");
  header.className = "attempt-header";

  const titleSection = document.createElement("div");

  const category = document.createElement("h2");
  category.textContent = attempt.category || "Unknown Category";

  const completedAt = document.createElement("p");
  completedAt.textContent = formatDate(attempt.completedAt);

  titleSection.append(category, completedAt);

  const accuracyBadge = document.createElement("span");

  accuracyBadge.className = `accuracy-badge ${getPerformanceClass(
    attempt.accuracy,
  )}`;

  accuracyBadge.textContent = `${getNumber(attempt.accuracy)}% accuracy`;

  header.append(titleSection, accuracyBadge);

  const scoreSection = document.createElement("div");
  scoreSection.className = "attempt-score";

  const score = document.createElement("strong");
  score.textContent = `${getNumber(attempt.score)} / ${getNumber(
    attempt.totalQuestions,
  )}`;

  const scoreLabel = document.createElement("span");
  scoreLabel.textContent = "Final score";

  scoreSection.append(score, scoreLabel);

  const stats = document.createElement("div");
  stats.className = "attempt-stats";

  stats.append(
    createStat("Correct", getNumber(attempt.correctAnswers), "correct-stat"),

    createStat("Wrong", getNumber(attempt.wrongAnswers), "wrong-stat"),

    createStat("Unanswered", getNumber(attempt.unansweredQuestions)),

    createStat("XP Earned", `+${getNumber(attempt.xpEarned)} XP`, "xp-stat"),

    createStat("Time Taken", formatTime(attempt.timeTakenSeconds)),
  );

  const footer = document.createElement("div");
  footer.className = "attempt-footer";

  const attemptedText = document.createElement("span");

  attemptedText.textContent = `${getNumber(
    attempt.attemptedQuestions,
  )} questions attempted`;

  const resultLink = document.createElement("a");

  resultLink.className = "view-result-button";
  resultLink.href = `/result/${attempt._id}`;
  resultLink.textContent = "View Result →";

  footer.append(attemptedText, resultLink);

  card.append(header, scoreSection, stats, footer);

  return card;
}

function renderHistory(history) {
  if (!elements.historyList) {
    return;
  }

  elements.historyList.innerHTML = "";

  history.forEach((attempt) => {
    elements.historyList.appendChild(createHistoryCard(attempt));
  });
}

function renderCategories(categories) {
  if (!elements.categoryFilter || state.categoriesLoaded) {
    return;
  }

  categories.forEach((category) => {
    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    elements.categoryFilter.appendChild(option);
  });

  state.categoriesLoaded = true;
}

function renderPagination(pagination) {
  state.currentPage = getNumber(pagination.currentPage) || 1;

  state.totalPages = getNumber(pagination.totalPages) || 1;

  if (elements.totalAttemptsValue) {
    elements.totalAttemptsValue.textContent = getNumber(
      pagination.totalAttempts,
    );
  }

  if (elements.currentPageValue) {
    elements.currentPageValue.textContent = state.currentPage;
  }

  if (elements.totalPagesValue) {
    elements.totalPagesValue.textContent = state.totalPages;
  }

  if (elements.paginationText) {
    elements.paginationText.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
  }

  if (elements.previousButton) {
    elements.previousButton.disabled = !pagination.hasPreviousPage;
  }

  if (elements.nextButton) {
    elements.nextButton.disabled = !pagination.hasNextPage;
  }
}

async function loadHistory() {
  showLoading();

  try {
    const query = new URLSearchParams({
      page: String(state.currentPage),
      limit: "10",
    });

    if (state.selectedCategory && state.selectedCategory !== "all") {
      query.set("category", state.selectedCategory);
    }

    const response = await fetch(`/api/history?${query.toString()}`, {
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
      throw new Error(data.message || "Unable to load quiz history.");
    }

    if (!Array.isArray(data.history)) {
      throw new Error("The quiz history response is invalid.");
    }

    renderCategories(data.categories || []);
    renderPagination(data.pagination || {});

    if (data.history.length === 0) {
      showEmpty();
      return;
    }

    renderHistory(data.history);
    showHistory();
  } catch (error) {
    console.error("History loading error:", error);

    showError(error.message || "An unexpected error occurred.");
  }
}

async function logout() {
  if (!elements.logoutButton) {
    return;
  }

  elements.logoutButton.disabled = true;
  elements.logoutButton.textContent = "Logging out...";

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Logout failed.");
    }

    localStorage.removeItem("quizmaster_user");

    window.location.href = "/login";
  } catch (error) {
    alert(error.message || "Unable to log out. Please try again.");

    elements.logoutButton.disabled = false;
    elements.logoutButton.textContent = "Logout";
  }
}

function initializeHistory() {
  elements.categoryFilter?.addEventListener("change", () => {
    state.selectedCategory = elements.categoryFilter.value;

    state.currentPage = 1;

    loadHistory();
  });

  elements.refreshButton?.addEventListener("click", loadHistory);

  elements.retryButton?.addEventListener("click", loadHistory);

  elements.previousButton?.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      loadHistory();
    }
  });

  elements.nextButton?.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) {
      state.currentPage += 1;
      loadHistory();
    }
  });

  elements.logoutButton?.addEventListener("click", logout);

  loadHistory();
}

document.addEventListener("DOMContentLoaded", initializeHistory);
