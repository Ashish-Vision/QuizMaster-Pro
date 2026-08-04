"use strict";

const state = {
  logs: [],
  summary: {},
  pagination: {
    currentPage: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  filters: {
    search: "",
    action: "ALL",
    entityType: "all",
  },
  selectedLog: null,
  isLoading: false,
};

const elements = {
  totalLogsCount: document.getElementById("totalLogsCount"),
  todayLogsCount: document.getElementById("todayLogsCount"),
  exportLogsCount: document.getElementById("exportLogsCount"),
  systemLogsCount: document.getElementById("systemLogsCount"),

  searchInput: document.getElementById("activitySearchInput"),
  actionFilter: document.getElementById("activityActionFilter"),
  entityFilter: document.getElementById("activityEntityFilter"),
  refreshButton: document.getElementById("refreshActivityLogsButton"),

  loadingState: document.getElementById("activityLoadingState"),
  errorState: document.getElementById("activityErrorState"),
  errorMessage: document.getElementById("activityErrorMessage"),
  retryButton: document.getElementById("retryActivityLogsButton"),
  content: document.getElementById("activityContent"),
  emptyState: document.getElementById("activityEmptyState"),

  tableBody: document.getElementById("activityLogsTableBody"),

  pagination: document.getElementById("activityPagination"),
  paginationText: document.getElementById("activityPaginationText"),
  previousPageButton: document.getElementById("previousActivityPage"),
  nextPageButton: document.getElementById("nextActivityPage"),

  detailsModal: document.getElementById("activityDetailsModal"),
  detailsAdministrator: document.getElementById("detailsAdministrator"),
  detailsAdministratorEmail: document.getElementById(
    "detailsAdministratorEmail",
  ),
  detailsAction: document.getElementById("detailsAction"),
  detailsEntityType: document.getElementById("detailsEntityType"),
  detailsEntityId: document.getElementById("detailsEntityId"),
  detailsIpAddress: document.getElementById("detailsIpAddress"),
  detailsDescription: document.getElementById("detailsDescription"),
  detailsCreatedAt: document.getElementById("detailsCreatedAt"),
  detailsUserAgent: document.getElementById("detailsUserAgent"),
  detailsMetadata: document.getElementById("detailsMetadata"),
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
    second: "2-digit",
  }).format(date);
}

function getInitials(admin) {
  if (!admin) {
    return "A";
  }

  const firstInitial = String(admin.firstName || "")
    .charAt(0)
    .toUpperCase();

  const lastInitial = String(admin.lastName || "")
    .charAt(0)
    .toUpperCase();

  return `${firstInitial}${lastInitial}` || "A";
}

function createAdminAvatarMarkup(admin) {
  const fullName = admin?.fullName || "Unknown Administrator";

  if (admin?.avatar) {
    return `
      <div
        class="admin-avatar has-image"
        style="background-image:url('${escapeHtml(admin.avatar)}')"
        role="img"
        aria-label="${escapeHtml(fullName)} profile picture"
      ></div>
    `;
  }

  return `
    <div class="admin-avatar">
      ${escapeHtml(getInitials(admin))}
    </div>
  `;
}

