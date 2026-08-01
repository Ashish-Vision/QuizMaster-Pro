"use strict";

const state = {
  notifications: [],
  currentFilter: "all",
  currentPage: 1,
  totalPages: 1,
};

const elements = {
  loading: document.getElementById("notificationsLoading"),
  error: document.getElementById("notificationsError"),
  errorMessage: document.getElementById("notificationsErrorMessage"),
  retryButton: document.getElementById("notificationsRetryButton"),
  content: document.getElementById("notificationsContent"),

  list: document.getElementById("notificationsList"),
  empty: document.getElementById("notificationsEmpty"),

  total: document.getElementById("notificationTotal"),
  unread: document.getElementById("notificationUnread"),

  markAllReadButton: document.getElementById("markAllReadButton"),

  pagination: document.getElementById("notificationsPagination"),
  previousPageButton: document.getElementById("previousPageButton"),
  nextPageButton: document.getElementById("nextPageButton"),
  paginationText: document.getElementById("paginationText"),

  filterButtons: document.querySelectorAll("[data-filter]"),
};

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function showLoading() {
  toggleElement(elements.loading, true);
  toggleElement(elements.error, false);
  toggleElement(elements.content, false);
}

function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent =
      message || "Unable to load notifications.";
  }

  toggleElement(elements.loading, false);
  toggleElement(elements.error, true);
  toggleElement(elements.content, false);
}

function showContent() {
  toggleElement(elements.loading, false);
  toggleElement(elements.error, false);
  toggleElement(elements.content, true);
}

function formatRelativeTime(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getFilteredNotifications() {
  if (state.currentFilter === "all") {
    return state.notifications;
  }

  if (state.currentFilter === "unread") {
    return state.notifications.filter((notification) => !notification.isRead);
  }

  return state.notifications.filter(
    (notification) => notification.type === state.currentFilter,
  );
}

function createNotificationCard(notification) {
  const card = document.createElement("article");

  card.className = "notification-card";
  card.dataset.notificationId = notification.id || "";

  if (!notification.isRead) {
    card.classList.add("unread");
  }

  const icon = document.createElement("div");

  icon.className = "notification-icon";
  icon.textContent = notification.icon || "🔔";

  const content = document.createElement("div");

  content.className = "notification-card-content";

  const heading = document.createElement("div");

  heading.className = "notification-heading";

  const title = document.createElement("h2");

  title.textContent = notification.title || "Notification";

  const time = document.createElement("time");

  time.textContent = formatRelativeTime(notification.createdAt);

  heading.append(title, time);

  const message = document.createElement("p");

  message.textContent = notification.message || "";

  const metadata = document.createElement("div");

  metadata.className = "notification-metadata";

  const typeBadge = document.createElement("span");

  typeBadge.textContent = notification.type || "system";

  metadata.appendChild(typeBadge);

  content.append(heading, message, metadata);

  const actions = document.createElement("div");

  actions.className = "notification-actions";

  if (!notification.isRead) {
    const readButton = document.createElement("button");

    readButton.type = "button";
    readButton.className = "read-button";
    readButton.textContent = "Mark Read";

    readButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      await markNotificationAsRead(notification.id);
    });

    actions.appendChild(readButton);
  }

  const deleteButton = document.createElement("button");

  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Delete";

  deleteButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    await deleteNotification(notification.id);
  });

  actions.appendChild(deleteButton);

  card.append(icon, content, actions);

  if (notification.link) {
    card.tabIndex = 0;
    card.setAttribute("role", "link");

    card.addEventListener("click", async () => {
      if (!notification.isRead && notification.id) {
        await markNotificationAsRead(notification.id, false);
      }

      window.location.href = notification.link;
    });

    card.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();

      if (!notification.isRead && notification.id) {
        await markNotificationAsRead(notification.id, false);
      }

      window.location.href = notification.link;
    });
  }

  return card;
}

function renderNotifications() {
  if (!elements.list) {
    return;
  }

  const notifications = getFilteredNotifications();

  elements.list.innerHTML = "";

  toggleElement(elements.empty, notifications.length === 0);

  if (notifications.length > 0) {
    const fragment = document.createDocumentFragment();

    notifications.forEach((notification) => {
      fragment.appendChild(createNotificationCard(notification));
    });

    elements.list.appendChild(fragment);
  }

  const unreadCount = state.notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  if (elements.total) {
    elements.total.textContent = String(state.notifications.length);
  }

  if (elements.unread) {
    elements.unread.textContent = String(unreadCount);
  }

  if (elements.markAllReadButton) {
    elements.markAllReadButton.disabled = unreadCount === 0;
  }
}

