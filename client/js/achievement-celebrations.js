"use strict";

const achievementCelebrationState = {
  achievements: [],
  currentIndex: 0,
  hasStarted: false,
  confettiElements: [],
  confettiTimeouts: [],
};

const achievementCelebrationElements = {
  overlay: null,
  card: null,
  icon: null,
  title: null,
  description: null,
  category: null,
  progress: null,
  continueButton: null,
};

function readAchievementSessionJson(key) {
  try {
    const storedValue = sessionStorage.getItem(key);

    return storedValue ? JSON.parse(storedValue) : null;
  } catch (error) {
    console.error(
      `Unable to read achievement celebration data "${key}":`,
      error,
    );

    return null;
  }
}

function getResultIdForAchievementCelebration() {
  const pathSegments = window.location.pathname.split("/").filter(Boolean);

  if (pathSegments[0] === "result" && pathSegments[1]) {
    return decodeURIComponent(pathSegments[1]);
  }

  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("resultId")?.trim() || "latest";
}

function getAchievementShownKey(achievement) {
  const resultId = getResultIdForAchievementCelebration();

  const achievementCode =
    achievement?.code ||
    achievement?.id ||
    achievement?._id ||
    achievement?.title ||
    "achievement";

  return ["quizmaster_achievement_shown", resultId, achievementCode].join("_");
}

function hasAchievementAlreadyShown(achievement) {
  return sessionStorage.getItem(getAchievementShownKey(achievement)) === "true";
}

function markAchievementAsShown(achievement) {
  sessionStorage.setItem(getAchievementShownKey(achievement), "true");
}

function prefersReducedAchievementMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function normalizeAchievement(achievement) {
  if (!achievement || typeof achievement !== "object") {
    return null;
  }

  return {
    id: achievement.id || achievement._id || null,

    code: achievement.code || "",

    title: achievement.title || "Achievement Unlocked",

    description:
      achievement.description || "You reached a new QuizMaster Pro milestone.",

    icon: achievement.icon || "🏆",

    category: achievement.category || "achievement",

    threshold: Number.isFinite(Number(achievement.threshold))
      ? Number(achievement.threshold)
      : 0,
  };
}

function createAchievementCelebrationMarkup() {
  const overlay = document.createElement("div");

  overlay.id = "achievementCelebrationOverlay";

  overlay.className = "achievement-celebration-overlay hidden";

  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-labelledby", "achievementCelebrationTitle");

  overlay.innerHTML = `
    <div
      class="achievement-celebration-confetti"
      aria-hidden="true"
    ></div>

    <section class="achievement-celebration-card">
      <div
        id="achievementCelebrationIcon"
        class="achievement-celebration-icon"
        aria-hidden="true"
      >
        🏆
      </div>

      <p class="achievement-celebration-label">
        Achievement Unlocked
      </p>

      <h2 id="achievementCelebrationTitle">
        New Achievement
      </h2>

      <p
        id="achievementCelebrationDescription"
        class="achievement-celebration-description"
      >
        You reached a new milestone.
      </p>

      <div class="achievement-celebration-meta">
        <span id="achievementCelebrationCategory">
          Achievement
        </span>

        <span id="achievementCelebrationProgress">
          1 of 1
        </span>
      </div>

      <button
        id="achievementCelebrationContinueButton"
        type="button"
        class="primary-button achievement-celebration-button"
      >
        Awesome!
      </button>
    </section>
  `;

  document.body.appendChild(overlay);

  achievementCelebrationElements.overlay = overlay;

  achievementCelebrationElements.card = overlay.querySelector(
    ".achievement-celebration-card",
  );

  achievementCelebrationElements.icon = document.getElementById(
    "achievementCelebrationIcon",
  );

  achievementCelebrationElements.title = document.getElementById(
    "achievementCelebrationTitle",
  );

  achievementCelebrationElements.description = document.getElementById(
    "achievementCelebrationDescription",
  );

  achievementCelebrationElements.category = document.getElementById(
    "achievementCelebrationCategory",
  );

  achievementCelebrationElements.progress = document.getElementById(
    "achievementCelebrationProgress",
  );

  achievementCelebrationElements.continueButton = document.getElementById(
    "achievementCelebrationContinueButton",
  );
}

function removeAchievementConfetti() {
  achievementCelebrationState.confettiTimeouts.forEach((timeoutId) => {
    window.clearTimeout(timeoutId);
  });

  achievementCelebrationState.confettiTimeouts = [];

  achievementCelebrationState.confettiElements.forEach((element) => {
    element.remove();
  });

  achievementCelebrationState.confettiElements = [];
}

function launchAchievementConfetti() {
  if (
    prefersReducedAchievementMotion() ||
    !achievementCelebrationElements.overlay
  ) {
    return;
  }

  removeAchievementConfetti();

  const container = achievementCelebrationElements.overlay.querySelector(
    ".achievement-celebration-confetti",
  );

  if (!container) {
    return;
  }

  for (let index = 0; index < 65; index += 1) {
    const piece = document.createElement("span");

    piece.className = "achievement-confetti-piece";

    piece.dataset.colorIndex = String(index % 6);

    const duration = Math.floor(Math.random() * 1500) + 2100;

    const delay = Math.floor(Math.random() * 450);

    piece.style.setProperty("--achievement-left", `${Math.random() * 100}%`);

    piece.style.setProperty(
      "--achievement-movement",
      `${Math.floor(Math.random() * 200) - 100}px`,
    );

    piece.style.setProperty(
      "--achievement-rotation",
      `${Math.floor(Math.random() * 1080) + 360}deg`,
    );

    piece.style.setProperty("--achievement-duration", `${duration}ms`);

    piece.style.setProperty("--achievement-delay", `${delay}ms`);

    piece.style.setProperty(
      "--achievement-size",
      `${Math.floor(Math.random() * 6) + 7}px`,
    );

    container.appendChild(piece);

    achievementCelebrationState.confettiElements.push(piece);

    const timeoutId = window.setTimeout(
      () => {
        piece.remove();

        achievementCelebrationState.confettiElements =
          achievementCelebrationState.confettiElements.filter(
            (element) => element !== piece,
          );
      },
      duration + delay + 300,
    );

    achievementCelebrationState.confettiTimeouts.push(timeoutId);
  }
}

