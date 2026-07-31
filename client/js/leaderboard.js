"use strict";

/* ============================================================
   DOM Elements
============================================================ */

const elements = {
  loadingState: document.getElementById("loadingState"),

  errorState: document.getElementById("errorState"),

  errorMessage: document.getElementById("errorMessage"),

  retryButton: document.getElementById("retryButton"),

  logoutButton: document.getElementById("logoutButton"),

  leaderboardContent: document.getElementById("leaderboardContent"),

  podium: document.getElementById("podium"),

  leaderboardBody: document.getElementById("leaderboardBody"),

  playerCount: document.getElementById("playerCount"),

  emptyState: document.getElementById("emptyState"),
};

/* ============================================================
   Utility Functions
============================================================ */

function getInitials(player) {
  const firstInitial = player.firstName?.trim().charAt(0) || "P";

  const lastInitial = player.lastName?.trim().charAt(0) || "";

  return `${firstInitial}${lastInitial}`.toUpperCase();
}

function getPlayerName(player) {
  if (player.fullName?.trim()) {
    return player.fullName.trim();
  }

  const fullName = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || "QuizMaster Player";
}

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getRankDisplay(rank) {
  const numericRank = getNumber(rank);

  if (numericRank === 1) {
    return "🥇 1";
  }

  if (numericRank === 2) {
    return "🥈 2";
  }

  if (numericRank === 3) {
    return "🥉 3";
  }

  return `#${numericRank}`;
}

/* ============================================================
   Page States
============================================================ */

function showLoading() {
  elements.loadingState?.classList.remove("hidden");
  elements.errorState?.classList.add("hidden");
  elements.leaderboardContent?.classList.add("hidden");
}

function showError(message) {
  elements.loadingState?.classList.add("hidden");
  elements.leaderboardContent?.classList.add("hidden");
  elements.errorState?.classList.remove("hidden");

  if (elements.errorMessage) {
    elements.errorMessage.textContent = message || "Please try again.";
  }
}

function showContent() {
  elements.loadingState?.classList.add("hidden");
  elements.errorState?.classList.add("hidden");
  elements.leaderboardContent?.classList.remove("hidden");
}

/* ============================================================
   Avatar
============================================================ */

function createAvatar(player, className) {
  const avatar = document.createElement("div");

  avatar.className = className;

  if (player.avatar) {
    const image = document.createElement("img");

    image.src = player.avatar;
    image.alt = `${getPlayerName(player)} avatar`;
    image.className = "avatar-image";

    image.addEventListener("error", () => {
      avatar.innerHTML = "";
      avatar.textContent = getInitials(player);
    });

    avatar.appendChild(image);
  } else {
    avatar.textContent = getInitials(player);
  }

  return avatar;
}

/* ============================================================
   Podium
============================================================ */

function createPodiumCard(player, position) {
  const card = document.createElement("article");

  const classes = ["podium-card", position];

  if (player.isCurrentUser) {
    classes.push("current-player");
  }

  card.className = classes.join(" ");

  const medalMap = {
    first: "🥇",
    second: "🥈",
    third: "🥉",
  };

  const medal = document.createElement("div");

  medal.className = "podium-medal";
  medal.textContent = medalMap[position];
  medal.setAttribute("aria-hidden", "true");

  const avatar = createAvatar(player, "podium-avatar");

  const name = document.createElement("h3");

  name.textContent = getPlayerName(player);

  if (player.isCurrentUser) {
    const badge = document.createElement("span");

    badge.className = "you-badge";
    badge.textContent = "You";

    name.appendChild(badge);
  }

  const details = document.createElement("p");

  details.textContent = `${getNumber(player.quizzesCompleted)} quizzes`;

  const xp = document.createElement("strong");

  xp.textContent = `${getNumber(player.totalXp)} XP`;

  card.append(medal, avatar, name, details, xp);

  return card;
}

