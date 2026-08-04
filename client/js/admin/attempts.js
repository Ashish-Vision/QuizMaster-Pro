"use strict";

const state = {
  attempts: [],
  categories: [],
  users: [],
  currentPage: 1,
  totalPages: 1,
  limit: 10,
  search: "",
  category: "all",
  userId: "all",
  sort: "newest",
  selectedAttempt: null,
  searchTimeout: null,
};

const elements = {
  loadingState: document.getElementById("attemptsLoadingState"),
  errorState: document.getElementById("attemptsErrorState"),
  errorMessage: document.getElementById("attemptsErrorMessage"),
  emptyState: document.getElementById("attemptsEmptyState"),
  content: document.getElementById("attemptsContent"),
  attemptsList: document.getElementById("attemptsList"),

  retryButton: document.getElementById("retryAttemptsButton"),
  refreshButton: document.getElementById("refreshAttemptsButton"),

  searchInput: document.getElementById("attemptSearchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  userFilter: document.getElementById("userFilter"),
  sortFilter: document.getElementById("sortFilter"),

  totalAttemptsCount: document.getElementById("totalAttemptsCount"),
  totalXpCount: document.getElementById("totalXpCount"),
  averageAccuracyCount: document.getElementById("averageAccuracyCount"),
  perfectScoresCount: document.getElementById("perfectScoresCount"),

  previousPageButton: document.getElementById("previousPageButton"),
  nextPageButton: document.getElementById("nextPageButton"),
  paginationText: document.getElementById("paginationText"),

  detailsModal: document.getElementById("attemptDetailsModal"),
  detailsLoading: document.getElementById("attemptDetailsLoading"),
  detailsContent: document.getElementById("attemptDetailsContent"),

  detailsAvatar: document.getElementById("detailsAvatar"),
  detailsUserName: document.getElementById("detailsUserName"),
  detailsUserEmail: document.getElementById("detailsUserEmail"),
  detailsCategory: document.getElementById("detailsCategory"),
  detailsScore: document.getElementById("detailsScore"),
  detailsAccuracy: document.getElementById("detailsAccuracy"),
  detailsXp: document.getElementById("detailsXp"),
  detailsTime: document.getElementById("detailsTime"),
  detailsCompletedAt: document.getElementById("detailsCompletedAt"),
  answerCountText: document.getElementById("answerCountText"),
  answerReviewList: document.getElementById("answerReviewList"),

  deleteModal: document.getElementById("deleteAttemptModal"),
  deleteDescription: document.getElementById("deleteAttemptDescription"),
  deleteMessage: document.getElementById("deleteAttemptMessage"),
  confirmDeleteButton: document.getElementById("confirmDeleteAttemptButton"),
};

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(secondsValue) {
  const totalSeconds = Math.max(0, Number(secondsValue) || 0);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${minutes}m ${seconds}s`;
}

function getInitials(user) {
  if (!user) {
    return "U";
  }

  const first = user.firstName?.charAt(0) || "";
  const last = user.lastName?.charAt(0) || "";

  return `${first}${last}`.toUpperCase() || "U";
}

function createAvatarMarkup(user, className) {
  const name = user?.fullName || "User";

  if (user?.avatar) {
    return `
      <div
        class="${className} has-image"
        style="background-image: url('${escapeHtml(user.avatar)}')"
        role="img"
        aria-label="${escapeHtml(name)} profile picture"
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
  toggleElement(elements.loadingState, true);
  toggleElement(elements.errorState, false);
  toggleElement(elements.emptyState, false);
  toggleElement(elements.content, false);
}

function showError(message) {
  elements.errorMessage.textContent = message || "Unable to load attempts.";

  toggleElement(elements.loadingState, false);
  toggleElement(elements.errorState, true);
  toggleElement(elements.emptyState, false);
  toggleElement(elements.content, false);
}

function showEmpty() {
  toggleElement(elements.loadingState, false);
  toggleElement(elements.errorState, false);
  toggleElement(elements.emptyState, true);
  toggleElement(elements.content, false);
}

function showContent() {
  toggleElement(elements.loadingState, false);
  toggleElement(elements.errorState, false);
  toggleElement(elements.emptyState, false);
  toggleElement(elements.content, true);
}

function renderSummary(summary) {
  elements.totalAttemptsCount.textContent = Number(summary.totalAttempts) || 0;

  elements.totalXpCount.textContent = Number(summary.totalXpEarned) || 0;

  elements.averageAccuracyCount.textContent = `${Number(summary.averageAccuracy) || 0}%`;

  elements.perfectScoresCount.textContent = Number(summary.perfectScores) || 0;
}

function renderFilters(categories, users) {
  const currentCategory = elements.categoryFilter.value || "all";
  const currentUser = elements.userFilter.value || "all";

  elements.categoryFilter.innerHTML = `
    <option value="all">All categories</option>
  `;

  categories.forEach((category) => {
    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    elements.categoryFilter.appendChild(option);
  });

  elements.userFilter.innerHTML = `
    <option value="all">All users</option>
  `;

  users.forEach((user) => {
    const option = document.createElement("option");

    option.value = user.id;
    option.textContent = `${user.fullName} — ${user.email}`;

    elements.userFilter.appendChild(option);
  });

  elements.categoryFilter.value = categories.includes(currentCategory)
    ? currentCategory
    : "all";

  elements.userFilter.value = users.some(
    (user) => String(user.id) === String(currentUser),
  )
    ? currentUser
    : "all";
}

function createAttemptRow(attempt) {
  const row = document.createElement("article");

  row.className = "attempt-row";

  const userName = attempt.user?.fullName || "Deleted User";
  const userEmail = attempt.user?.email || "No email";
  const avatarMarkup = createAvatarMarkup(attempt.user, "attempt-avatar");

  row.innerHTML = `
    <div class="attempt-user">
      ${avatarMarkup}

      <div>
        <strong>${escapeHtml(userName)}</strong>
        <span>${escapeHtml(userEmail)}</span>
      </div>
    </div>

    <div>
      <span class="category-badge">
        ${escapeHtml(attempt.category)}
      </span>
    </div>

    <div class="score-cell">
      <strong>
        ${Number(attempt.score) || 0} /
        ${Number(attempt.totalQuestions) || 0}
      </strong>

      <span>
        ${Number(attempt.correctAnswers) || 0} correct
      </span>
    </div>

    <div>
      <span class="accuracy-badge">
        ${Number(attempt.accuracy) || 0}%
      </span>
    </div>

    <div class="xp-cell">
      ${Number(attempt.xpEarned) || 0} XP
    </div>

    <div class="date-cell">
      ${formatDate(attempt.completedAt)}
    </div>

    <div class="attempt-actions">
      <button
        type="button"
        class="action-button view-button"
        data-action="view"
        data-attempt-id="${attempt.id}"
      >
        View
      </button>

      <button
        type="button"
        class="action-button delete-button"
        data-action="delete"
        data-attempt-id="${attempt.id}"
      >
        Delete
      </button>
    </div>
  `;

  return row;
}

function renderAttempts(attempts) {
  elements.attemptsList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  attempts.forEach((attempt) => {
    fragment.appendChild(createAttemptRow(attempt));
  });

  elements.attemptsList.appendChild(fragment);
}

function renderPagination(pagination) {
  state.currentPage = Number(pagination.currentPage) || 1;

  state.totalPages = Number(pagination.totalPages) || 1;

  elements.paginationText.textContent = `Page ${state.currentPage} of ${state.totalPages}`;

  elements.previousPageButton.disabled = !pagination.hasPreviousPage;

  elements.nextPageButton.disabled = !pagination.hasNextPage;
}

function buildQuery() {
  const query = new URLSearchParams({
    page: String(state.currentPage),
    limit: String(state.limit),
    sort: state.sort,
  });

  if (state.search) {
    query.set("search", state.search);
  }

  if (state.category !== "all") {
    query.set("category", state.category);
  }

  if (state.userId !== "all") {
    query.set("userId", state.userId);
  }

  return query;
}

async function loadAttempts() {
  showLoading();

  try {
    const query = buildQuery();

    const response = await fetch(`/api/admin/attempts?${query.toString()}`, {
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
      throw new Error(data.message || "Unable to load attempts.");
    }

    state.attempts = Array.isArray(data.attempts) ? data.attempts : [];

    state.categories = Array.isArray(data.categories) ? data.categories : [];

    state.users = Array.isArray(data.users) ? data.users : [];

    renderSummary(data.summary || {});
    renderFilters(state.categories, state.users);
    renderPagination(data.pagination || {});

    if (state.attempts.length === 0) {
      showEmpty();
      return;
    }

    renderAttempts(state.attempts);
    showContent();
  } catch (error) {
    console.error("Attempt loading error:", error);
    showError(error.message);
  }
}

function findAttempt(attemptId) {
  return state.attempts.find(
    (attempt) => String(attempt.id) === String(attemptId),
  );
}

function openModal(modal) {
  toggleElement(modal, true);
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  toggleElement(modal, false);
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function createAnswerCard(answer) {
  const card = document.createElement("article");

  const statusClass = answer.isUnanswered
    ? "unanswered"
    : answer.isCorrect
      ? "correct"
      : "wrong";

  const statusText = answer.isUnanswered
    ? "Unanswered"
    : answer.isCorrect
      ? "Correct"
      : "Wrong";

  card.className = `answer-card ${statusClass}`;

  card.innerHTML = `
    <div class="answer-card-header">
      <span class="question-number">
        Question ${Number(answer.number) || 0}
      </span>

      <span class="answer-status ${statusClass}">
        ${statusText}
      </span>
    </div>

    <h4>${escapeHtml(answer.question)}</h4>

    <div class="answer-details">
      <p>
        <span>Selected answer</span>

        <strong>
          ${
            answer.selectedAnswerText
              ? escapeHtml(answer.selectedAnswerText)
              : "No answer selected"
          }
        </strong>
      </p>

      <p>
        <span>Correct answer</span>

        <strong>
          ${
            answer.correctAnswerText
              ? escapeHtml(answer.correctAnswerText)
              : "Unavailable"
          }
        </strong>
      </p>
    </div>

    ${
      answer.explanation
        ? `
          <div class="answer-explanation">
            <span>Explanation</span>
            <p>${escapeHtml(answer.explanation)}</p>
          </div>
        `
        : ""
    }
  `;

  return card;
}

async function openAttemptDetails(attemptId) {
  openModal(elements.detailsModal);

  toggleElement(elements.detailsLoading, true);
  toggleElement(elements.detailsContent, false);

  elements.detailsLoading.innerHTML = `
    <div class="spinner"></div>
    <p>Loading attempt details...</p>
  `;

  try {
    const response = await fetch(`/api/admin/attempts/${attemptId}`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load attempt details.");
    }

    const attempt = data.attempt;
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];

    elements.detailsAvatar.classList.remove("has-image");
    elements.detailsAvatar.style.backgroundImage = "";
    elements.detailsAvatar.textContent = "";

    if (attempt.user?.avatar) {
      elements.detailsAvatar.classList.add("has-image");

      elements.detailsAvatar.style.backgroundImage = `url('${attempt.user.avatar.replaceAll("'", "%27")}')`;

      elements.detailsAvatar.setAttribute("role", "img");

      elements.detailsAvatar.setAttribute(
        "aria-label",
        `${attempt.user.fullName || "User"} profile picture`,
      );
    } else {
      elements.detailsAvatar.textContent = getInitials(attempt.user);

      elements.detailsAvatar.removeAttribute("role");
      elements.detailsAvatar.removeAttribute("aria-label");
    }

    elements.detailsUserName.textContent =
      attempt.user?.fullName || "Deleted User";

    elements.detailsUserEmail.textContent = attempt.user?.email || "No email";

    elements.detailsCategory.textContent = attempt.category || "Unknown";

    elements.detailsScore.textContent = `${Number(attempt.score) || 0} / ${
      Number(attempt.totalQuestions) || 0
    }`;

    elements.detailsAccuracy.textContent = `${Number(attempt.accuracy) || 0}%`;

    elements.detailsXp.textContent = `${Number(attempt.xpEarned) || 0} XP`;

    elements.detailsTime.textContent = formatDuration(attempt.timeTakenSeconds);

    elements.detailsCompletedAt.textContent = formatDate(attempt.completedAt);

    elements.answerCountText.textContent = `${answers.length} ${
      answers.length === 1 ? "question" : "questions"
    }`;

    elements.answerReviewList.innerHTML = "";

    if (answers.length === 0) {
      elements.answerReviewList.innerHTML = `
        <div class="empty-answer-state">
          No answer details are available.
        </div>
      `;
    } else {
      const fragment = document.createDocumentFragment();

      answers.forEach((answer) => {
        fragment.appendChild(createAnswerCard(answer));
      });

      elements.answerReviewList.appendChild(fragment);
    }

    toggleElement(elements.detailsLoading, false);
    toggleElement(elements.detailsContent, true);
  } catch (error) {
    elements.detailsLoading.innerHTML = `
      <span class="state-icon">⚠️</span>
      <p>${escapeHtml(error.message)}</p>
    `;
  }
}

function closeDetailsModal() {
  closeModal(elements.detailsModal);
}

function openDeleteModal(attemptId) {
  const attempt = findAttempt(attemptId);

  if (!attempt) {
    return;
  }

  state.selectedAttempt = attempt;

  const userName = attempt.user?.fullName || "Deleted User";

  elements.deleteDescription.textContent = `Delete ${userName}'s ${attempt.category} quiz attempt? The user's saved statistics will be recalculated.`;

  elements.deleteMessage.textContent = "";
  elements.deleteMessage.className = "form-message";

  openModal(elements.deleteModal);
}

function closeDeleteModal() {
  closeModal(elements.deleteModal);
  state.selectedAttempt = null;
}

async function deleteAttempt() {
  if (!state.selectedAttempt) {
    return;
  }

  elements.confirmDeleteButton.disabled = true;
  elements.confirmDeleteButton.textContent = "Deleting...";

  try {
    const response = await fetch(
      `/api/admin/attempts/${state.selectedAttempt.id}`,
      {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to delete attempt.");
    }

    closeDeleteModal();

    if (state.attempts.length === 1 && state.currentPage > 1) {
      state.currentPage -= 1;
    }

    await loadAttempts();
  } catch (error) {
    elements.deleteMessage.textContent = error.message;

    elements.deleteMessage.className = "form-message error-message";
  } finally {
    elements.confirmDeleteButton.disabled = false;
    elements.confirmDeleteButton.textContent = "Delete Attempt";
  }
}

function handleAttemptAction(event) {
  const button = event.target.closest("[data-action][data-attempt-id]");

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const attemptId = button.dataset.attemptId;

  if (action === "view") {
    openAttemptDetails(attemptId);
  }

  if (action === "delete") {
    openDeleteModal(attemptId);
  }
}

function initializeFilters() {
  elements.searchInput.addEventListener("input", () => {
    clearTimeout(state.searchTimeout);

    state.searchTimeout = setTimeout(() => {
      state.search = elements.searchInput.value.trim();

      state.currentPage = 1;
      loadAttempts();
    }, 350);
  });

  elements.categoryFilter.addEventListener("change", () => {
    state.category = elements.categoryFilter.value;

    state.currentPage = 1;
    loadAttempts();
  });

  elements.userFilter.addEventListener("change", () => {
    state.userId = elements.userFilter.value;

    state.currentPage = 1;
    loadAttempts();
  });

  elements.sortFilter.addEventListener("change", () => {
    state.sort = elements.sortFilter.value;

    state.currentPage = 1;
    loadAttempts();
  });
}

function initializePagination() {
  elements.previousPageButton.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      loadAttempts();
    }
  });

  elements.nextPageButton.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) {
      state.currentPage += 1;
      loadAttempts();
    }
  });
}

function initializeModals() {
  document.querySelectorAll("[data-close-details-modal]").forEach((element) => {
    element.addEventListener("click", closeDetailsModal);
  });

  document.querySelectorAll("[data-close-delete-modal]").forEach((element) => {
    element.addEventListener("click", closeDeleteModal);
  });

  elements.confirmDeleteButton.addEventListener("click", deleteAttempt);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements.detailsModal.classList.contains("hidden")) {
      closeDetailsModal();
    }

    if (!elements.deleteModal.classList.contains("hidden")) {
      closeDeleteModal();
    }
  });
}

function initializePage() {
  initializeFilters();
  initializePagination();
  initializeModals();

  elements.attemptsList.addEventListener("click", handleAttemptAction);

  elements.retryButton.addEventListener("click", loadAttempts);

  elements.refreshButton.addEventListener("click", loadAttempts);

  loadAttempts();
}

document.addEventListener("DOMContentLoaded", initializePage);
