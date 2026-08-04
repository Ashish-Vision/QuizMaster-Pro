"use strict";

const state = {
  achievements: [],
  recentUnlocks: [],
  summary: {},
  filters: {
    search: "",
    category: "all",
    sort: "most-unlocked",
  },
  isLoading: false,
  selectedAchievementCode: null,
};

const elements = {
  totalDefinitions: document.getElementById("totalDefinitions"),
  totalUnlocks: document.getElementById("totalUnlocks"),
  usersWithAchievements: document.getElementById("usersWithAchievements"),
  overallUnlockPercentage: document.getElementById("overallUnlockPercentage"),

  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  sortFilter: document.getElementById("sortFilter"),
  refreshButton: document.getElementById("refreshButton"),

  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  errorMessage: document.getElementById("errorMessage"),
  retryButton: document.getElementById("retryButton"),

  achievementGrid: document.getElementById("achievementGrid"),

  achievementModal: document.getElementById("achievementModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  closeModal: document.getElementById("closeModal"),
  modalBackdrop: document.querySelector("#achievementModal .modal-backdrop"),
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

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getNumber(value).toLocaleString("en-IN");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

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

function formatCategory(category) {
  const categoryNames = {
    quiz: "Quiz",
    xp: "XP",
    accuracy: "Accuracy",
    streak: "Streak",
    category: "Category Mastery",
  };

  return categoryNames[category] || category || "Unknown";
}

function getRequirementText(achievement) {
  switch (achievement.code) {
    case "FIRST_QUIZ":
    case "QUIZ_EXPLORER":
    case "QUIZ_MASTER":
      return `${formatNumber(achievement.threshold)} quiz${
        getNumber(achievement.threshold) === 1 ? "" : "zes"
      }`;

    case "XP_BEGINNER":
    case "XP_CHAMPION":
    case "XP_LEGEND":
      return `${formatNumber(achievement.threshold)} XP`;

    case "PERFECT_SCORE":
      return "Complete one quiz with 100% accuracy";

    case "ACCURACY_EXPERT":
      return `${formatNumber(
        achievement.threshold,
      )} quizzes with at least 90% accuracy`;

    case "STREAK_STARTER":
    case "STREAK_MASTER":
      return `${formatNumber(achievement.threshold)}-day quiz streak`;

    case "CATEGORY_SPECIALIST":
      return `${formatNumber(achievement.threshold)} quizzes in one category`;

    default:
      return String(achievement.threshold ?? "Unknown");
  }
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
  const fullName =
    user?.fullName ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Unknown User";

  if (user?.avatar) {
    return `
      <div
        class="user-avatar has-image"
        style="background-image: url('${escapeHtml(user.avatar)}')"
        role="img"
        aria-label="${escapeHtml(fullName)} profile picture"
      ></div>
    `;
  }

  return `
    <div class="user-avatar">
      ${escapeHtml(getInitials(user))}
    </div>
  `;
}

function showLoadingState() {
  showElement(elements.loadingState, true);
  showElement(elements.errorState, false);
  showElement(elements.achievementGrid, false);
}

function showErrorState(message) {
  setText(
    elements.errorMessage,
    message || "Unable to load administrator achievements.",
  );

  showElement(elements.loadingState, false);
  showElement(elements.errorState, true);
  showElement(elements.achievementGrid, false);
}

function showContentState() {
  showElement(elements.loadingState, false);
  showElement(elements.errorState, false);
  showElement(elements.achievementGrid, true);
}

function renderSummary() {
  const summary = state.summary || {};

  setText(elements.totalDefinitions, formatNumber(summary.totalDefinitions));

  setText(elements.totalUnlocks, formatNumber(summary.totalUnlocks));

  setText(
    elements.usersWithAchievements,
    formatNumber(summary.usersWithAchievements),
  );

  setText(
    elements.overallUnlockPercentage,
    `${getNumber(summary.overallUnlockPercentage)}%`,
  );
}

function createAchievementCard(achievement) {
  const article = document.createElement("article");

  article.className = "achievement-card";

  article.dataset.code = achievement.code;

  const unlockPercentage = Math.min(
    100,
    Math.max(0, getNumber(achievement.unlockPercentage)),
  );

  article.innerHTML = `
    <div class="achievement-card-header">
      <div class="achievement-icon">
        ${escapeHtml(achievement.icon || "🏆")}
      </div>

      <span class="category-badge">
        ${escapeHtml(formatCategory(achievement.category))}
      </span>
    </div>

    <div class="achievement-card-content">
      <h2>
        ${escapeHtml(achievement.title || "Achievement")}
      </h2>

      <span class="achievement-code">
        ${escapeHtml(achievement.code || "")}
      </span>

      <p>
        ${escapeHtml(achievement.description || "")}
      </p>

      <div class="achievement-requirement">
        <span>Requirement</span>

        <strong>
          ${escapeHtml(getRequirementText(achievement))}
        </strong>
      </div>

      <div class="unlock-stat">
        <div class="unlock-stat-header">
          <span>
            ${formatNumber(achievement.unlockCount)} unlocks
          </span>

          <strong>
            ${unlockPercentage}%
          </strong>
        </div>

        <div class="unlock-progress">
          <div
            class="unlock-progress-fill"
            style="width: ${unlockPercentage}%"
          ></div>
        </div>
      </div>
    </div>

    <div class="achievement-card-footer">
      <small>
        Latest:
        ${escapeHtml(formatDate(achievement.latestUnlockAt))}
      </small>

      <button
        type="button"
        class="view-button"
        data-view-achievement="${escapeHtml(achievement.code)}"
      >
        View Users
      </button>
    </div>
  `;

  return article;
}

function renderAchievements() {
  if (!elements.achievementGrid) {
    return;
  }

  elements.achievementGrid.innerHTML = "";

  if (!Array.isArray(state.achievements) || state.achievements.length === 0) {
    elements.achievementGrid.innerHTML = `
      <div class="state-card">
        <span class="state-icon">🔎</span>

        <h2>No achievements found</h2>

        <p>
          No achievement definitions match the selected filters.
        </p>
      </div>
    `;

    showContentState();

    return;
  }

  const fragment = document.createDocumentFragment();

  state.achievements.forEach((achievement) => {
    fragment.appendChild(createAchievementCard(achievement));
  });

  elements.achievementGrid.appendChild(fragment);

  showContentState();
}

function renderModalLoading() {
  setText(elements.modalTitle, "Loading Achievement");

  elements.modalBody.innerHTML = `
    <div class="modal-empty-state">
      <div class="spinner"></div>
      <p>Loading achievement details...</p>
    </div>
  `;
}

function renderModalError(message) {
  setText(elements.modalTitle, "Unable to Load Achievement");

  elements.modalBody.innerHTML = `
    <div class="modal-empty-state">
      <p>
        ${escapeHtml(message || "Something went wrong.")}
      </p>
    </div>
  `;
}

function renderAchievementModal(data) {
  const achievement = data.achievement || {};
  const unlockedUsers = Array.isArray(data.unlockedUsers)
    ? data.unlockedUsers
    : [];

  setText(elements.modalTitle, achievement.title || "Achievement Details");

  const unlockedUsersMarkup =
    unlockedUsers.length > 0
      ? unlockedUsers
          .map((record) => {
            const user = record.user || {};

            return `
              <article class="unlocked-user-row">
                <div class="user-identity">
                  ${createAvatarMarkup(user)}

                  <div>
                    <strong>
                      ${escapeHtml(user.fullName || "Unknown User")}
                    </strong>

                    <small>
                      ${escapeHtml(user.email || "")}
                    </small>
                  </div>
                </div>

                <small>
                  ${escapeHtml(formatDateTime(record.unlockedAt))}
                </small>
              </article>
            `;
          })
          .join("")
      : `
          <div class="modal-empty-state">
            No users have unlocked this achievement yet.
          </div>
        `;

  elements.modalBody.innerHTML = `
    <div class="modal-achievement-summary">
      <div class="modal-achievement-icon">
        ${escapeHtml(achievement.icon || "🏆")}
      </div>

      <div>
        <strong>
          ${escapeHtml(achievement.title || "Achievement")}
        </strong>

        <p>
          ${escapeHtml(achievement.description || "")}
        </p>
      </div>
    </div>

    <div class="modal-stat-grid">
      <article class="modal-stat-card">
        <span>Category</span>

        <strong>
          ${escapeHtml(formatCategory(achievement.category))}
        </strong>
      </article>

      <article class="modal-stat-card">
        <span>Requirement</span>

        <strong>
          ${escapeHtml(getRequirementText(achievement))}
        </strong>
      </article>

      <article class="modal-stat-card">
        <span>Total Unlocks</span>

        <strong>
          ${formatNumber(achievement.unlockCount)}
        </strong>
      </article>

      <article class="modal-stat-card">
        <span>Unlock Percentage</span>

        <strong>
          ${getNumber(achievement.unlockPercentage)}%
        </strong>
      </article>
    </div>

    <div class="unlocked-users-list">
      ${unlockedUsersMarkup}
    </div>
  `;
}

function openModal() {
  if (!elements.achievementModal) {
    return;
  }

  showElement(elements.achievementModal, true);

  elements.achievementModal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!elements.achievementModal) {
    return;
  }

  showElement(elements.achievementModal, false);

  elements.achievementModal.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";

  state.selectedAchievementCode = null;
}

async function loadAchievementDetails(code) {
  if (!code) {
    return;
  }

  state.selectedAchievementCode = code;

  openModal();
  renderModalLoading();

  try {
    const response = await fetch(
      `/api/admin/achievements/${encodeURIComponent(code)}`,
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
      throw new Error("The server returned an invalid achievement response.");
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load achievement details.");
    }

    renderAchievementModal(data);
  } catch (error) {
    console.error("Achievement details error:", error);

    renderModalError(error.message);
  }
}

function buildQueryString() {
  const parameters = new URLSearchParams();

  if (state.filters.search) {
    parameters.set("search", state.filters.search);
  }

  parameters.set("category", state.filters.category);
  parameters.set("sort", state.filters.sort);

  return parameters.toString();
}

async function loadAchievements() {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;

  showLoadingState();

  try {
    const queryString = buildQueryString();

    const response = await fetch(`/api/admin/achievements?${queryString}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",

      headers: {
        Accept: "application/json",
      },
    });

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
      throw new Error("The server returned an invalid achievements response.");
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load administrator achievements.",
      );
    }

    state.achievements = Array.isArray(data.achievements)
      ? data.achievements
      : [];

    state.recentUnlocks = Array.isArray(data.recentUnlocks)
      ? data.recentUnlocks
      : [];

    state.summary = data.summary || {};

    renderSummary();
    renderAchievements();
  } catch (error) {
    console.error("Admin achievements error:", error);

    showErrorState(error.message);
  } finally {
    state.isLoading = false;
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

function initializeAchievements() {
  const delayedSearch = debounce(() => {
    state.filters.search = elements.searchInput?.value.trim() || "";

    loadAchievements();
  });

  elements.searchInput?.addEventListener("input", delayedSearch);

  elements.categoryFilter?.addEventListener("change", () => {
    state.filters.category = elements.categoryFilter.value || "all";

    loadAchievements();
  });

  elements.sortFilter?.addEventListener("change", () => {
    const value = elements.sortFilter.value;

    state.filters.sort =
      value === "name" ? "title-asc" : value || "most-unlocked";

    loadAchievements();
  });

  elements.refreshButton?.addEventListener("click", loadAchievements);

  elements.retryButton?.addEventListener("click", loadAchievements);

  elements.achievementGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-achievement]");

    if (!button) {
      return;
    }

    loadAchievementDetails(button.dataset.viewAchievement);
  });

  elements.closeModal?.addEventListener("click", closeModal);

  elements.modalBackdrop?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !elements.achievementModal?.classList.contains("hidden")
    ) {
      closeModal();
    }
  });

  loadAchievements();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAchievements, {
    once: true,
  });
} else {
  initializeAchievements();
}
