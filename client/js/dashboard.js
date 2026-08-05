"use strict";

/* ============================================================
   DOM Elements
============================================================ */

const elements = {
  categoriesContainer: document.getElementById("categoriesContainer"),

  searchInput: document.getElementById("searchInput"),

  logoutButton: document.getElementById("logoutButton"),

  leaderboardList: document.getElementById("leaderboardList"),

  leaderboardPlayerCount: document.getElementById("leaderboardPlayerCount"),

  currentUserRank: document.getElementById("currentUserRank"),
  dashboardAchievementProgress: document.getElementById(
    "dashboardAchievementProgress",
  ),

  dashboardAchievementPercentage: document.getElementById(
    "dashboardAchievementPercentage",
  ),

  dashboardAchievementTrack: document.getElementById(
    "dashboardAchievementTrack",
  ),

  dashboardAchievementFill: document.getElementById("dashboardAchievementFill"),

  dashboardAchievementsList: document.getElementById(
    "dashboardAchievementsList",
  ),
  notificationButton: document.getElementById("notificationButton"),

  notificationBadge: document.getElementById("notificationBadge"),

  notificationDropdown: document.getElementById("notificationDropdown"),

  notificationDropdownCount: document.getElementById(
    "notificationDropdownCount",
  ),

  notificationDropdownList: document.getElementById("notificationDropdownList"),

  markDropdownReadButton: document.getElementById("markDropdownReadButton"),
};

/* ============================================================
   Category Information
============================================================ */

const categoryDetails = {
  Java: {
    icon: "☕",
    description: "OOP, collections, exceptions, inheritance and threads.",
  },

  Python: {
    icon: "🐍",
    description: "Functions, lists, dictionaries, OOP and exceptions.",
  },

  C: {
    icon: "💻",
    description: "Pointers, arrays, functions, memory and fundamentals.",
  },

  DBMS: {
    icon: "🗄️",
    description: "SQL, keys, normalization, joins and transactions.",
  },

  "Operating Systems": {
    icon: "🖥️",
    description: "Processes, scheduling, memory, paging and deadlocks.",
  },

  "Computer Networks": {
    icon: "🌐",
    description: "TCP/IP, DNS, HTTP, routing and network protocols.",
  },
};

let categories = [];

function handleUnauthorizedResponse(response) {
  if (response.status !== 401) {
    return false;
  }

  localStorage.removeItem("quizmaster_user");
  localStorage.removeItem("quizProgress");
  localStorage.removeItem("quizAnswers");

  window.location.replace("/login");

  return true;
}

/* ============================================================
   Category Functions
============================================================ */

function getCategoryDetails(category) {
  return (
    categoryDetails[category] || {
      icon: "🧠",
      description:
        "Challenge your knowledge with questions from this category.",
    }
  );
}

function openQuiz(category) {
  const encodedCategory = encodeURIComponent(category);

  window.location.href = `/quiz?category=${encodedCategory}`;
}