function getActionClass(action) {
  return `action-${String(action || "system")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function showLoadingState() {
  showElement(elements.loadingState, true);
  showElement(elements.errorState, false);
  showElement(elements.content, false);
}

function showErrorState(message) {
  setText(
    elements.errorMessage,
    message || "Unable to load administrator activity logs.",
  );

  showElement(elements.loadingState, false);
  showElement(elements.errorState, true);
  showElement(elements.content, false);
}

function showContentState() {
  showElement(elements.loadingState, false);
  showElement(elements.errorState, false);
  showElement(elements.content, true);
}

function renderSummary() {
  const summary = state.summary || {};

  setText(elements.totalLogsCount, formatNumber(summary.totalLogs));

  setText(elements.todayLogsCount, formatNumber(summary.todayLogs));

  setText(elements.exportLogsCount, formatNumber(summary.exportLogs));

  setText(elements.systemLogsCount, formatNumber(summary.systemLogs));
}

function createActivityRow(log) {
  const row = document.createElement("tr");

  const admin = log.admin || null;

  const adminName = admin?.fullName || "Unknown Administrator";

  const adminEmail = admin?.email || "";

  const action = log.action || "SYSTEM";

  const entityType = log.entityType || "System";

  row.innerHTML = `
    <td>
      <div class="admin-info">
        ${createAdminAvatarMarkup(admin)}

        <div>
          <strong>${escapeHtml(adminName)}</strong>

          <small>${escapeHtml(adminEmail)}</small>
        </div>
      </div>
    </td>

    <td>
      <span class="action-badge ${getActionClass(action)}">
        ${escapeHtml(action)}
      </span>
    </td>

    <td>
      <span class="entity-badge">
        ${escapeHtml(entityType)}
      </span>
    </td>

    <td class="description-cell">
      ${escapeHtml(log.description || "No description")}
    </td>

    <td class="ip-address">
      ${escapeHtml(log.ipAddress || "Not available")}
    </td>

    <td class="date-cell">
      ${escapeHtml(formatDateTime(log.createdAt))}
    </td>

    <td>
      <button
        type="button"
        class="details-button"
        data-view-activity="${escapeHtml(log.id)}"
      >
        View
      </button>
    </td>
  `;

  return row;
}

function renderLogs() {
  elements.tableBody.innerHTML = "";

  const hasLogs = Array.isArray(state.logs) && state.logs.length > 0;

  showElement(elements.emptyState, !hasLogs);

  if (!hasLogs) {
    showContentState();
    return;
  }

  const fragment = document.createDocumentFragment();

  state.logs.forEach((log) => {
    fragment.appendChild(createActivityRow(log));
  });

  elements.tableBody.appendChild(fragment);

  showContentState();
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

function buildQueryString() {
  const params = new URLSearchParams();

  params.set("page", String(state.pagination.currentPage || 1));

  params.set("limit", "15");
  params.set("action", state.filters.action);
  params.set("entityType", state.filters.entityType);

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

async function loadSummary() {
  const response = await fetch("/api/admin/activity-logs/summary", {
    method: "GET",
    credentials: "include",
    cache: "no-store",

    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 401) {
    window.location.href = "/login";
    return null;
  }

  if (response.status === 403) {
    window.location.href = "/dashboard";
    return null;
  }

  const data = await parseJsonResponse(response);

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load activity summary.");
  }

  return data.summary || {};
}

async function loadLogs() {
  const response = await fetch(
    `/api/admin/activity-logs?${buildQueryString()}`,
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
    return null;
  }

  if (response.status === 403) {
    window.location.href = "/dashboard";
    return null;
  }

  const data = await parseJsonResponse(response);

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load activity logs.");
  }

  return data;
}

async function loadActivityLogs() {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;

  if (elements.refreshButton) {
    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = "Loading...";
  }

  showLoadingState();

  try {
    const [summary, logData] = await Promise.all([loadSummary(), loadLogs()]);

    if (!summary || !logData) {
      return;
    }

    state.summary = summary;

    state.logs = Array.isArray(logData.logs) ? logData.logs : [];

    state.pagination = logData.pagination || {
      currentPage: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };

    renderSummary();
    renderLogs();
    renderPagination();
  } catch (error) {
    console.error("Activity log loading error:", error);

    showErrorState(error.message || "Unable to load activity logs.");
  } finally {
    state.isLoading = false;

    if (elements.refreshButton) {
      elements.refreshButton.disabled = false;
      elements.refreshButton.textContent = "Refresh Logs";
    }
  }
}

function openDetailsModal(logId) {
  const log = state.logs.find((item) => item.id === logId);

  if (!log) {
    return;
  }

  state.selectedLog = log;

  setText(
    elements.detailsAdministrator,
    log.admin?.fullName || "Unknown Administrator",
  );

  setText(
    elements.detailsAdministratorEmail,
    log.admin?.email || "Not available",
  );

  setText(elements.detailsAction, log.action || "Unknown");

  setText(elements.detailsEntityType, log.entityType || "Unknown");

  setText(elements.detailsEntityId, log.entityId || "Not available");

  setText(elements.detailsIpAddress, log.ipAddress || "Not available");

  setText(elements.detailsDescription, log.description || "Not available");

  setText(elements.detailsCreatedAt, formatDateTime(log.createdAt));

  setText(elements.detailsUserAgent, log.userAgent || "Not available");

  if (elements.detailsMetadata) {
    elements.detailsMetadata.textContent = JSON.stringify(
      log.metadata || {},
      null,
      2,
    );
  }

  showElement(elements.detailsModal, true);

  elements.detailsModal?.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}

function closeDetailsModal() {
  showElement(elements.detailsModal, false);

  elements.detailsModal?.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";

  state.selectedLog = null;
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

function initializeActivityLogs() {
  const delayedSearch = debounce(() => {
    state.filters.search = elements.searchInput?.value.trim() || "";

    state.pagination.currentPage = 1;

    loadActivityLogs();
  });

  elements.searchInput?.addEventListener("input", delayedSearch);

  elements.actionFilter?.addEventListener("change", () => {
    state.filters.action = elements.actionFilter.value || "ALL";

    state.pagination.currentPage = 1;

    loadActivityLogs();
  });

  elements.entityFilter?.addEventListener("change", () => {
    state.filters.entityType = elements.entityFilter.value || "all";

    state.pagination.currentPage = 1;

    loadActivityLogs();
  });

  elements.refreshButton?.addEventListener("click", loadActivityLogs);

  elements.retryButton?.addEventListener("click", loadActivityLogs);

  elements.previousPageButton?.addEventListener("click", () => {
    if (!state.pagination.hasPreviousPage) {
      return;
    }

    state.pagination.currentPage -= 1;

    loadActivityLogs();
  });

  elements.nextPageButton?.addEventListener("click", () => {
    if (!state.pagination.hasNextPage) {
      return;
    }

    state.pagination.currentPage += 1;

    loadActivityLogs();
  });

  elements.tableBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-activity]");

    if (!button) {
      return;
    }

    openDetailsModal(button.dataset.viewActivity);
  });

  document
    .querySelectorAll("[data-close-activity-modal]")
    .forEach((element) => {
      element.addEventListener("click", closeDetailsModal);
    });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!elements.detailsModal?.classList.contains("hidden")) {
      closeDetailsModal();
    }
  });

  loadActivityLogs();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeActivityLogs, {
    once: true,
  });
} else {
  initializeActivityLogs();
}
