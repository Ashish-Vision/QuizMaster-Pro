"use strict";

const state = {
  notifications: [],
  users: [],
  summary: {},
  pagination: {
    currentPage: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  filters: {
    search: "",
    type: "all",
    status: "all",
  },
  selectedNotification: null,
  isLoading: false,
};

const elements = {
  totalNotifications: document.getElementById("totalNotifications"),
  unreadNotifications: document.getElementById("unreadNotifications"),
  readNotifications: document.getElementById("readNotifications"),
  totalRecipients: document.getElementById("totalRecipients"),

  searchInput: document.getElementById("notificationSearchInput"),
  typeFilter: document.getElementById("notificationTypeFilter"),
  statusFilter: document.getElementById("notificationStatusFilter"),
  refreshButton: document.getElementById("refreshNotificationsButton"),

  loadingState: document.getElementById("notificationsLoadingState"),
  errorState: document.getElementById("notificationsErrorState"),
  errorMessage: document.getElementById("notificationsErrorMessage"),
  retryButton: document.getElementById("retryNotificationsButton"),
  content: document.getElementById("notificationsContent"),
  emptyState: document.getElementById("notificationsEmptyState"),
  list: document.getElementById("adminNotificationsList"),

  pagination: document.getElementById("notificationsPagination"),
  paginationText: document.getElementById("notificationsPaginationText"),
  previousPageButton: document.getElementById("previousNotificationsPage"),
  nextPageButton: document.getElementById("nextNotificationsPage"),

  openComposeButton: document.getElementById("openComposeButton"),
  composeModal: document.getElementById("composeNotificationModal"),
  composeForm: document.getElementById("composeNotificationForm"),
  recipientGroup: document.getElementById("recipientGroup"),
  singleUserGroup: document.getElementById("singleUserGroup"),
  recipientUserId: document.getElementById("recipientUserId"),
  notificationType: document.getElementById("notificationType"),
  notificationIcon: document.getElementById("notificationIcon"),
  notificationTitle: document.getElementById("notificationTitle"),
  notificationMessage: document.getElementById("notificationMessage"),
  notificationMessageCount: document.getElementById("notificationMessageCount"),
  notificationLink: document.getElementById("notificationLink"),
  composeMessage: document.getElementById("composeNotificationMessage"),
  sendButton: document.getElementById("sendNotificationButton"),

  deleteModal: document.getElementById("deleteNotificationModal"),
  deleteDescription: document.getElementById("deleteNotificationDescription"),
  deleteMessage: document.getElementById("deleteNotificationMessage"),
  confirmDeleteButton: document.getElementById(
    "confirmDeleteNotificationButton",
  ),
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

  element.textContent = String(value ?? "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getNumber(value).toLocaleString("en-IN");
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

function createAvatarMarkup(user) {
  const fullName = user?.fullName || "Unknown User";

  if (user?.avatar) {
    return `
      <div
        class="notification-user-avatar has-image"
        style="background-image: url('${escapeHtml(user.avatar)}')"
        role="img"
        aria-label="${escapeHtml(fullName)} profile picture"
      ></div>
    `;
  }

  return `
    <div class="notification-user-avatar">
      ${escapeHtml(getInitials(user))}
    </div>
  `;
}

function showLoading() {
  showElement(elements.loadingState, true);
  showElement(elements.errorState, false);
  showElement(elements.content, false);
}

function showError(message) {
  setText(
    elements.errorMessage,
    message || "Unable to load administrator notifications.",
  );

  showElement(elements.loadingState, false);
  showElement(elements.errorState, true);
  showElement(elements.content, false);
}

function showContent() {
  showElement(elements.loadingState, false);
  showElement(elements.errorState, false);
  showElement(elements.content, true);
}

function renderSummary() {
  const summary = state.summary || {};

  setText(
    elements.totalNotifications,
    formatNumber(summary.totalNotifications),
  );

  setText(
    elements.unreadNotifications,
    formatNumber(summary.unreadNotifications),
  );

  setText(elements.readNotifications, formatNumber(summary.readNotifications));

  setText(elements.totalRecipients, formatNumber(summary.totalRecipients));
}

function createNotificationCard(notification) {
  const article = document.createElement("article");

  article.className = "admin-notification-card";

  if (!notification.isRead) {
    article.classList.add("unread");
  }

  const statusClass = notification.isRead ? "status-read" : "status-unread";

  const statusText = notification.isRead ? "Read" : "Unread";

  article.innerHTML = `
    <div class="notification-icon">
      ${escapeHtml(notification.icon || "🔔")}
    </div>

    <div class="notification-card-main">
      <div class="notification-heading">
        <h2>${escapeHtml(notification.title || "Notification")}</h2>

        <time>
          ${escapeHtml(formatDateTime(notification.createdAt))}
        </time>
      </div>

      <p>${escapeHtml(notification.message || "")}</p>

      <div class="notification-meta">
        <span>${escapeHtml(notification.type || "system")}</span>

        <span class="status-badge ${statusClass}">
          ${statusText}
        </span>
      </div>

      <div class="notification-user">
        ${createAvatarMarkup(notification.user)}

        <div>
          <strong>
            ${escapeHtml(notification.user?.fullName || "Unknown User")}
          </strong>

          <small>
            ${escapeHtml(notification.user?.email || "")}
          </small>
        </div>
      </div>
    </div>

    <div class="notification-actions">
      <button
        type="button"
        class="delete-notification-button"
        data-delete-notification="${escapeHtml(notification.id)}"
      >
        Delete
      </button>
    </div>
  `;

  return article;
}

function renderNotifications() {
  elements.list.innerHTML = "";

  const hasNotifications =
    Array.isArray(state.notifications) && state.notifications.length > 0;

  showElement(elements.emptyState, !hasNotifications);

  if (!hasNotifications) {
    showContent();
    return;
  }

  const fragment = document.createDocumentFragment();

  state.notifications.forEach((notification) => {
    fragment.appendChild(createNotificationCard(notification));
  });

  elements.list.appendChild(fragment);

  showContent();
}

function renderPagination() {
  const pagination = state.pagination || {};

  setText(
    elements.paginationText,
    `Page ${pagination.currentPage || 1} of ${pagination.totalPages || 1}`,
  );

  if (elements.previousPageButton) {
    elements.previousPageButton.disabled = !pagination.hasPreviousPage;
  }

  if (elements.nextPageButton) {
    elements.nextPageButton.disabled = !pagination.hasNextPage;
  }

  showElement(elements.pagination, getNumber(pagination.totalPages) > 1);
}

function populateUsers(users) {
  if (!elements.recipientUserId) {
    return;
  }

  elements.recipientUserId.innerHTML = `
    <option value="">Choose a user</option>
  `;

  users.forEach((user) => {
    const option = document.createElement("option");

    option.value = user.id;

    option.textContent = `${user.fullName} — ${user.email} (${user.role})`;

    elements.recipientUserId.appendChild(option);
  });
}

function buildQueryString() {
  const params = new URLSearchParams();

  params.set("page", String(state.pagination.currentPage || 1));

  params.set("limit", "10");
  params.set("type", state.filters.type);
  params.set("status", state.filters.status);

  if (state.filters.search) {
    params.set("search", state.filters.search);
  }

  return params.toString();
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid response.");
  }

  return response.json();
}

async function loadNotifications() {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;

  showLoading();

  try {
    const response = await fetch(
      `/api/admin/notifications?${buildQueryString()}`,
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

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load administrator notifications.",
      );
    }

    state.notifications = Array.isArray(data.notifications)
      ? data.notifications
      : [];

    state.users = Array.isArray(data.users) ? data.users : [];

    state.summary = data.summary || {};

    state.pagination = data.pagination || {
      currentPage: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };

    renderSummary();
    populateUsers(state.users);
    renderNotifications();
    renderPagination();
  } catch (error) {
    console.error("Admin notifications error:", error);

    showError(error.message);
  } finally {
    state.isLoading = false;
  }
}

function openComposeModal() {
  elements.composeForm?.reset();

  if (elements.notificationIcon) {
    elements.notificationIcon.value = "🔔";
  }

  if (elements.recipientGroup) {
    elements.recipientGroup.value = "all";
  }

  showElement(elements.singleUserGroup, false);

  setText(elements.notificationMessageCount, "0");

  elements.composeMessage.className = "form-message";
  setText(elements.composeMessage, "");

  showElement(elements.composeModal, true);

  elements.composeModal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}

function closeComposeModal() {
  showElement(elements.composeModal, false);

  elements.composeModal.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";
}

function openDeleteModal(notificationId) {
  const notification = state.notifications.find(
    (item) => item.id === notificationId,
  );

  if (!notification) {
    return;
  }

  state.selectedNotification = notification;

  setText(
    elements.deleteDescription,
    `Delete "${notification.title}" for ${notification.user?.fullName || "this user"}?`,
  );

  elements.deleteMessage.className = "form-message";
  setText(elements.deleteMessage, "");

  showElement(elements.deleteModal, true);

  elements.deleteModal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}

function closeDeleteModal() {
  showElement(elements.deleteModal, false);

  elements.deleteModal.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";

  state.selectedNotification = null;
}

async function sendNotification(event) {
  event.preventDefault();

  const recipientGroup = elements.recipientGroup?.value || "all";

  const payload = {
    recipientGroup,
    userId:
      recipientGroup === "single" ? elements.recipientUserId?.value || "" : "",
    type: elements.notificationType?.value || "system",
    icon: elements.notificationIcon?.value.trim() || "🔔",
    title: elements.notificationTitle?.value.trim() || "",
    message: elements.notificationMessage?.value.trim() || "",
    link: elements.notificationLink?.value.trim() || "",
  };

  if (recipientGroup === "single" && !payload.userId) {
    elements.composeMessage.className = "form-message error";
    setText(elements.composeMessage, "Select a recipient.");
    return;
  }

  elements.sendButton.disabled = true;

  const originalText = elements.sendButton.textContent;

  elements.sendButton.textContent = "Sending...";

  try {
    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      credentials: "include",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to send notification.");
    }

    elements.composeMessage.className = "form-message success";
    setText(elements.composeMessage, data.message);

    state.pagination.currentPage = 1;

    await loadNotifications();

    setTimeout(closeComposeModal, 700);
  } catch (error) {
    console.error("Send notification error:", error);

    elements.composeMessage.className = "form-message error";

    setText(
      elements.composeMessage,
      error.message || "Unable to send notification.",
    );
  } finally {
    elements.sendButton.disabled = false;

    elements.sendButton.textContent = originalText || "Send Notification";
  }
}