function createCategoryCard(category) {
  const details = getCategoryDetails(category);

  const card = document.createElement("article");

  card.className = "category-card";
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Start ${category} quiz`);

  const topSection = document.createElement("div");

  const icon = document.createElement("div");

  icon.className = "category-icon";
  icon.textContent = details.icon;
  icon.setAttribute("aria-hidden", "true");

  const title = document.createElement("h3");

  title.textContent = category;

  const description = document.createElement("p");

  description.textContent = details.description;

  topSection.append(icon, title, description);

  const footer = document.createElement("div");

  footer.className = "category-footer";

  const difficulty = document.createElement("span");

  difficulty.className = "category-difficulty";
  difficulty.textContent = "Easy • Medium • Hard";

  const start = document.createElement("span");

  start.className = "category-start";
  start.textContent = "Start Quiz →";

  footer.append(difficulty, start);

  card.append(topSection, footer);

  card.addEventListener("click", () => {
    openQuiz(category);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      openQuiz(category);
    }
  });

  return card;
}

function renderCategories(categoryList) {
  if (!elements.categoriesContainer) {
    return;
  }

  elements.categoriesContainer.innerHTML = "";

  if (categoryList.length === 0) {
    const emptyMessage = document.createElement("div");

    emptyMessage.className = "category-empty";
    emptyMessage.textContent = "No quiz categories match your search.";

    elements.categoriesContainer.appendChild(emptyMessage);

    return;
  }

  categoryList.forEach((category) => {
    const categoryCard = createCategoryCard(category);

    elements.categoriesContainer.appendChild(categoryCard);
  });
}

async function loadCategories() {
  if (!elements.categoriesContainer) {
    return;
  }

  elements.categoriesContainer.innerHTML = `
    <div class="category-loading">
      Loading quiz categories...
    </div>
  `;

  try {
    const response = await fetch("/api/quiz/categories", {
      method: "GET",

      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load quiz categories.");
    }

    if (!Array.isArray(data.categories)) {
      throw new Error("The categories response is invalid.");
    }

    categories = data.categories;

    renderCategories(categories);
  } catch (error) {
    console.error("Category loading error:", error);

    elements.categoriesContainer.innerHTML = "";

    const errorMessage = document.createElement("div");

    errorMessage.className = "category-error";

    errorMessage.textContent = error.message || "An unexpected error occurred.";

    elements.categoriesContainer.appendChild(errorMessage);
  }
}

function filterCategories() {
  if (!elements.searchInput) {
    return;
  }

  const searchTerm = elements.searchInput.value.trim().toLowerCase();

  const filteredCategories = categories.filter((category) =>
    category.toLowerCase().includes(searchTerm),
  );

  renderCategories(filteredCategories);
}

/* ============================================================
   Leaderboard Functions
============================================================ */

function getRankIcon(rank) {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return `#${rank}`;
}

function getInitials(firstName, lastName) {
  const firstInitial = firstName?.trim().charAt(0) || "";

  const lastInitial = lastName?.trim().charAt(0) || "";

  return `${firstInitial}${lastInitial}`.toUpperCase() || "U";
}

function createPlayerAvatar(player) {
  const avatar = document.createElement("div");

  avatar.className = "leaderboard-avatar";

  if (player.avatar) {
    const image = document.createElement("img");

    image.className = "leaderboard-avatar-image";
    image.src = player.avatar;
    image.alt = `${player.fullName || "Player"} avatar`;

    image.addEventListener("error", () => {
      avatar.innerHTML = "";

      const initials = document.createElement("span");

      initials.className = "leaderboard-avatar-initials";

      initials.textContent = getInitials(player.firstName, player.lastName);

      avatar.appendChild(initials);
    });

    avatar.appendChild(image);
  } else {
    const initials = document.createElement("span");

    initials.className = "leaderboard-avatar-initials";

    initials.textContent = getInitials(player.firstName, player.lastName);

    avatar.appendChild(initials);
  }

  return avatar;
}

function createLeaderboardPlayer(player) {
  const row = document.createElement("article");

  row.className = "leaderboard-row";

  if (player.isCurrentUser) {
    row.classList.add("current-player");
  }

  const rank = document.createElement("div");

  rank.className = `leaderboard-rank rank-${player.rank}`;

  rank.textContent = getRankIcon(player.rank);

  const playerSection = document.createElement("div");

  playerSection.className = "leaderboard-player";

  const avatar = createPlayerAvatar(player);

  const playerDetails = document.createElement("div");

  playerDetails.className = "leaderboard-player-details";

  const playerName = document.createElement("strong");

  playerName.textContent =
    player.fullName ||
    `${player.firstName || ""} ${player.lastName || ""}`.trim() ||
    "Unknown Player";

  if (player.isCurrentUser) {
    const youBadge = document.createElement("span");

    youBadge.className = "you-badge";
    youBadge.textContent = "You";

    playerName.appendChild(youBadge);
  }

  const correctAnswers = document.createElement("span");

  correctAnswers.textContent = `${Number(player.correctAnswers) || 0} correct answers`;

  playerDetails.append(playerName, correctAnswers);

  playerSection.append(avatar, playerDetails);

  const quizzes = document.createElement("div");

  quizzes.className = "leaderboard-quizzes";
  quizzes.textContent = Number(player.quizzesCompleted) || 0;

  const xp = document.createElement("div");

  xp.className = "leaderboard-xp";
  xp.textContent = `${Number(player.totalXp) || 0} XP`;

  row.append(rank, playerSection, quizzes, xp);

  return row;
}

