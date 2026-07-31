"use strict";

const state = {
  categories: [],
  visibleCategories: [],
  selectedCategory: null,
  search: "",
  sort: "name-asc",
};

const elements = {
  loadingState: document.getElementById("categoriesLoadingState"),

  errorState: document.getElementById("categoriesErrorState"),

  errorMessage: document.getElementById("categoriesErrorMessage"),

  emptyState: document.getElementById("categoriesEmptyState"),

  content: document.getElementById("categoriesContent"),

  categoriesGrid: document.getElementById("categoriesGrid"),

  totalCategoriesCount: document.getElementById("totalCategoriesCount"),

  totalQuestionsCount: document.getElementById("totalQuestionsCount"),

  totalAttemptsCount: document.getElementById("totalAttemptsCount"),

  mostPopularCategory: document.getElementById("mostPopularCategory"),

  searchInput: document.getElementById("categorySearchInput"),

  sortFilter: document.getElementById("categorySortFilter"),

  refreshButton: document.getElementById("refreshCategoriesButton"),

  retryButton: document.getElementById("retryCategoriesButton"),

  renameModal: document.getElementById("renameCategoryModal"),

  renameForm: document.getElementById("renameCategoryForm"),

  currentCategoryName: document.getElementById("currentCategoryName"),

  newCategoryName: document.getElementById("newCategoryName"),

  renameMessage: document.getElementById("renameCategoryMessage"),

  renameButton: document.getElementById("confirmRenameCategoryButton"),

  deleteModal: document.getElementById("deleteCategoryModal"),

  deleteDescription: document.getElementById("deleteCategoryDescription"),

  deleteMessage: document.getElementById("deleteCategoryMessage"),

  deleteButton: document.getElementById("confirmDeleteCategoryButton"),
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
  }).format(date);
}

function showLoading() {
  toggleElement(elements.loadingState, true);
  toggleElement(elements.errorState, false);
  toggleElement(elements.emptyState, false);
  toggleElement(elements.content, false);
}

