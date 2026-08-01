"use strict";

const dailyChallengeState = {
  challenge: null,
  countdownInterval: null,
  isLoading: false,
};

const dailyChallengeElements = {
  section: document.getElementById("dailyChallengeSection"),

  loading: document.getElementById("dailyChallengeLoading"),

  error: document.getElementById("dailyChallengeError"),

  errorMessage: document.getElementById("dailyChallengeErrorMessage"),

  retryButton: document.getElementById("dailyChallengeRetryButton"),

  content: document.getElementById("dailyChallengeContent"),

  icon: document.getElementById("dailyChallengeIcon"),

  title: document.getElementById("dailyChallengeTitle"),

  description: document.getElementById("dailyChallengeDescription"),

  category: document.getElementById("dailyChallengeCategory"),

  difficulty: document.getElementById("dailyChallengeDifficulty"),

  questionCount: document.getElementById("dailyChallengeQuestionCount"),

  rewardXp: document.getElementById("dailyChallengeRewardXp"),

  rewardBadge: document.getElementById("dailyChallengeRewardBadge"),

  countdown: document.getElementById("dailyChallengeCountdown"),

  status: document.getElementById("dailyChallengeStatus"),

  startButton: document.getElementById("dailyChallengeStartButton"),

  completedPanel: document.getElementById("dailyChallengeCompleted"),

  completedScore: document.getElementById("dailyChallengeCompletedScore"),

  completedAccuracy: document.getElementById("dailyChallengeCompletedAccuracy"),

  completedXp: document.getElementById("dailyChallengeCompletedXp"),

  resultLink: document.getElementById("dailyChallengeResultLink"),
};

function toggleDailyChallengeElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function getDailyChallengeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatDailyChallengeNumber(value) {
  return getDailyChallengeNumber(value).toLocaleString("en-IN");
}

function clearDailyChallengeCountdown() {
  if (dailyChallengeState.countdownInterval) {
    window.clearInterval(dailyChallengeState.countdownInterval);

    dailyChallengeState.countdownInterval = null;
  }
}

function showDailyChallengeLoading() {
  toggleDailyChallengeElement(dailyChallengeElements.loading, true);

  toggleDailyChallengeElement(dailyChallengeElements.error, false);

  toggleDailyChallengeElement(dailyChallengeElements.content, false);
}

function showDailyChallengeError(message) {
  clearDailyChallengeCountdown();

  if (dailyChallengeElements.errorMessage) {
    dailyChallengeElements.errorMessage.textContent =
      message || "Unable to load today's daily challenge.";
  }

  toggleDailyChallengeElement(dailyChallengeElements.loading, false);

  toggleDailyChallengeElement(dailyChallengeElements.error, true);

  toggleDailyChallengeElement(dailyChallengeElements.content, false);
}

function showDailyChallengeContent() {
  toggleDailyChallengeElement(dailyChallengeElements.loading, false);

  toggleDailyChallengeElement(dailyChallengeElements.error, false);

  toggleDailyChallengeElement(dailyChallengeElements.content, true);
}

function parseDailyChallengeJson(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid daily challenge response.");
  }

  return response.json();
}

