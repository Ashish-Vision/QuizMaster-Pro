"use strict";

const elements = {
  loadingState: document.getElementById("loadingState"),

  errorState: document.getElementById("errorState"),

  errorMessage: document.getElementById("errorMessage"),

  retryButton: document.getElementById("retryButton"),

  leaderboardContent: document.getElementById("leaderboardContent"),

  podium: document.getElementById("podium"),

  leaderboardBody: document.getElementById("leaderboardBody"),

  playerCount: document.getElementById("playerCount"),
};

function getInitials(player) {
  const firstInitial = player.firstName?.charAt(0) || "P";

  const lastInitial = player.lastName?.charAt(0) || "";

  return (firstInitial + lastInitial).toUpperCase();
}

function getPlayerName(player) {
  return [player.firstName, player.lastName].filter(Boolean).join(" ");
}

function showLoading() {
  elements.loadingState.classList.remove("hidden");

  elements.errorState.classList.add("hidden");

  elements.leaderboardContent.classList.add("hidden");
}

function showError(message) {
  elements.loadingState.classList.add("hidden");

  elements.leaderboardContent.classList.add("hidden");

  elements.errorState.classList.remove("hidden");

  elements.errorMessage.textContent = message;
}

function showContent() {
  elements.loadingState.classList.add("hidden");

  elements.errorState.classList.add("hidden");

  elements.leaderboardContent.classList.remove("hidden");
}

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

  const avatar = document.createElement("div");

  avatar.className = "podium-avatar";
  avatar.textContent = getInitials(player);

  const name = document.createElement("h3");

  name.textContent = getPlayerName(player);

  const details = document.createElement("p");

  details.textContent = `${player.quizzesCompleted} quizzes`;

  const xp = document.createElement("strong");

  xp.textContent = `${player.totalXp} XP`;

  card.append(medal, avatar, name, details, xp);

  return card;
}

function renderPodium(players) {
  elements.podium.innerHTML = "";

  if (players.length === 0) {
    return;
  }

  const first = players[0];
  const second = players[1];
  const third = players[2];

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

function createLeaderboardRow(player) {
  const row = document.createElement("tr");

  if (player.isCurrentUser) {
    row.classList.add("current-player");
  }

  const rankCell = document.createElement("td");

  rankCell.className = "rank-cell";

  if (player.rank === 1) {
    rankCell.textContent = "🥇 1";
  } else if (player.rank === 2) {
    rankCell.textContent = "🥈 2";
  } else if (player.rank === 3) {
    rankCell.textContent = "🥉 3";
  } else {
    rankCell.textContent = `#${player.rank}`;
  }

  const playerCell = document.createElement("td");

  const playerWrapper = document.createElement("div");

  playerWrapper.className = "player-cell";

  const avatar = document.createElement("div");

  avatar.className = "player-avatar";
  avatar.textContent = getInitials(player);

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
  xpCell.textContent = `${player.totalXp} XP`;

  const quizzesCell = document.createElement("td");

  quizzesCell.textContent = player.quizzesCompleted;

  const correctCell = document.createElement("td");

  correctCell.textContent = player.correctAnswers;

  const streakCell = document.createElement("td");

  streakCell.className = "streak-cell";
  streakCell.textContent = `🔥 ${player.currentStreak}`;

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

function renderLeaderboard(players) {
  elements.leaderboardBody.innerHTML = "";

  players.forEach((player) => {
    elements.leaderboardBody.appendChild(createLeaderboardRow(player));
  });

  elements.playerCount.textContent = `${players.length} ${
    players.length === 1 ? "player" : "players"
  }`;
}

async function loadLeaderboard() {
  showLoading();

  try {
    const response = await fetch("/api/users/leaderboard?limit=20", {
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

    renderLeaderboard(data.leaderboard);

    showContent();
  } catch (error) {
    showError(error.message || "An unexpected error occurred.");
  }
}

elements.retryButton.addEventListener("click", loadLeaderboard);

loadLeaderboard();
