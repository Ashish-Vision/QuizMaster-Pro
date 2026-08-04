"use strict";

const state = {
  questions: [],
  categories: [],
  currentPage: 1,
  totalPages: 1,
  totalQuestions: 0,
  limit: 10,
  search: "",
  category: "all",
  difficulty: "all",
  sortBy: "createdAt",
  sortOrder: "desc",
  editingQuestionId: null,
  deletingQuestionId: null,
  searchTimeout: null,
};

const elements = {
  loadingState: document.getElementById("questionsLoadingState"),

  errorState: document.getElementById("questionsErrorState"),

  errorMessage: document.getElementById("questionsErrorMessage"),

  emptyState: document.getElementById("questionsEmptyState"),

  content: document.getElementById("questionsContent"),

  questionsList: document.getElementById("questionsList"),

  retryButton: document.getElementById("retryQuestionsButton"),

  refreshButton: document.getElementById("refreshQuestionsButton"),

  searchInput: document.getElementById("questionSearchInput"),

  categoryFilter: document.getElementById("categoryFilter"),

  difficultyFilter: document.getElementById("difficultyFilter"),

  sortFilter: document.getElementById("sortFilter"),

  totalQuestionsCount: document.getElementById("totalQuestionsCount"),

  easyQuestionsCount: document.getElementById("easyQuestionsCount"),

  mediumQuestionsCount: document.getElementById("mediumQuestionsCount"),

  hardQuestionsCount: document.getElementById("hardQuestionsCount"),

  previousPageButton: document.getElementById("previousPageButton"),

  nextPageButton: document.getElementById("nextPageButton"),

  paginationText: document.getElementById("paginationText"),

  openCreateModalButton: document.getElementById("openCreateModalButton"),

  questionModal: document.getElementById("questionModal"),

  questionModalTitle: document.getElementById("questionModalTitle"),

  questionForm: document.getElementById("questionForm"),

  questionId: document.getElementById("questionId"),

  questionText: document.getElementById("questionText"),

  questionCategory: document.getElementById("questionCategory"),

  questionDifficulty: document.getElementById("questionDifficulty"),

  questionExplanation: document.getElementById("questionExplanation"),

  questionOption0: document.getElementById("questionOption0"),

  questionOption1: document.getElementById("questionOption1"),

  questionOption2: document.getElementById("questionOption2"),

  questionOption3: document.getElementById("questionOption3"),

  categorySuggestions: document.getElementById("categorySuggestions"),

  questionFormMessage: document.getElementById("questionFormMessage"),

  saveQuestionButton: document.getElementById("saveQuestionButton"),

  deleteModal: document.getElementById("deleteQuestionModal"),

  deleteQuestionText: document.getElementById("deleteQuestionText"),

  deleteQuestionMessage: document.getElementById("deleteQuestionMessage"),

  confirmDeleteButton: document.getElementById("confirmDeleteQuestionButton"),
};

function showElement(element, shouldShow) {
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
  }).format(date);
}

function getDifficultyClass(difficulty) {
  const value = String(difficulty || "").toLowerCase();

  if (value === "easy") {
    return "easy";
  }

  if (value === "medium") {
    return "medium";
  }

  if (value === "hard") {
    return "hard";
  }

  return "";
}

function showLoading() {
  showElement(elements.loadingState, true);
  showElement(elements.errorState, false);
  showElement(elements.emptyState, false);
  showElement(elements.content, false);
}

function showError(message) {
  elements.errorMessage.textContent = message || "Unable to load questions.";

  showElement(elements.loadingState, false);
  showElement(elements.errorState, true);
  showElement(elements.emptyState, false);
  showElement(elements.content, false);
}

function showEmpty() {
  showElement(elements.loadingState, false);
  showElement(elements.errorState, false);
  showElement(elements.emptyState, true);
  showElement(elements.content, false);
}

function showContent() {
  showElement(elements.loadingState, false);
  showElement(elements.errorState, false);
  showElement(elements.emptyState, false);
  showElement(elements.content, true);
}