function formatCountdown(milliseconds) {
  const safeMilliseconds = Math.max(0, getDailyChallengeNumber(milliseconds));

  const totalSeconds = Math.floor(safeMilliseconds / 1000);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

function updateDailyChallengeCountdown() {
  const challenge = dailyChallengeState.challenge;

  if (!challenge || !dailyChallengeElements.countdown) {
    return;
  }

  const expirationTime = new Date(challenge.expiresAt).getTime();

  if (Number.isNaN(expirationTime)) {
    dailyChallengeElements.countdown.textContent = "Unavailable";

    clearDailyChallengeCountdown();

    return;
  }

  const millisecondsRemaining = Math.max(expirationTime - Date.now(), 0);

  dailyChallengeElements.countdown.textContent = formatCountdown(
    millisecondsRemaining,
  );

  if (millisecondsRemaining <= 0) {
    clearDailyChallengeCountdown();

    dailyChallengeElements.countdown.textContent = "Expired";

    if (dailyChallengeElements.status) {
      dailyChallengeElements.status.textContent =
        "Today's challenge has expired.";
    }

    if (dailyChallengeElements.startButton) {
      dailyChallengeElements.startButton.disabled = true;

      dailyChallengeElements.startButton.textContent = "Challenge Expired";
    }
  }
}

function startDailyChallengeCountdown() {
  clearDailyChallengeCountdown();

  updateDailyChallengeCountdown();

  dailyChallengeState.countdownInterval = window.setInterval(
    updateDailyChallengeCountdown,
    1000,
  );
}

function renderCompletedChallenge(challenge) {
  const completion = challenge.completion || {};

  toggleDailyChallengeElement(dailyChallengeElements.completedPanel, true);

  if (dailyChallengeElements.status) {
    dailyChallengeElements.status.textContent = "Completed";
  }

  if (dailyChallengeElements.completedScore) {
    dailyChallengeElements.completedScore.textContent = `${formatDailyChallengeNumber(
      completion.score,
    )} / ${formatDailyChallengeNumber(completion.totalQuestions)}`;
  }

  if (dailyChallengeElements.completedAccuracy) {
    dailyChallengeElements.completedAccuracy.textContent = `${getDailyChallengeNumber(
      completion.accuracy,
    ).toFixed(1)}%`;
  }

  if (dailyChallengeElements.completedXp) {
    dailyChallengeElements.completedXp.textContent = `+${formatDailyChallengeNumber(
      completion.xpAwarded,
    )} XP`;
  }

  const resultId = completion.resultId;

  if (dailyChallengeElements.resultLink && resultId) {
    dailyChallengeElements.resultLink.href = `/result/${encodeURIComponent(resultId)}`;

    toggleDailyChallengeElement(dailyChallengeElements.resultLink, true);
  } else {
    toggleDailyChallengeElement(dailyChallengeElements.resultLink, false);
  }

  if (dailyChallengeElements.startButton) {
    dailyChallengeElements.startButton.disabled = true;

    dailyChallengeElements.startButton.textContent = "Completed Today";
  }
}

function renderIncompleteChallenge(challenge) {
  toggleDailyChallengeElement(dailyChallengeElements.completedPanel, false);

  if (dailyChallengeElements.status) {
    dailyChallengeElements.status.textContent = "Available Now";
  }

  if (dailyChallengeElements.startButton) {
    dailyChallengeElements.startButton.disabled = !challenge.isAvailable;

    dailyChallengeElements.startButton.textContent = challenge.isAvailable
      ? "Start Daily Challenge"
      : "Challenge Unavailable";
  }
}

function renderDailyChallenge(challenge) {
  dailyChallengeState.challenge = challenge;

  if (dailyChallengeElements.icon) {
    dailyChallengeElements.icon.textContent =
      challenge.rewardBadge?.icon || "🔥";
  }

  if (dailyChallengeElements.title) {
    dailyChallengeElements.title.textContent =
      challenge.title || "Daily Challenge";
  }

  if (dailyChallengeElements.description) {
    dailyChallengeElements.description.textContent =
      challenge.description || "Complete today's challenge to earn bonus XP.";
  }

  if (dailyChallengeElements.category) {
    dailyChallengeElements.category.textContent =
      challenge.category || "General";
  }

  if (dailyChallengeElements.difficulty) {
    dailyChallengeElements.difficulty.textContent =
      challenge.difficulty || "Mixed";
  }

  if (dailyChallengeElements.questionCount) {
    const count = getDailyChallengeNumber(challenge.questionCount);

    dailyChallengeElements.questionCount.textContent = `${count} ${
      count === 1 ? "Question" : "Questions"
    }`;
  }

  if (dailyChallengeElements.rewardXp) {
    dailyChallengeElements.rewardXp.textContent = `+${formatDailyChallengeNumber(
      challenge.rewardXp,
    )} XP`;
  }

  if (dailyChallengeElements.rewardBadge) {
    dailyChallengeElements.rewardBadge.textContent =
      challenge.rewardBadge?.title || "Daily Challenger";
  }

  if (challenge.completed) {
    renderCompletedChallenge(challenge);
  } else {
    renderIncompleteChallenge(challenge);
  }

  startDailyChallengeCountdown();

  showDailyChallengeContent();
}

async function loadDailyChallenge() {
  if (dailyChallengeState.isLoading || !dailyChallengeElements.section) {
    return;
  }

  dailyChallengeState.isLoading = true;

  showDailyChallengeLoading();

  try {
    const response = await fetch("/api/daily-challenge", {
      method: "GET",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    const data = await parseDailyChallengeJson(response);

    if (!response.ok || !data.success || !data.challenge) {
      throw new Error(
        data.message || "Unable to load today's daily challenge.",
      );
    }

    renderDailyChallenge(data.challenge);
  } catch (error) {
    console.error("Daily challenge loading error:", error);

    showDailyChallengeError(
      error.message || "Unable to load today's daily challenge.",
    );
  } finally {
    dailyChallengeState.isLoading = false;
  }
}

async function startDailyChallenge() {
  const challenge = dailyChallengeState.challenge;

  if (!challenge?.id || challenge.completed || !challenge.isAvailable) {
    return;
  }

  const button = dailyChallengeElements.startButton;

  const originalText = button?.textContent || "Start Daily Challenge";

  if (button) {
    button.disabled = true;
    button.textContent = "Starting...";
  }

  try {
    const response = await fetch(
      `/api/daily-challenge/${encodeURIComponent(challenge.id)}/start`,
      {
        method: "POST",
        credentials: "include",

        headers: {
          Accept: "application/json",
        },
      },
    );

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    const data = await parseDailyChallengeJson(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to start the daily challenge.");
    }

    const query = new URLSearchParams({
      daily: "true",
      challengeId: challenge.id,
      category: challenge.category,
    });

    window.location.href = `/quiz?${query.toString()}`;
  } catch (error) {
    console.error("Daily challenge start error:", error);

    window.alert(error.message || "Unable to start the daily challenge.");

    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function initializeDailyChallenge() {
  if (!dailyChallengeElements.section) {
    return;
  }

  dailyChallengeElements.retryButton?.addEventListener(
    "click",
    loadDailyChallenge,
  );

  dailyChallengeElements.startButton?.addEventListener(
    "click",
    startDailyChallenge,
  );

  loadDailyChallenge();
}

window.addEventListener("beforeunload", clearDailyChallengeCountdown);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDailyChallenge);
} else {
  initializeDailyChallenge();
}