function formatAchievementCategory(category) {
  const normalizedCategory = String(category || "achievement")
    .replace(/[_-]+/g, " ")
    .trim();

  return normalizedCategory.replace(/\b\w/g, (character) =>
    character.toUpperCase(),
  );
}

function renderCurrentAchievement() {
  const achievement =
    achievementCelebrationState.achievements[
      achievementCelebrationState.currentIndex
    ];

  if (!achievement) {
    closeAchievementCelebration();
    return;
  }

  if (achievementCelebrationElements.icon) {
    achievementCelebrationElements.icon.textContent = achievement.icon;
  }

  if (achievementCelebrationElements.title) {
    achievementCelebrationElements.title.textContent = achievement.title;
  }

  if (achievementCelebrationElements.description) {
    achievementCelebrationElements.description.textContent =
      achievement.description;
  }

  if (achievementCelebrationElements.category) {
    achievementCelebrationElements.category.textContent =
      formatAchievementCategory(achievement.category);
  }

  if (achievementCelebrationElements.progress) {
    achievementCelebrationElements.progress.textContent =
      `${achievementCelebrationState.currentIndex + 1} of ` +
      `${achievementCelebrationState.achievements.length}`;
  }

  if (achievementCelebrationElements.continueButton) {
    const isLastAchievement =
      achievementCelebrationState.currentIndex ===
      achievementCelebrationState.achievements.length - 1;

    achievementCelebrationElements.continueButton.textContent =
      isLastAchievement ? "Awesome!" : "Next Achievement";
  }

  markAchievementAsShown(achievement);

  achievementCelebrationElements.card?.classList.remove(
    "achievement-card-enter",
  );

  void achievementCelebrationElements.card?.offsetWidth;

  achievementCelebrationElements.card?.classList.add("achievement-card-enter");

  launchAchievementConfetti();
}

function openAchievementCelebration() {
  if (
    !achievementCelebrationElements.overlay ||
    achievementCelebrationState.achievements.length === 0
  ) {
    return;
  }

  achievementCelebrationElements.overlay.classList.remove("hidden");

  achievementCelebrationElements.overlay.setAttribute("aria-hidden", "false");

  document.body.classList.add("celebration-open");

  renderCurrentAchievement();

  achievementCelebrationElements.continueButton?.focus();
}

function closeAchievementCelebration() {
  achievementCelebrationElements.overlay?.classList.add("hidden");

  achievementCelebrationElements.overlay?.setAttribute("aria-hidden", "true");

  document.body.classList.remove("celebration-open");

  removeAchievementConfetti();
}

function showNextAchievement() {
  const isLastAchievement =
    achievementCelebrationState.currentIndex >=
    achievementCelebrationState.achievements.length - 1;

  if (isLastAchievement) {
    closeAchievementCelebration();
    return;
  }

  achievementCelebrationState.currentIndex += 1;

  renderCurrentAchievement();
}

function isLevelUpOverlayOpen() {
  const levelUpOverlay = document.getElementById("levelUpOverlay");

  return Boolean(
    levelUpOverlay && !levelUpOverlay.classList.contains("hidden"),
  );
}

function waitForLevelUpCelebration() {
  const maximumWaitMilliseconds = 30000;
  const startedAt = Date.now();

  const intervalId = window.setInterval(() => {
    const waitedMilliseconds = Date.now() - startedAt;

    if (
      !isLevelUpOverlayOpen() ||
      waitedMilliseconds >= maximumWaitMilliseconds
    ) {
      window.clearInterval(intervalId);

      window.setTimeout(
        openAchievementCelebration,
        prefersReducedAchievementMotion() ? 100 : 500,
      );
    }
  }, 250);
}

function initializeAchievementCelebrations() {
  const submissionResponse = readAchievementSessionJson(
    "quizmaster_submission_response",
  );

  const unlockedAchievements = submissionResponse?.newlyUnlockedAchievements;

  if (
    !Array.isArray(unlockedAchievements) ||
    unlockedAchievements.length === 0
  ) {
    return;
  }

  achievementCelebrationState.achievements = unlockedAchievements
    .map(normalizeAchievement)
    .filter(Boolean)
    .filter((achievement) => !hasAchievementAlreadyShown(achievement));

  if (achievementCelebrationState.achievements.length === 0) {
    return;
  }

  createAchievementCelebrationMarkup();

  achievementCelebrationElements.continueButton?.addEventListener(
    "click",
    showNextAchievement,
  );

  achievementCelebrationElements.overlay?.addEventListener("click", (event) => {
    if (event.target === achievementCelebrationElements.overlay) {
      closeAchievementCelebration();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      achievementCelebrationElements.overlay &&
      !achievementCelebrationElements.overlay.classList.contains("hidden")
    ) {
      closeAchievementCelebration();
    }
  });

  achievementCelebrationState.hasStarted = true;

  window.setTimeout(
    waitForLevelUpCelebration,
    prefersReducedAchievementMotion() ? 100 : 1600,
  );
}

window.addEventListener("beforeunload", removeAchievementConfetti);

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAchievementCelebrations,
  );
} else {
  initializeAchievementCelebrations();
}