function showError(message) {
  elements.errorMessage.textContent = message || "Unable to load categories.";

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

function renderSummary(summary, categories) {
  elements.totalCategoriesCount.textContent =
    Number(summary.totalCategories) || 0;

  elements.totalQuestionsCount.textContent =
    Number(summary.totalQuestions) || 0;

  elements.totalAttemptsCount.textContent = Number(summary.totalAttempts) || 0;

  const mostPopular = [...categories].sort(
    (first, second) =>
      Number(second.quizAttempts || 0) - Number(first.quizAttempts || 0),
  )[0];

  elements.mostPopularCategory.textContent =
    mostPopular && mostPopular.quizAttempts > 0 ? mostPopular.name : "None";
}

function createDifficultyItem(label, count, className) {
  return `
    <div class="difficulty-item">
      <span class="difficulty-dot ${className}"></span>

      <span>${label}</span>

      <strong>${Number(count) || 0}</strong>
    </div>
  `;
}

function createCategoryCard(category) {
  const card = document.createElement("article");

  card.className = "category-card";
  card.dataset.categoryName = category.name;

  const canDelete = Number(category.quizAttempts) === 0;

  card.innerHTML = `
    <div class="category-card-header">
      <div class="category-identity">
        <span class="category-icon">📚</span>

        <div>
          <h2>${escapeHtml(category.name)}</h2>

          <p>
            Updated ${formatDate(category.updatedAt || category.createdAt)}
          </p>
        </div>
      </div>

      <div class="category-actions">
        <button
          type="button"
          class="icon-button edit-category-button"
          data-action="rename"
          data-category-name="${escapeHtml(category.name)}"
          aria-label="Rename ${escapeHtml(category.name)}"
        >
          ✏️
        </button>

        <button
          type="button"
          class="icon-button delete-category-button"
          data-action="delete"
          data-category-name="${escapeHtml(category.name)}"
          aria-label="Delete ${escapeHtml(category.name)}"
          ${canDelete ? "" : "disabled"}
        >
          🗑️
        </button>
      </div>
    </div>

    <div class="category-question-count">
      <span>Total Questions</span>

      <strong>${Number(category.totalQuestions) || 0}</strong>
    </div>

    <div class="difficulty-breakdown">
      ${createDifficultyItem("Easy", category.easyQuestions, "easy")}

      ${createDifficultyItem("Medium", category.mediumQuestions, "medium")}

      ${createDifficultyItem("Hard", category.hardQuestions, "hard")}
    </div>

    <div class="category-performance">
      <div>
        <span>Quiz Attempts</span>
        <strong>${Number(category.quizAttempts) || 0}</strong>
      </div>

      <div>
        <span>Average Accuracy</span>
        <strong>${Number(category.averageAccuracy) || 0}%</strong>
      </div>

      <div>
        <span>XP Earned</span>
        <strong>${Number(category.totalXpEarned) || 0}</strong>
      </div>
    </div>

    ${
      canDelete
        ? `
          <p class="category-status safe">
            This category has no saved attempts and can be deleted.
          </p>
        `
        : `
          <p class="category-status protected">
            Protected because saved quiz attempts use this category.
          </p>
        `
    }
  `;

  return card;
}

function renderCategories(categories) {
  elements.categoriesGrid.innerHTML = "";

  if (categories.length === 0) {
    showEmpty();
    return;
  }

  const fragment = document.createDocumentFragment();

  categories.forEach((category) => {
    fragment.appendChild(createCategoryCard(category));
  });

  elements.categoriesGrid.appendChild(fragment);

  showContent();
}

function sortCategories(categories) {
  const sorted = [...categories];

  switch (state.sort) {
    case "name-desc":
      sorted.sort((first, second) => second.name.localeCompare(first.name));
      break;

    case "questions-desc":
      sorted.sort(
        (first, second) =>
          Number(second.totalQuestions) - Number(first.totalQuestions),
      );
      break;

    case "attempts-desc":
      sorted.sort(
        (first, second) =>
          Number(second.quizAttempts) - Number(first.quizAttempts),
      );
      break;

    case "accuracy-desc":
      sorted.sort(
        (first, second) =>
          Number(second.averageAccuracy) - Number(first.averageAccuracy),
      );
      break;

    case "name-asc":
    default:
      sorted.sort((first, second) => first.name.localeCompare(second.name));
      break;
  }

  return sorted;
}

function applyFilters() {
  const searchTerm = state.search.toLowerCase();

  const filtered = state.categories.filter((category) =>
    category.name.toLowerCase().includes(searchTerm),
  );

  state.visibleCategories = sortCategories(filtered);

  renderCategories(state.visibleCategories);
}

async function loadCategories() {
  showLoading();

  try {
    const response = await fetch("/api/admin/categories", {
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

    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load categories.");
    }

    state.categories = Array.isArray(data.categories) ? data.categories : [];

    renderSummary(data.summary || {}, state.categories);

    applyFilters();
  } catch (error) {
    console.error("Category loading error:", error);

    showError(error.message);
  }
}

function findCategory(categoryName) {
  return state.categories.find((category) => category.name === categoryName);
}

function openRenameModal(categoryName) {
  const category = findCategory(categoryName);

  if (!category) {
    alert("Category details are unavailable.");
    return;
  }

  state.selectedCategory = category;

  elements.currentCategoryName.value = category.name;
  elements.newCategoryName.value = category.name;

  elements.renameMessage.textContent = "";
  elements.renameMessage.className = "form-message";

  toggleElement(elements.renameModal, true);

  elements.renameModal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  elements.newCategoryName.focus();
  elements.newCategoryName.select();
}

function closeRenameModal() {
  toggleElement(elements.renameModal, false);

  elements.renameModal.setAttribute("aria-hidden", "true");

  elements.renameMessage.textContent = "";

  state.selectedCategory = null;

  document.body.classList.remove("modal-open");
}

async function renameCategory(event) {
  event.preventDefault();

  if (!state.selectedCategory) {
    return;
  }

  const oldName = state.selectedCategory.name;
  const newName = elements.newCategoryName.value.trim();

  if (!newName) {
    elements.renameMessage.textContent = "New category name is required.";

    elements.renameMessage.className = "form-message error-message";

    return;
  }

  if (oldName.toLowerCase() === newName.toLowerCase()) {
    elements.renameMessage.textContent = "Enter a different category name.";

    elements.renameMessage.className = "form-message error-message";

    return;
  }

  elements.renameButton.disabled = true;
  elements.renameButton.textContent = "Renaming...";

  try {
    const encodedName = encodeURIComponent(oldName);

    const response = await fetch(`/api/admin/categories/${encodedName}`, {
      method: "PATCH",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        name: newName,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to rename category.");
    }

    elements.renameMessage.textContent =
      data.message || "Category renamed successfully.";

    elements.renameMessage.className = "form-message success-message";

    setTimeout(async () => {
      closeRenameModal();
      await loadCategories();
    }, 600);
  } catch (error) {
    elements.renameMessage.textContent = error.message;

    elements.renameMessage.className = "form-message error-message";
  } finally {
    elements.renameButton.disabled = false;
    elements.renameButton.textContent = "Rename Category";
  }
}

function openDeleteModal(categoryName) {
  const category = findCategory(categoryName);

  if (!category) {
    alert("Category details are unavailable.");
    return;
  }

  if (Number(category.quizAttempts) > 0) {
    alert("This category has saved quiz attempts and cannot be deleted.");

    return;
  }

  state.selectedCategory = category;

  elements.deleteDescription.textContent = `Delete "${category.name}" and all ${category.totalQuestions} questions inside it? This action cannot be undone.`;

  elements.deleteMessage.textContent = "";
  elements.deleteMessage.className = "form-message";

  toggleElement(elements.deleteModal, true);

  elements.deleteModal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");
}

function closeDeleteModal() {
  toggleElement(elements.deleteModal, false);

  elements.deleteModal.setAttribute("aria-hidden", "true");

  elements.deleteMessage.textContent = "";

  state.selectedCategory = null;

  document.body.classList.remove("modal-open");
}

async function deleteCategory() {
  if (!state.selectedCategory) {
    return;
  }

  const categoryName = state.selectedCategory.name;

  elements.deleteButton.disabled = true;
  elements.deleteButton.textContent = "Deleting...";

  try {
    const encodedName = encodeURIComponent(categoryName);

    const response = await fetch(`/api/admin/categories/${encodedName}`, {
      method: "DELETE",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to delete category.");
    }

    closeDeleteModal();

    await loadCategories();
  } catch (error) {
    elements.deleteMessage.textContent = error.message;

    elements.deleteMessage.className = "form-message error-message";
  } finally {
    elements.deleteButton.disabled = false;
    elements.deleteButton.textContent = "Delete Category";
  }
}

function handleCategoryGridClick(event) {
  const button = event.target.closest("[data-action][data-category-name]");

  if (!button || button.disabled) {
    return;
  }

  const action = button.dataset.action;
  const categoryName = button.dataset.categoryName;

  if (action === "rename") {
    openRenameModal(categoryName);
  }

  if (action === "delete") {
    openDeleteModal(categoryName);
  }
}

function initializeControls() {
  elements.searchInput.addEventListener("input", () => {
    state.search = elements.searchInput.value.trim();

    applyFilters();
  });

  elements.sortFilter.addEventListener("change", () => {
    state.sort = elements.sortFilter.value;

    applyFilters();
  });

  elements.refreshButton.addEventListener("click", loadCategories);

  elements.retryButton.addEventListener("click", loadCategories);

  elements.categoriesGrid.addEventListener("click", handleCategoryGridClick);
}

function initializeModals() {
  elements.renameForm.addEventListener("submit", renameCategory);

  elements.deleteButton.addEventListener("click", deleteCategory);

  document.querySelectorAll("[data-close-rename-modal]").forEach((element) => {
    element.addEventListener("click", closeRenameModal);
  });

  document.querySelectorAll("[data-close-delete-modal]").forEach((element) => {
    element.addEventListener("click", closeDeleteModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements.renameModal.classList.contains("hidden")) {
      closeRenameModal();
    }

    if (!elements.deleteModal.classList.contains("hidden")) {
      closeDeleteModal();
    }
  });
}

function initializePage() {
  initializeControls();
  initializeModals();
  loadCategories();
}

document.addEventListener("DOMContentLoaded", initializePage);
