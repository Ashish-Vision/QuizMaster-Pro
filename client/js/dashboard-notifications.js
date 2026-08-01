"use strict";

const notificationElements = {
  button: document.getElementById("notificationButton"),

  badge: document.getElementById("notificationBadge"),

  dropdown: document.getElementById("notificationDropdown"),

  unreadText: document.getElementById("notificationDropdownCount"),

  list: document.getElementById("notificationDropdownList"),

  markAllReadButton: document.getElementById("markDropdownReadButton"),
};

const notificationState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
};

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function getSafeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNotificationTime(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const differenceSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );

  if (differenceSeconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(differenceSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function updateNotificationBadge(unreadCount) {
  const count = Math.max(0, getSafeNumber(unreadCount));

  notificationState.unreadCount = count;

  if (notificationElements.badge) {
    notificationElements.badge.textContent = count > 99 ? "99+" : String(count);

    toggleElement(notificationElements.badge, count > 0);
  }

  if (notificationElements.unreadText) {
    notificationElements.unreadText.textContent = `${count} unread`;
  }

  if (notificationElements.markAllReadButton) {
    notificationElements.markAllReadButton.disabled = count === 0;
  }
}

function createDropdownNotification(notification) {
  const item = document.createElement("a");

  item.className = "notification-dropdown-item";

  item.href = notification.link || "/notifications";

  item.dataset.notificationId = notification.id || "";

  if (!notification.isRead) {
    item.classList.add("unread");
  }

  const icon = document.createElement("span");

  icon.className = "notification-dropdown-icon";

  icon.textContent = notification.icon || "🔔";

  icon.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");

  content.className = "notification-dropdown-content";

  const title = document.createElement("strong");

  title.textContent = notification.title || "Notification";

  const message = document.createElement("p");

  message.textContent = notification.message || "";

  const time = document.createElement("small");

  time.textContent = formatNotificationTime(notification.createdAt);

  content.append(title, message, time);

  item.append(icon, content);

  item.addEventListener("click", async (event) => {
    if (notification.isRead || !notification.id) {
      return;
    }

    event.preventDefault();

    const destination = item.href;

    await markSingleNotificationAsRead(notification.id);

    window.location.href = destination;
  });

  return item;
}

function renderNotificationDropdown() {
  if (!notificationElements.list) {
    return;
  }

  notificationElements.list.innerHTML = "";

  if (notificationState.notifications.length === 0) {
    const emptyState = document.createElement("div");

    emptyState.className = "notification-dropdown-state";

    emptyState.textContent = "No notifications yet.";

    notificationElements.list.appendChild(emptyState);

    return;
  }

  const fragment = document.createDocumentFragment();

  notificationState.notifications.forEach((notification) => {
    fragment.appendChild(createDropdownNotification(notification));
  });

  notificationElements.list.appendChild(fragment);
}

function showNotificationLoading() {
  if (!notificationElements.list) {
    return;
  }

  notificationElements.list.innerHTML = `
    <div class="notification-dropdown-state">
      Loading notifications...
    </div>
  `;
}

function showNotificationError(message) {
  if (!notificationElements.list) {
    return;
  }

  notificationElements.list.innerHTML = "";

  const errorState = document.createElement("div");

  errorState.className = "notification-dropdown-state";

  errorState.textContent = message || "Unable to load notifications.";

  notificationElements.list.appendChild(errorState);
}

async function loadDashboardNotifications() {
  if (!notificationElements.list || notificationState.isLoading) {
    return;
  }

  notificationState.isLoading = true;

  showNotificationLoading();

  try {
    const response = await fetch("/api/notifications?limit=5&page=1", {
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
      throw new Error(data.message || "Unable to load notifications.");
    }

    notificationState.notifications = Array.isArray(data.notifications)
      ? data.notifications
      : [];

    updateNotificationBadge(data.unreadCount);

    renderNotificationDropdown();
  } catch (error) {
    console.error("Dashboard notification error:", error);

    showNotificationError(error.message);
  } finally {
    notificationState.isLoading = false;
  }
}

async function loadUnreadCount() {
  if (!notificationElements.badge) {
    return;
  }

  try {
    const response = await fetch("/api/notifications/unread-count", {
      method: "GET",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load unread count.");
    }

    updateNotificationBadge(data.unreadCount);
  } catch (error) {
    console.error("Unread notification count error:", error);
  }
}

async function markSingleNotificationAsRead(notificationId) {
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

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to mark notification as read.");
    }

    const notification = notificationState.notifications.find(
      (item) => item.id === notificationId,
    );

    if (notification && !notification.isRead) {
      notification.isRead = true;

      notification.readAt =
        data.notification?.readAt || new Date().toISOString();

      updateNotificationBadge(Math.max(notificationState.unreadCount - 1, 0));

      renderNotificationDropdown();
    }

    return true;
  } catch (error) {
    console.error("Mark notification read error:", error);

    return false;
  }
}

async function markAllNotificationsAsRead() {
  const button = notificationElements.markAllReadButton;

  if (!button) {
    return;
  }

  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Updating...";

  try {
    const response = await fetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to mark notifications as read.");
    }

    notificationState.notifications.forEach((notification) => {
      notification.isRead = true;

      notification.readAt = new Date().toISOString();
    });

    updateNotificationBadge(0);

    renderNotificationDropdown();
  } catch (error) {
    console.error("Mark all notifications read error:", error);

    window.alert(error.message || "Unable to mark notifications as read.");
  } finally {
    button.textContent = originalText || "Mark all read";

    button.disabled = notificationState.unreadCount === 0;
  }
}

function isDropdownOpen() {
  return Boolean(
    notificationElements.dropdown &&
    !notificationElements.dropdown.classList.contains("hidden"),
  );
}

function openNotificationDropdown() {
  if (!notificationElements.dropdown || !notificationElements.button) {
    return;
  }

  toggleElement(notificationElements.dropdown, true);

  notificationElements.button.setAttribute("aria-expanded", "true");

  loadDashboardNotifications();
}

function closeNotificationDropdown() {
  if (!notificationElements.dropdown || !notificationElements.button) {
    return;
  }

  toggleElement(notificationElements.dropdown, false);

  notificationElements.button.setAttribute("aria-expanded", "false");
}

function toggleNotificationDropdown() {
  if (isDropdownOpen()) {
    closeNotificationDropdown();
    return;
  }

  openNotificationDropdown();
}

function initializeDashboardNotifications() {
  if (!notificationElements.button || !notificationElements.dropdown) {
    return;
  }

  notificationElements.button.addEventListener("click", (event) => {
    event.stopPropagation();

    toggleNotificationDropdown();
  });

  notificationElements.dropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  notificationElements.markAllReadButton?.addEventListener(
    "click",
    markAllNotificationsAsRead,
  );

  document.addEventListener("click", closeNotificationDropdown);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNotificationDropdown();

      notificationElements.button.focus();
    }
  });

  loadUnreadCount();

  window.setInterval(loadUnreadCount, 60 * 1000);
}

document.addEventListener("DOMContentLoaded", initializeDashboardNotifications);