function renderPagination(pagination = {}) {
  state.currentPage = Number(pagination.currentPage) || 1;
  state.totalPages = Number(pagination.totalPages) || 1;

  if (elements.paginationText) {
    elements.paginationText.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
  }

  if (elements.previousPageButton) {
    elements.previousPageButton.disabled = !Boolean(pagination.hasPreviousPage);
  }

  if (elements.nextPageButton) {
    elements.nextPageButton.disabled = !Boolean(pagination.hasNextPage);
  }

  toggleElement(elements.pagination, state.totalPages > 1);
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid response.");
  }

  return response.json();
}

async function loadNotifications() {
  showLoading();

  try {
    const response = await fetch(
      `/api/notifications?page=${state.currentPage}&limit=20&_=${Date.now()}`,
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

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load notifications.");
    }

    state.notifications = Array.isArray(data.notifications)
      ? data.notifications
      : [];

    renderNotifications();
    renderPagination(data.pagination);

    showContent();
  } catch (error) {
    console.error("Notification loading error:", error);

    showError(error.message || "Unable to load notifications.");
  }
}

async function markNotificationAsRead(notificationId, rerender = true) {
  if (!notificationId) {
    return false;
  }

  try {
    const response = await fetch(
      `/api/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: "PATCH",
        credentials: "include",

        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to update notification.");
    }

    const notification = state.notifications.find(
      (item) => item.id === notificationId,
    );

    if (notification) {
      notification.isRead = true;
      notification.readAt =
        data.notification?.readAt || new Date().toISOString();
    }

    if (rerender) {
      renderNotifications();
    }

    return true;
  } catch (error) {
    console.error("Mark notification read error:", error);

    window.alert(error.message || "Unable to update notification.");

    return false;
  }
}

async function markAllNotificationsAsRead() {
  if (!elements.markAllReadButton) {
    return;
  }

  const originalText = elements.markAllReadButton.textContent;

  elements.markAllReadButton.disabled = true;
  elements.markAllReadButton.textContent = "Updating...";

  try {
    const response = await fetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to mark notifications as read.");
    }

    state.notifications.forEach((notification) => {
      notification.isRead = true;
      notification.readAt = new Date().toISOString();
    });

    renderNotifications();
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    window.alert(error.message || "Unable to mark notifications as read.");
  } finally {
    elements.markAllReadButton.textContent = originalText || "Mark All as Read";

    renderNotifications();
  }
}

async function deleteNotification(notificationId) {
  if (!notificationId) {
    return;
  }

  const shouldDelete = window.confirm("Delete this notification?");

  if (!shouldDelete) {
    return;
  }

  try {
    const response = await fetch(
      `/api/notifications/${encodeURIComponent(notificationId)}`,
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

    state.notifications = state.notifications.filter(
      (notification) => notification.id !== notificationId,
    );

    renderNotifications();
  } catch (error) {
    console.error("Delete notification error:", error);

    window.alert(error.message || "Unable to delete notification.");
  }
}

function setFilter(filter) {
  state.currentFilter = filter || "all";

  elements.filterButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.filter === state.currentFilter,
    );
  });

  renderNotifications();
}

function initializeNotificationsPage() {
  if (!elements.loading || !elements.content || !elements.list) {
    console.error("Required notification page elements were not found.");

    return;
  }

  elements.retryButton?.addEventListener("click", loadNotifications);

  elements.markAllReadButton?.addEventListener(
    "click",
    markAllNotificationsAsRead,
  );

  elements.previousPageButton?.addEventListener("click", () => {
    if (state.currentPage <= 1) {
      return;
    }

    state.currentPage -= 1;
    loadNotifications();
  });

  elements.nextPageButton?.addEventListener("click", () => {
    if (state.currentPage >= state.totalPages) {
      return;
    }

    state.currentPage += 1;
    loadNotifications();
  });

  elements.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.filter || "all");
    });
  });

  loadNotifications();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNotificationsPage);
} else {
  initializeNotificationsPage();
}