function renderCategoryOptions(categories) {
  const selectedValue = elements.categoryFilter.value;

  elements.categoryFilter.innerHTML = `
      <option value="all">
        All categories
      </option>
    `;

  elements.categorySuggestions.innerHTML = "";

  categories.forEach((category) => {
    const filterOption = document.createElement("option");

    filterOption.value = category;
    filterOption.textContent = category;

    elements.categoryFilter.appendChild(filterOption);

    const suggestion = document.createElement("option");

    suggestion.value = category;

    elements.categorySuggestions.appendChild(suggestion);
  });

  if (categories.includes(selectedValue) || selectedValue === "all") {
    elements.categoryFilter.value = selectedValue;
  }
}

function renderSummary(data) {
  const difficultyStatistics = data.difficultyStatistics || {};

  elements.totalQuestionsCount.textContent =
    Number(data.pagination?.totalQuestions) || 0;

  elements.easyQuestionsCount.textContent =
    Number(difficultyStatistics.Easy) || 0;

  elements.mediumQuestionsCount.textContent =
    Number(difficultyStatistics.Medium) || 0;

  elements.hardQuestionsCount.textContent =
    Number(difficultyStatistics.Hard) || 0;
}

function createQuestionRow(question) {
  const row = document.createElement("article");

  row.className = "question-row";
  row.dataset.questionId = question._id;

  const correctAnswer =
    Array.isArray(question.options) && Number.isInteger(question.correctAnswer)
      ? question.options[question.correctAnswer]
      : "Unknown";

  row.innerHTML = `
      <div class="question-cell">
        <strong title="${escapeHtml(question.question)}">
          ${escapeHtml(question.question)}
        </strong>

        <small>
          Updated ${formatDate(question.updatedAt || question.createdAt)}
        </small>
      </div>

      <div>
        <span class="category-badge">
          ${escapeHtml(question.category)}
        </span>
      </div>

      <div>
        <span class="difficulty-badge ${getDifficultyClass(question.difficulty)}">
          ${escapeHtml(question.difficulty)}
        </span>
      </div>

      <div class="correct-answer-cell">
        <span>
          ${escapeHtml(correctAnswer)}
        </span>
      </div>

      <div class="question-actions">
        <button
          type="button"
          class="action-button edit-button"
          data-action="edit"
          data-question-id="${question._id}"
        >
          Edit
        </button>

        <button
          type="button"
          class="action-button delete-button"
          data-action="delete"
          data-question-id="${question._id}"
        >
          Delete
        </button>
      </div>
    `;

  return row;
}

function renderQuestions(questions) {
  elements.questionsList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  questions.forEach((question) => {
    fragment.appendChild(createQuestionRow(question));
  });

  elements.questionsList.appendChild(fragment);
}

function renderPagination(pagination) {
  state.currentPage = Number(pagination.currentPage) || 1;

  state.totalPages = Number(pagination.totalPages) || 1;

  state.totalQuestions = Number(pagination.totalQuestions) || 0;

  elements.paginationText.textContent = `Page ${state.currentPage} of ${state.totalPages}`;

  elements.previousPageButton.disabled = !pagination.hasPreviousPage;

  elements.nextPageButton.disabled = !pagination.hasNextPage;
}

function buildQuestionsQuery() {
  const query = new URLSearchParams({
    page: String(state.currentPage),
    limit: String(state.limit),
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  });

  if (state.search) {
    query.set("search", state.search);
  }

  if (state.category !== "all") {
    query.set("category", state.category);
  }

  if (state.difficulty !== "all") {
    query.set("difficulty", state.difficulty);
  }

  return query;
}