function renderLeaderboard(data) {
  if (!elements.leaderboardList) {
    return;
  }

  elements.leaderboardList.innerHTML = "";

  const players = Array.isArray(data.leaderboard) ? data.leaderboard : [];

  const totalPlayers = Number(data.totalPlayers) || players.length;

  if (elements.leaderboardPlayerCount) {
    elements.leaderboardPlayerCount.textContent = `${totalPlayers} ${
      totalPlayers === 1 ? "player" : "players"
    }`;
  }

  if (players.length === 0) {
    elements.leaderboardList.innerHTML = `
      <div class="leaderboard-empty">
        <span aria-hidden="true">🏆</span>
        <h3>No rankings available yet</h3>
        <p>Complete a quiz to enter the leaderboard.</p>
      </div>
    `;

    return;
  }

  players.forEach((player) => {
    const playerRow = createLeaderboardPlayer(player);

    elements.leaderboardList.appendChild(playerRow);
  });

  renderCurrentUserRank(data.currentUser);
}

function renderCurrentUserRank(currentUser) {
  if (!elements.currentUserRank) {
    return;
  }

  /*
   * Show the separate rank card only when the current
   * user is not included in the displayed top players.
   */
  if (currentUser && Number(currentUser.rank) > 10) {
    elements.currentUserRank.hidden = false;
    elements.currentUserRank.innerHTML = "";

    const label = document.createElement("span");

    label.textContent = "Your current rank";

    const rank = document.createElement("strong");

    rank.textContent = `#${currentUser.rank}`;

    const xp = document.createElement("span");

    xp.textContent = `${Number(currentUser.totalXp) || 0} XP`;

    elements.currentUserRank.append(label, rank, xp);
  } else {
    elements.currentUserRank.hidden = true;
    elements.currentUserRank.innerHTML = "";
  }
}

function renderLeaderboardError(message) {
  if (!elements.leaderboardList) {
    return;
  }

  elements.leaderboardList.innerHTML = `
    <div class="leaderboard-empty">
      <span aria-hidden="true">⚠️</span>
      <h3>Unable to load leaderboard</h3>
      <p>${message}</p>
    </div>
  `;
}

