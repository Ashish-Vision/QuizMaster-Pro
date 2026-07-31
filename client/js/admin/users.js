"use strict";

const state = {
  users: [],
  currentAdminId: "",
  currentPage: 1,
  totalPages: 1,
  limit: 10,
  search: "",
  role: "all",
  status: "all",
  sort: "newest",
  selectedUser: null,
  pendingRole: null,
  pendingStatus: null,
  searchTimeout: null,
};

const elements = {
  loadingState: document.getElementById("usersLoadingState"),
  errorState: document.getElementById("usersErrorState"),
  errorMessage: document.getElementById("usersErrorMessage"),
  emptyState: document.getElementById("usersEmptyState"),
  content: document.getElementById("usersContent"),
  usersList: document.getElementById("usersList"),

  retryButton: document.getElementById("retryUsersButton"),
  refreshButton: document.getElementById("refreshUsersButton"),

  searchInput: document.getElementById("userSearchInput"),
  roleFilter: document.getElementById("roleFilter"),
  statusFilter: document.getElementById("statusFilter"),
  sortFilter: document.getElementById("sortFilter"),

  totalUsersCount: document.getElementById("totalUsersCount"),
  totalAdminsCount: document.getElementById("totalAdminsCount"),
  activeUsersCount: document.getElementById("activeUsersCount"),
  disabledUsersCount: document.getElementById("disabledUsersCount"),

  previousPageButton: document.getElementById("previousPageButton"),
  nextPageButton: document.getElementById("nextPageButton"),
  paginationText: document.getElementById("paginationText"),

  detailsModal: document.getElementById("userDetailsModal"),
  detailsLoading: document.getElementById("userDetailsLoading"),
  detailsContent: document.getElementById("userDetailsContent"),
  detailsAvatar: document.getElementById("detailsAvatar"),
  detailsName: document.getElementById("detailsName"),
  detailsEmail: document.getElementById("detailsEmail"),
  detailsRole: document.getElementById("detailsRole"),
  detailsStatus: document.getElementById("detailsStatus"),
  detailsXp: document.getElementById("detailsXp"),
  detailsQuizzes: document.getElementById("detailsQuizzes"),
  detailsCorrect: document.getElementById("detailsCorrect"),
  detailsStreak: document.getElementById("detailsStreak"),
  detailsAttempts: document.getElementById("detailsAttempts"),
  detailsAccuracy: document.getElementById("detailsAccuracy"),
  detailsCreatedAt: document.getElementById("detailsCreatedAt"),
  detailsLastLogin: document.getElementById("detailsLastLogin"),
  detailsLastQuiz: document.getElementById("detailsLastQuiz"),

  roleModal: document.getElementById("roleModal"),
  roleDescription: document.getElementById("roleModalDescription"),
  roleMessage: document.getElementById("roleModalMessage"),
  confirmRoleButton: document.getElementById("confirmRoleButton"),

  statusModal: document.getElementById("statusModal"),
  statusModalIcon: document.getElementById("statusModalIcon"),
  statusModalTitle: document.getElementById("statusModalTitle"),
  statusDescription: document.getElementById("statusModalDescription"),
  statusMessage: document.getElementById("statusModalMessage"),
  confirmStatusButton: document.getElementById("confirmStatusButton"),
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
  if (!dateValue) {
    return "Never";
  }

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

function getInitials(user) {
  const first = user.firstName?.charAt(0) || "";
  const last = user.lastName?.charAt(0) || "";

  return `${first}${last}`.toUpperCase() || "U";
}

function showLoading() {
  toggleElement(elements.loadingState, true);
  toggleElement(elements.errorState, false);
  toggleElement(elements.emptyState, false);
  toggleElement(elements.content, false);
}

function showError(message) {
  elements.errorMessage.textContent = message || "Unable to load users.";

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
  elements.totalUsersCount.textContent = Number(summary.totalUsers) || 0;

  elements.totalAdminsCount.textContent = Number(summary.totalAdmins) || 0;

  elements.activeUsersCount.textContent = Number(summary.activeUsers) || 0;

  elements.disabledUsersCount.textContent = Number(summary.disabledUsers) || 0;
}

function createUserRow(user) {
  const row = document.createElement("article");

  row.className = "user-row";

  if (!user.isActive) {
    row.classList.add("disabled-user");
  }

  if (String(user.id) === String(state.currentAdminId)) {
    row.classList.add("current-admin");
  }

  const isCurrentAdmin = String(user.id) === String(state.currentAdminId);

  const roleButtonText = user.role === "admin" ? "Make User" : "Make Admin";

  const statusButtonText = user.isActive ? "Disable" : "Activate";

  row.innerHTML = `
    <div class="user-identity">
      <div class="user-avatar">
        ${escapeHtml(getInitials(user))}
      </div>

      <div class="user-name">
        <strong>
          ${escapeHtml(user.fullName || "Unknown User")}
          ${isCurrentAdmin ? '<span class="you-badge">You</span>' : ""}
        </strong>

        <span>${escapeHtml(user.email)}</span>

        <small>
          Joined ${formatDate(user.createdAt)}
        </small>
      </div>
    </div>

    <div>
      <span class="role-badge ${user.role === "admin" ? "admin" : ""}">
        ${escapeHtml(user.role)}
      </span>
    </div>

    <div class="performance-cell">
      <strong>${Number(user.totalXp) || 0} XP</strong>

      <span>
        ${Number(user.quizzesCompleted) || 0} quizzes
      </span>

      <small>
        ${Number(user.correctAnswers) || 0} correct
      </small>
    </div>

    <div>
      <span class="status-badge ${user.isActive ? "active" : "disabled"}">
        ${user.isActive ? "Active" : "Disabled"}
      </span>
    </div>

    <div class="user-actions">
      <button
        type="button"
        class="action-button view-button"
        data-action="view"
        data-user-id="${user.id}"
      >
        View
      </button>

      <button
        type="button"
        class="action-button role-button"
        data-action="role"
        data-user-id="${user.id}"
        ${isCurrentAdmin ? "disabled" : ""}
      >
        ${roleButtonText}
      </button>

      <button
        type="button"
        class="action-button ${
          user.isActive ? "disable-button" : "activate-button"
        }"
        data-action="status"
        data-user-id="${user.id}"
        ${isCurrentAdmin ? "disabled" : ""}
      >
        ${statusButtonText}
      </button>
    </div>
  `;

  return row;
}

function renderUsers(users) {
  elements.usersList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  users.forEach((user) => {
    fragment.appendChild(createUserRow(user));
  });

  elements.usersList.appendChild(fragment);
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

  if (state.role !== "all") {
    query.set("role", state.role);
  }

  if (state.status !== "all") {
    query.set("status", state.status);
  }

  return query;
}

async function loadUsers() {
  showLoading();

  try {
    const query = buildQuery();

    const response = await fetch(`/api/admin/users?${query.toString()}`, {
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
      throw new Error(data.message || "Unable to load users.");
    }

    state.users = Array.isArray(data.users) ? data.users : [];

    state.currentAdminId = data.currentAdminId || "";

    renderSummary(data.summary || {});
    renderPagination(data.pagination || {});

    if (state.users.length === 0) {
      showEmpty();
      return;
    }

    renderUsers(state.users);
    showContent();
  } catch (error) {
    console.error("User loading error:", error);
    showError(error.message);
  }
}

function findUser(userId) {
  return state.users.find((user) => String(user.id) === String(userId));
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

async function openUserDetails(userId) {
  openModal(elements.detailsModal);

  toggleElement(elements.detailsLoading, true);
  toggleElement(elements.detailsContent, false);

  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load user details.");
    }

    const user = data.user;
    const statistics = data.statistics || {};

    elements.detailsAvatar.textContent = getInitials(user);

    elements.detailsName.textContent = user.fullName || "Unknown User";

    elements.detailsEmail.textContent = user.email || "";

    elements.detailsRole.textContent =
      user.role === "admin" ? "Administrator" : "User";

    elements.detailsStatus.textContent = user.isActive ? "Active" : "Disabled";

    elements.detailsXp.textContent = Number(user.totalXp) || 0;

    elements.detailsQuizzes.textContent = Number(user.quizzesCompleted) || 0;

    elements.detailsCorrect.textContent = Number(user.correctAnswers) || 0;

    elements.detailsStreak.textContent = Number(user.currentStreak) || 0;

    elements.detailsAttempts.textContent =
      Number(statistics.totalAttempts) || 0;

    elements.detailsAccuracy.textContent = `${Number(statistics.averageAccuracy) || 0}%`;

    elements.detailsCreatedAt.textContent = formatDate(user.createdAt);

    elements.detailsLastLogin.textContent = formatDate(user.lastLoginAt);

    elements.detailsLastQuiz.textContent = formatDate(user.lastQuizDate);

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

function openRoleModal(userId) {
  const user = findUser(userId);

  if (!user) {
    return;
  }

  state.selectedUser = user;
  state.pendingRole = user.role === "admin" ? "user" : "admin";

  elements.roleDescription.textContent =
    state.pendingRole === "admin"
      ? `Promote ${user.fullName} to administrator?`
      : `Remove administrator access from ${user.fullName}?`;

  elements.roleMessage.textContent = "";
  elements.roleMessage.className = "form-message";

  elements.confirmRoleButton.textContent =
    state.pendingRole === "admin" ? "Promote User" : "Remove Admin Role";

  openModal(elements.roleModal);
}

function closeRoleModal() {
  closeModal(elements.roleModal);

  state.selectedUser = null;
  state.pendingRole = null;
}

async function updateRole() {
  if (!state.selectedUser || !state.pendingRole) {
    return;
  }

  elements.confirmRoleButton.disabled = true;
  elements.confirmRoleButton.textContent = "Updating...";

  try {
    const response = await fetch(
      `/api/admin/users/${state.selectedUser.id}/role`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          role: state.pendingRole,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to update user role.");
    }

    closeRoleModal();
    await loadUsers();
  } catch (error) {
    elements.roleMessage.textContent = error.message;

    elements.roleMessage.className = "form-message error-message";
  } finally {
    elements.confirmRoleButton.disabled = false;
    elements.confirmRoleButton.textContent = "Confirm";
  }
}

function openStatusModal(userId) {
  const user = findUser(userId);

  if (!user) {
    return;
  }

  state.selectedUser = user;
  state.pendingStatus = !user.isActive;

  elements.statusModalIcon.textContent = state.pendingStatus ? "✅" : "⛔";

  elements.statusModalTitle.textContent = state.pendingStatus
    ? "Activate Account?"
    : "Disable Account?";

  elements.statusDescription.textContent = state.pendingStatus
    ? `Activate ${user.fullName}'s account?`
    : `Disable ${user.fullName}'s account? The user will not be able to log in.`;

  elements.statusMessage.textContent = "";
  elements.statusMessage.className = "form-message";

  elements.confirmStatusButton.textContent = state.pendingStatus
    ? "Activate Account"
    : "Disable Account";

  elements.confirmStatusButton.className = state.pendingStatus
    ? "primary-button"
    : "danger-button";

  openModal(elements.statusModal);
}

function closeStatusModal() {
  closeModal(elements.statusModal);

  state.selectedUser = null;
  state.pendingStatus = null;
}

async function updateStatus() {
  if (!state.selectedUser || typeof state.pendingStatus !== "boolean") {
    return;
  }

  elements.confirmStatusButton.disabled = true;
  elements.confirmStatusButton.textContent = "Updating...";

  try {
    const response = await fetch(
      `/api/admin/users/${state.selectedUser.id}/status`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          isActive: state.pendingStatus,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to update account status.");
    }

    closeStatusModal();
    await loadUsers();
  } catch (error) {
    elements.statusMessage.textContent = error.message;

    elements.statusMessage.className = "form-message error-message";
  } finally {
    elements.confirmStatusButton.disabled = false;
  }
}

function handleUserAction(event) {
  const button = event.target.closest("[data-action][data-user-id]");

  if (!button || button.disabled) {
    return;
  }

  const action = button.dataset.action;
  const userId = button.dataset.userId;

  if (action === "view") {
    openUserDetails(userId);
  }

  if (action === "role") {
    openRoleModal(userId);
  }

  if (action === "status") {
    openStatusModal(userId);
  }
}

function initializeFilters() {
  elements.searchInput.addEventListener("input", () => {
    clearTimeout(state.searchTimeout);

    state.searchTimeout = setTimeout(() => {
      state.search = elements.searchInput.value.trim();

      state.currentPage = 1;
      loadUsers();
    }, 350);
  });

  elements.roleFilter.addEventListener("change", () => {
    state.role = elements.roleFilter.value;
    state.currentPage = 1;
    loadUsers();
  });

  elements.statusFilter.addEventListener("change", () => {
    state.status = elements.statusFilter.value;
    state.currentPage = 1;
    loadUsers();
  });

  elements.sortFilter.addEventListener("change", () => {
    state.sort = elements.sortFilter.value;
    state.currentPage = 1;
    loadUsers();
  });
}

function initializePagination() {
  elements.previousPageButton.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      loadUsers();
    }
  });

  elements.nextPageButton.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) {
      state.currentPage += 1;
      loadUsers();
    }
  });
}

function initializeModals() {
  document.querySelectorAll("[data-close-details-modal]").forEach((element) => {
    element.addEventListener("click", closeDetailsModal);
  });

  document.querySelectorAll("[data-close-role-modal]").forEach((element) => {
    element.addEventListener("click", closeRoleModal);
  });

  document.querySelectorAll("[data-close-status-modal]").forEach((element) => {
    element.addEventListener("click", closeStatusModal);
  });

  elements.confirmRoleButton.addEventListener("click", updateRole);

  elements.confirmStatusButton.addEventListener("click", updateStatus);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements.detailsModal.classList.contains("hidden")) {
      closeDetailsModal();
    }

    if (!elements.roleModal.classList.contains("hidden")) {
      closeRoleModal();
    }

    if (!elements.statusModal.classList.contains("hidden")) {
      closeStatusModal();
    }
  });
}

function initializePage() {
  initializeFilters();
  initializePagination();
  initializeModals();

  elements.usersList.addEventListener("click", handleUserAction);

  elements.retryButton.addEventListener("click", loadUsers);

  elements.refreshButton.addEventListener("click", loadUsers);

  loadUsers();
}

document.addEventListener("DOMContentLoaded", initializePage);