async function loadQuestions() {
  showLoading();

  try {
    const query = buildQuestionsQuery();

    const response = await fetch(`/api/admin/questions?${query.toString()}`, {
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
      throw new Error(data.message || "Unable to load questions.");
    }

    state.questions = Array.isArray(data.questions) ? data.questions : [];

    state.categories = Array.isArray(data.categories) ? data.categories : [];

    renderCategoryOptions(state.categories);
    renderSummary(data);
    renderPagination(data.pagination || {});

    if (state.questions.length === 0) {
      showEmpty();
      return;
    }

    renderQuestions(state.questions);
    showContent();
  } catch (error) {
    console.error("Question loading error:", error);

    showError(error.message);
  }
}

function resetQuestionForm() {
  elements.questionForm.reset();

  elements.questionId.value = "";
  elements.questionDifficulty.value = "Easy";
  elements.questionFormMessage.textContent = "";
  elements.questionFormMessage.className = "form-message";

  state.editingQuestionId = null;
}

function openCreateModal() {
  resetQuestionForm();

  elements.questionModalTitle.textContent = "Add Question";

  elements.saveQuestionButton.textContent = "Save Question";

  showElement(elements.questionModal, true);

  elements.questionModal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  elements.questionText.focus();
}

function getQuestionById(questionId) {
  return state.questions.find((question) => question._id === questionId);
}

function openEditModal(questionId) {
  const question = getQuestionById(questionId);

  if (!question) {
    alert("Question details are unavailable.");
    return;
  }

  resetQuestionForm();

  state.editingQuestionId = questionId;

  elements.questionId.value = questionId;
  elements.questionText.value = question.question || "";
  elements.questionCategory.value = question.category || "";
  elements.questionDifficulty.value = question.difficulty || "Easy";
  elements.questionExplanation.value = question.explanation || "";

  elements.questionOption0.value = question.options?.[0] || "";

  elements.questionOption1.value = question.options?.[1] || "";

  elements.questionOption2.value = question.options?.[2] || "";

  elements.questionOption3.value = question.options?.[3] || "";

  const correctAnswerRadio = elements.questionForm.querySelector(
    `input[name="correctAnswer"][value="${question.correctAnswer}"]`,
  );

  if (correctAnswerRadio) {
    correctAnswerRadio.checked = true;
  }

  elements.questionModalTitle.textContent = "Edit Question";

  elements.saveQuestionButton.textContent = "Update Question";

  showElement(elements.questionModal, true);

  elements.questionModal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  elements.questionText.focus();
}

function closeQuestionModal() {
  showElement(elements.questionModal, false);

  elements.questionModal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");

  resetQuestionForm();
}

function getQuestionPayload() {
  const selectedCorrectAnswer = elements.questionForm.querySelector(
    'input[name="correctAnswer"]:checked',
  );

  return {
    question: elements.questionText.value.trim(),

    options: [
      elements.questionOption0.value.trim(),
      elements.questionOption1.value.trim(),
      elements.questionOption2.value.trim(),
      elements.questionOption3.value.trim(),
    ],

    correctAnswer: selectedCorrectAnswer
      ? Number(selectedCorrectAnswer.value)
      : null,

    category: elements.questionCategory.value.trim(),

    difficulty: elements.questionDifficulty.value,

    explanation: elements.questionExplanation.value.trim(),
  };
}

function validateQuestionPayload(payload) {
  if (payload.question.length < 5) {
    return "Question must contain at least 5 characters.";
  }

  if (!payload.category) {
    return "Category is required.";
  }

  if (
    !Array.isArray(payload.options) ||
    payload.options.length !== 4 ||
    payload.options.some((option) => !option)
  ) {
    return "All four answer options are required.";
  }

  const uniqueOptions = new Set(
    payload.options.map((option) => option.toLowerCase()),
  );

  if (uniqueOptions.size !== 4) {
    return "All answer options must be unique.";
  }

  if (
    !Number.isInteger(payload.correctAnswer) ||
    payload.correctAnswer < 0 ||
    payload.correctAnswer > 3
  ) {
    return "Select the correct answer.";
  }

  return null;
}

async function saveQuestion(event) {
  event.preventDefault();

  const payload = getQuestionPayload();

  const validationError = validateQuestionPayload(payload);

  if (validationError) {
    elements.questionFormMessage.textContent = validationError;

    elements.questionFormMessage.className = "form-message error-message";

    return;
  }

  const isEditing = Boolean(state.editingQuestionId);

  const endpoint = isEditing
    ? `/api/admin/questions/${state.editingQuestionId}`
    : "/api/admin/questions";

  const method = isEditing ? "PUT" : "POST";

  elements.saveQuestionButton.disabled = true;

  elements.saveQuestionButton.textContent = isEditing
    ? "Updating..."
    : "Saving...";

  elements.questionFormMessage.textContent = "";
  elements.questionFormMessage.className = "form-message";

  try {
    const response = await fetch(endpoint, {
      method,

      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to save question.");
    }

    elements.questionFormMessage.textContent =
      data.message || "Question saved successfully.";

    elements.questionFormMessage.className = "form-message success-message";

    setTimeout(() => {
      closeQuestionModal();
      loadQuestions();
    }, 600);
  } catch (error) {
    elements.questionFormMessage.textContent = error.message;

    elements.questionFormMessage.className = "form-message error-message";
  } finally {
    elements.saveQuestionButton.disabled = false;

    elements.saveQuestionButton.textContent = isEditing
      ? "Update Question"
      : "Save Question";
  }
}

function openDeleteModal(questionId) {
  const question = getQuestionById(questionId);

  if (!question) {
    alert("Question details are unavailable.");
    return;
  }

  state.deletingQuestionId = questionId;

  elements.deleteQuestionText.textContent = `Delete "${question.question}"? This action cannot be undone.`;

  elements.deleteQuestionMessage.textContent = "";
  elements.deleteQuestionMessage.className = "form-message";

  showElement(elements.deleteModal, true);

  elements.deleteModal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");
}

function closeDeleteModal() {
  showElement(elements.deleteModal, false);

  elements.deleteModal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");

  state.deletingQuestionId = null;
}

async function deleteQuestion() {
  if (!state.deletingQuestionId) {
    return;
  }

  elements.confirmDeleteButton.disabled = true;
  elements.confirmDeleteButton.textContent = "Deleting...";

  try {
    const response = await fetch(
      `/api/admin/questions/${state.deletingQuestionId}`,
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
      throw new Error(data.message || "Unable to delete question.");
    }

    closeDeleteModal();

    if (state.questions.length === 1 && state.currentPage > 1) {
      state.currentPage -= 1;
    }

    await loadQuestions();
  } catch (error) {
    elements.deleteQuestionMessage.textContent = error.message;

    elements.deleteQuestionMessage.className = "form-message error-message";
  } finally {
    elements.confirmDeleteButton.disabled = false;
    elements.confirmDeleteButton.textContent = "Delete Question";
  }
}

function handleQuestionListClick(event) {
  const button = event.target.closest("[data-action][data-question-id]");

  if (!button) {
    return;
  }

  const questionId = button.dataset.questionId;
  const action = button.dataset.action;

  if (action === "edit") {
    openEditModal(questionId);
  }

  if (action === "delete") {
    openDeleteModal(questionId);
  }
}

function initializeFilters() {
  elements.searchInput.addEventListener("input", () => {
    clearTimeout(state.searchTimeout);

    state.searchTimeout = setTimeout(() => {
      state.search = elements.searchInput.value.trim();

      state.currentPage = 1;

      loadQuestions();
    }, 350);
  });

  elements.categoryFilter.addEventListener("change", () => {
    state.category = elements.categoryFilter.value;

    state.currentPage = 1;

    loadQuestions();
  });

  elements.difficultyFilter.addEventListener("change", () => {
    state.difficulty = elements.difficultyFilter.value;

    state.currentPage = 1;

    loadQuestions();
  });

  elements.sortFilter.addEventListener("change", () => {
    const [sortBy, sortOrder] = elements.sortFilter.value.split(":");

    state.sortBy = sortBy;
    state.sortOrder = sortOrder;
    state.currentPage = 1;

    loadQuestions();
  });
}

function initializePagination() {
  elements.previousPageButton.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      loadQuestions();
    }
  });

  elements.nextPageButton.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) {
      state.currentPage += 1;
      loadQuestions();
    }
  });
}

function initializeModals() {
  elements.openCreateModalButton.addEventListener("click", openCreateModal);

  document
    .querySelectorAll("[data-close-question-modal]")
    .forEach((element) => {
      element.addEventListener("click", closeQuestionModal);
    });

  document.querySelectorAll("[data-close-delete-modal]").forEach((element) => {
    element.addEventListener("click", closeDeleteModal);
  });

  elements.questionForm.addEventListener("submit", saveQuestion);

  elements.confirmDeleteButton.addEventListener("click", deleteQuestion);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements.questionModal.classList.contains("hidden")) {
      closeQuestionModal();
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

  elements.questionsList.addEventListener("click", handleQuestionListClick);

  elements.retryButton.addEventListener("click", loadQuestions);

  elements.refreshButton.addEventListener("click", loadQuestions);

  loadQuestions();
}

document.addEventListener("DOMContentLoaded", initializePage);