function renderPodium(players) {
  if (!elements.podium) {
    return;
  }

  elements.podium.innerHTML = "";

  if (players.length === 0) {
    return;
  }

  const first = players[0];
  const second = players[1];
  const third = players[2];

  /*
   * Podium order:
   * second place, first place, third place
   */

  if (second) {
    elements.podium.appendChild(createPodiumCard(second, "second"));
  }

  if (first) {
    elements.podium.appendChild(createPodiumCard(first, "first"));
  }

  if (third) {
    elements.podium.appendChild(createPodiumCard(third, "third"));
  }
}

/* ============================================================
   Leaderboard Table
============================================================ */

function createLeaderboardRow(player) {
  const row = document.createElement("tr");

  if (player.isCurrentUser) {
    row.classList.add("current-player");
  }

  const rankCell = document.createElement("td");

  rankCell.className = "rank-cell";
  rankCell.textContent = getRankDisplay(player.rank);

  const playerCell = document.createElement("td");

  const playerWrapper = document.createElement("div");

  playerWrapper.className = "player-cell";

  const avatar = createAvatar(player, "player-avatar");

  const nameWrapper = document.createElement("div");

  nameWrapper.className = "player-name";

  const name = document.createElement("strong");

  name.textContent = getPlayerName(player);

  const playerStatus = document.createElement("span");

  playerStatus.textContent = player.isCurrentUser ? "You" : "QuizMaster player";

  nameWrapper.append(name, playerStatus);

  playerWrapper.append(avatar, nameWrapper);

  playerCell.appendChild(playerWrapper);

  const xpCell = document.createElement("td");

  xpCell.className = "xp-cell";
  xpCell.textContent = `${getNumber(player.totalXp)} XP`;

  const quizzesCell = document.createElement("td");

  quizzesCell.textContent = getNumber(player.quizzesCompleted);

  const correctCell = document.createElement("td");

  correctCell.textContent = getNumber(player.correctAnswers);

  const streakCell = document.createElement("td");

  streakCell.className = "streak-cell";
  streakCell.textContent = `🔥 ${getNumber(player.currentStreak)}`;

  row.append(
    rankCell,
    playerCell,
    xpCell,
    quizzesCell,
    correctCell,
    streakCell,
  );

  return row;
}

function renderLeaderboard(players, totalPlayers) {
  if (!elements.leaderboardBody) {
    return;
  }

  elements.leaderboardBody.innerHTML = "";

  const playerTotal = getNumber(totalPlayers) || players.length;

  if (elements.playerCount) {
    elements.playerCount.textContent = `${playerTotal} ${
      playerTotal === 1 ? "player" : "players"
    }`;
  }

  if (players.length === 0) {
    elements.emptyState?.classList.remove("hidden");
    return;
  }

  elements.emptyState?.classList.add("hidden");

  players.forEach((player) => {
    elements.leaderboardBody.appendChild(createLeaderboardRow(player));
  });
}

/* ============================================================
   API
============================================================ */

async function loadLeaderboard() {
  showLoading();

  try {
    /*
     * Correct route:
     * app.use("/api/leaderboard", leaderboardRoutes)
     */

    const response = await fetch("/api/leaderboard?limit=20", {
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
      throw new Error(data.message || "Unable to load leaderboard.");
    }

    if (!Array.isArray(data.leaderboard)) {
      throw new Error("The leaderboard response is invalid.");
    }

    renderPodium(data.leaderboard.slice(0, 3));

    renderLeaderboard(data.leaderboard, data.totalPlayers);

    showContent();
  } catch (error) {
    console.error("Leaderboard error:", error);

    showError(error.message || "An unexpected error occurred.");
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
   Initialization
============================================================ */

function initializeLeaderboard() {
  elements.retryButton?.addEventListener("click", loadLeaderboard);

  elements.logoutButton?.addEventListener("click", logout);

  loadLeaderboard();
}

document.addEventListener("DOMContentLoaded", initializeLeaderboard);
