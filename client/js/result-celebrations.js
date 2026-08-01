"use strict";

const celebrationState = {
  submissionResponse: null,
  userStats: null,
  result: null,
  confettiElements: [],
  confettiTimeouts: [],
};

const celebrationElements = {
  overlay: document.getElementById("levelUpOverlay"),
  card: document.querySelector("#levelUpOverlay .levelup-card"),

  oldLevel: document.getElementById("oldLevel"),
  newLevel: document.getElementById("newLevel"),

  oldRank: document.getElementById("oldRank"),
  newRank: document.getElementById("newRank"),

  continueButton: document.getElementById("continueButton"),
};

function readSessionJson(key) {
  try {
    const storedValue = sessionStorage.getItem(key);

    if (!storedValue) {
      return null;
    }

    return JSON.parse(storedValue);
  } catch (error) {
    console.error(`Unable to read celebration data "${key}":`, error);

    return null;
  }
}

function getSafeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function getResultId() {
  const pathSegments = window.location.pathname.split("/").filter(Boolean);

  if (pathSegments[0] === "result" && pathSegments[1]) {
    return decodeURIComponent(pathSegments[1]);
  }

  const searchParameters = new URLSearchParams(window.location.search);

  return searchParameters.get("resultId") || "";
}

function getCelebrationStorageKey() {
  const resultId =
    celebrationState.result?.resultId ||
    celebrationState.result?._id ||
    getResultId() ||
    "latest";

  return `quizmaster_levelup_shown_${resultId}`;
}

function hasCelebrationAlreadyShown() {
  return sessionStorage.getItem(getCelebrationStorageKey()) === "true";
}

function markCelebrationAsShown() {
  sessionStorage.setItem(getCelebrationStorageKey(), "true");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createConfettiContainer() {
  if (!celebrationElements.overlay) {
    return null;
  }

  let container =
    celebrationElements.overlay.querySelector(".levelup-confetti");

  if (container) {
    return container;
  }

  container = document.createElement("div");

  container.className = "levelup-confetti";
  container.setAttribute("aria-hidden", "true");

  celebrationElements.overlay.prepend(container);

  return container;
}

function removeConfetti() {
  celebrationState.confettiTimeouts.forEach((timeoutId) => {
    window.clearTimeout(timeoutId);
  });

  celebrationState.confettiTimeouts = [];

  celebrationState.confettiElements.forEach((element) => {
    element.remove();
  });

  celebrationState.confettiElements = [];
}

function createConfettiPiece(container, index) {
  const piece = document.createElement("span");

  piece.className = "levelup-confetti-piece";

  const leftPosition = Math.random() * 100;
  const horizontalMovement = Math.floor(Math.random() * 220) - 110;

  const rotation = Math.floor(Math.random() * 1080) + 360;

  const duration = Math.floor(Math.random() * 1800) + 2200;

  const delay = Math.floor(Math.random() * 500);

  const size = Math.floor(Math.random() * 7) + 7;

  piece.style.setProperty("--confetti-left", `${leftPosition}%`);

  piece.style.setProperty("--confetti-movement", `${horizontalMovement}px`);

  piece.style.setProperty("--confetti-rotation", `${rotation}deg`);

  piece.style.setProperty("--confetti-duration", `${duration}ms`);

  piece.style.setProperty("--confetti-delay", `${delay}ms`);

  piece.style.setProperty("--confetti-size", `${size}px`);

  piece.dataset.colorIndex = String(index % 6);

  container.appendChild(piece);

  celebrationState.confettiElements.push(piece);

  const timeoutId = window.setTimeout(
    () => {
      piece.remove();

      celebrationState.confettiElements =
        celebrationState.confettiElements.filter(
          (element) => element !== piece,
        );
    },
    duration + delay + 300,
  );

  celebrationState.confettiTimeouts.push(timeoutId);
}

function launchConfetti() {
  if (prefersReducedMotion() || !celebrationElements.overlay) {
    return;
  }

  removeConfetti();

  const container = createConfettiContainer();

  if (!container) {
    return;
  }

  for (let index = 0; index < 90; index += 1) {
    createConfettiPiece(container, index);
  }
}

function populateLevelInformation() {
  const userStats = celebrationState.userStats;

  if (!userStats) {
    return;
  }

  const previousLevel = getSafeNumber(
    userStats.previousLevel,
    Math.max(getSafeNumber(userStats.currentLevel, 1) - 1, 1),
  );

  const currentLevel = getSafeNumber(
    userStats.currentLevel || userStats.level,
    previousLevel + 1,
  );

  if (celebrationElements.oldLevel) {
    celebrationElements.oldLevel.textContent = `Level ${previousLevel}`;
  }

  if (celebrationElements.newLevel) {
    celebrationElements.newLevel.textContent = `Level ${currentLevel}`;
  }

  if (celebrationElements.oldRank) {
    celebrationElements.oldRank.textContent =
      userStats.previousRankTitle || "Previous Rank";
  }

  if (celebrationElements.newRank) {
    celebrationElements.newRank.textContent =
      userStats.currentRankTitle || userStats.rankTitle || "New Rank";
  }
}

function addXpInformation() {
  if (!celebrationElements.card) {
    return;
  }

  let xpMessage = celebrationElements.card.querySelector(".levelup-xp-message");

  if (!xpMessage) {
    xpMessage = document.createElement("p");

    xpMessage.className = "levelup-xp-message";

    celebrationElements.continueButton?.before(xpMessage);
  }

  const xpEarned = getSafeNumber(celebrationState.result?.xpEarned);

  xpMessage.textContent =
    xpEarned > 0
      ? `+${xpEarned.toLocaleString("en-IN")} XP earned`
      : "Your new level has been unlocked";
}

function openLevelUpCelebration() {
  if (!celebrationElements.overlay || !celebrationState.userStats?.leveledUp) {
    return;
  }

  if (hasCelebrationAlreadyShown()) {
    return;
  }

  populateLevelInformation();
  addXpInformation();

  celebrationElements.overlay.classList.remove("hidden");

  celebrationElements.overlay.setAttribute("aria-hidden", "false");

  document.body.classList.add("celebration-open");

  markCelebrationAsShown();

  celebrationElements.continueButton?.focus();

  launchConfetti();
}

function closeLevelUpCelebration() {
  if (!celebrationElements.overlay) {
    return;
  }

  celebrationElements.overlay.classList.add("hidden");

  celebrationElements.overlay.setAttribute("aria-hidden", "true");

  document.body.classList.remove("celebration-open");

  removeConfetti();
}

function initializeCelebrations() {
  celebrationState.submissionResponse = readSessionJson(
    "quizmaster_submission_response",
  );

  if (!celebrationState.submissionResponse) {
    return;
  }

  celebrationState.userStats =
    celebrationState.submissionResponse.userStats || null;

  celebrationState.result = celebrationState.submissionResponse.result || null;

  if (!celebrationState.userStats?.leveledUp) {
    return;
  }

  celebrationElements.continueButton?.addEventListener(
    "click",
    closeLevelUpCelebration,
  );

  celebrationElements.overlay?.addEventListener("click", (event) => {
    if (event.target === celebrationElements.overlay) {
      closeLevelUpCelebration();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !celebrationElements.overlay?.classList.contains("hidden")
    ) {
      closeLevelUpCelebration();
    }
  });

  /*
   * Allow the result card and XP animation to appear first.
   */
  window.setTimeout(
    openLevelUpCelebration,
    prefersReducedMotion() ? 100 : 1350,
  );
}

window.addEventListener("beforeunload", removeConfetti);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeCelebrations);
} else {
  initializeCelebrations();
}