async function deleteNotification() {
  const notification = state.selectedNotification;

  if (!notification) {
    return;
  }

  elements.confirmDeleteButton.disabled = true;

  const originalText = elements.confirmDeleteButton.textContent;

  elements.confirmDeleteButton.textContent = "Deleting...";

  try {
    const response = await fetch(
      `/api/admin/notifications/${encodeURIComponent(notification.id)}`,
      {
        method: "DELETE",
        credentials: "include",

        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to delete notification.");
    }

    closeDeleteModal();

    await loadNotifications();
  } catch (error) {
    console.error("Delete notification error:", error);

    elements.deleteMessage.className = "form-message error";

    setText(
      elements.deleteMessage,
      error.message || "Unable to delete notification.",
    );
  } finally {
    elements.confirmDeleteButton.disabled = false;

    elements.confirmDeleteButton.textContent =
      originalText || "Delete Notification";
  }
}

function debounce(callback, delay = 350) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

function initializeNotifications() {
  const delayedSearch = debounce(() => {
    state.filters.search = elements.searchInput?.value.trim() || "";

    state.pagination.currentPage = 1;

    loadNotifications();
  });

  elements.searchInput?.addEventListener("input", delayedSearch);

  elements.typeFilter?.addEventListener("change", () => {
    state.filters.type = elements.typeFilter.value || "all";

    state.pagination.currentPage = 1;

    loadNotifications();
  });

  elements.statusFilter?.addEventListener("change", () => {
    state.filters.status = elements.statusFilter.value || "all";

    state.pagination.currentPage = 1;

    loadNotifications();
  });

  elements.refreshButton?.addEventListener("click", loadNotifications);

  elements.retryButton?.addEventListener("click", loadNotifications);

  elements.previousPageButton?.addEventListener("click", () => {
    if (!state.pagination.hasPreviousPage) {
      return;
    }

    state.pagination.currentPage -= 1;

    loadNotifications();
  });

  elements.nextPageButton?.addEventListener("click", () => {
    if (!state.pagination.hasNextPage) {
      return;
    }

    state.pagination.currentPage += 1;

    loadNotifications();
  });

  elements.openComposeButton?.addEventListener("click", openComposeModal);

  elements.composeForm?.addEventListener("submit", sendNotification);

  elements.recipientGroup?.addEventListener("change", () => {
    const isSingle = elements.recipientGroup.value === "single";

    showElement(elements.singleUserGroup, isSingle);

    if (!isSingle && elements.recipientUserId) {
      elements.recipientUserId.value = "";
    }
  });

  elements.notificationMessage?.addEventListener("input", () => {
    setText(
      elements.notificationMessageCount,
      elements.notificationMessage.value.length,
    );
  });

  elements.list?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-notification]");

    if (!button) {
      return;
    }

    openDeleteModal(button.dataset.deleteNotification);
  });

  elements.confirmDeleteButton?.addEventListener("click", deleteNotification);

  document.querySelectorAll("[data-close-compose-modal]").forEach((element) => {
    element.addEventListener("click", closeComposeModal);
  });

  document.querySelectorAll("[data-close-delete-modal]").forEach((element) => {
    element.addEventListener("click", closeDeleteModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements.composeModal?.classList.contains("hidden")) {
      closeComposeModal();
    }

    if (!elements.deleteModal?.classList.contains("hidden")) {
      closeDeleteModal();
    }
  });

  loadNotifications();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNotifications, {
    once: true,
  });
} else {
  initializeNotifications();
}