async function loadLeaderboard() {
  if (!elements.leaderboardList) {
    return;
  }

  elements.leaderboardList.innerHTML = `
    <div class="leaderboard-loading">
      Loading leaderboard...
    </div>
  `;

  try {
    const response = await fetch("/api/leaderboard", {
      method: "GET",

      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load leaderboard.");
    }

    renderLeaderboard(data);
  } catch (error) {
    console.error("Leaderboard error:", error);

    renderLeaderboardError(
      error.message || "Please refresh the dashboard and try again.",
    );
  }
}

/* ============================================================
   Achievement Functions
============================================================ */

function formatAchievementDate(dateValue) {
  if (!dateValue) {
    return "Unlocked";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unlocked";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function createDashboardAchievementItem(achievement) {
  const item = document.createElement("article");

  item.className = "dashboard-achievement-item";

  const icon = document.createElement("span");

  icon.className = "dashboard-achievement-item-icon";

  icon.textContent = achievement.icon || "🏆";

  icon.setAttribute("aria-hidden", "true");

  const information = document.createElement("div");

  const title = document.createElement("h3");

  title.textContent = achievement.title || "Achievement";

  const unlockDate = document.createElement("p");

  unlockDate.textContent = `Unlocked ${formatAchievementDate(
    achievement.unlockedAt,
  )}`;

  information.append(title, unlockDate);

  item.append(icon, information);

  return item;
}

function renderDashboardAchievements(data) {
  if (!elements.dashboardAchievementsList) {
    return;
  }

  const achievements = Array.isArray(data.achievements)
    ? data.achievements
    : [];

  const unlockedAchievements = achievements
    .filter((achievement) => achievement.isUnlocked)
    .sort(
      (firstAchievement, secondAchievement) =>
        new Date(secondAchievement.unlockedAt || 0) -
        new Date(firstAchievement.unlockedAt || 0),
    );

  const totalAchievements = Number(data.totalAchievements) || 0;

  const unlockedCount = Number(data.unlockedCount) || 0;

  const percentage =
    totalAchievements > 0
      ? Math.round((unlockedCount / totalAchievements) * 100)
      : 0;

  if (elements.dashboardAchievementProgress) {
    elements.dashboardAchievementProgress.textContent = `${unlockedCount} of ${totalAchievements} achievements unlocked`;
  }

  if (elements.dashboardAchievementPercentage) {
    elements.dashboardAchievementPercentage.textContent = `${percentage}%`;
  }

  if (elements.dashboardAchievementFill) {
    elements.dashboardAchievementFill.style.width = `${percentage}%`;
  }

  if (elements.dashboardAchievementTrack) {
    elements.dashboardAchievementTrack.setAttribute(
      "aria-valuenow",
      String(percentage),
    );
  }

  elements.dashboardAchievementsList.innerHTML = "";

  if (unlockedAchievements.length === 0) {
    elements.dashboardAchievementsList.innerHTML = `
      <div class="dashboard-achievement-empty">
        Complete a quiz to unlock your first achievement.
      </div>
    `;

    return;
  }

  const recentAchievements = unlockedAchievements.slice(0, 4);

  const fragment = document.createDocumentFragment();

  recentAchievements.forEach((achievement) => {
    fragment.appendChild(createDashboardAchievementItem(achievement));
  });

  elements.dashboardAchievementsList.appendChild(fragment);
}

function renderDashboardAchievementError(message) {
  if (!elements.dashboardAchievementsList) {
    return;
  }

  elements.dashboardAchievementsList.innerHTML = `
    <div class="dashboard-achievement-error">
      ${message}
    </div>
  `;

  if (elements.dashboardAchievementProgress) {
    elements.dashboardAchievementProgress.textContent =
      "Achievement information unavailable";
  }
}

async function loadDashboardAchievements() {
  if (!elements.dashboardAchievementsList) {
    return;
  }

  try {
    const response = await fetch("/api/achievements", {
      method: "GET",

      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    if (handleUnauthorizedResponse(response)) {
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load achievements.");
    }

    renderDashboardAchievements(data);
  } catch (error) {
    console.error("Dashboard achievement error:", error);

    renderDashboardAchievementError(
      error.message || "Unable to load achievements.",
    );
  }
}

/* ============================================================
   Logout
============================================================ */

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
    localStorage.removeItem("quizProgress");
    localStorage.removeItem("quizAnswers");

    window.location.href = "/login";
  } catch (error) {
    console.error("Logout error:", error);

    alert(error.message || "Unable to log out. Please try again.");

    elements.logoutButton.disabled = false;
    elements.logoutButton.textContent = "Logout";
  }
}

/* ============================================================
   Event Listeners
============================================================ */

function initializeDashboard() {
  if (elements.searchInput) {
    elements.searchInput.addEventListener("input", filterCategories);
  }

  if (elements.logoutButton) {
    elements.logoutButton.addEventListener("click", logout);
  }

  /*
   * Load categories and leaderboard together.
   */
  Promise.allSettled([
    loadCategories(),
    loadLeaderboard(),
    loadDashboardAchievements(),
  ]);
}

document.addEventListener("DOMContentLoaded", initializeDashboard);
