"use strict";

const dailyRewardState = {
  submission: null,
  dailyChallenge: null,
  result: null,
  pollingTimer: null,
  maximumWaitTimer: null,
};

const dailyRewardElements = {
  overlay: null,
  card: null,
  badgeIcon: null,
  badgeTitle: null,
  bonusXp: null,
  totalXp: null,
  score: null,
  accuracy: null,
  continueButton: null,
};

function readDailyRewardSessionJson(key) {
  try {
    const value = sessionStorage.getItem(key);

    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Unable to read daily reward data "${key}":`, error);

    return null;
  }
}

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getNumber(value).toLocaleString("en-IN");
}

function formatPercentage(value) {
  const number = getNumber(value);

  return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`;
}

function getResultId() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  if (pathParts[0] === "result" && pathParts[1]) {
    return decodeURIComponent(pathParts[1]);
  }

  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("resultId") || "latest";
}

function getRewardShownKey() {
  return `quizmaster_daily_reward_shown_${getResultId()}`;
}

function hasRewardAlreadyShown() {
  return sessionStorage.getItem(getRewardShownKey()) === "true";
}

function markRewardAsShown() {
  sessionStorage.setItem(getRewardShownKey(), "true");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createDailyRewardMarkup() {
  const overlay = document.createElement("div");

  overlay.id = "dailyRewardOverlay";

  overlay.className = "daily-reward-overlay hidden";

  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");

  overlay.setAttribute("aria-labelledby", "dailyRewardTitle");

  overlay.innerHTML = `
    <section class="daily-reward-card">
      <div class="daily-reward-fire" aria-hidden="true">
        🔥
      </div>

      <p class="daily-reward-label">
        Daily Challenge Complete
      </p>

      <h2 id="dailyRewardTitle">
        Reward Claimed!
      </h2>

      <p class="daily-reward-description">
        You completed today&apos;s special challenge.
      </p>

      <div class="daily-reward-badge">
        <span
          id="dailyRewardBadgeIcon"
          aria-hidden="true"
        >
          🏆
        </span>

        <div>
          <small>Reward Badge</small>

          <strong id="dailyRewardBadgeTitle">
            Daily Challenger
          </strong>
        </div>
      </div>

      <div class="daily-reward-xp">
        <span>Bonus XP</span>

        <strong id="dailyRewardBonusXp">
          +0 XP
        </strong>
      </div>

      <div class="daily-reward-grid">
        <article>
          <span>Score</span>

          <strong id="dailyRewardScore">
            0 / 0
          </strong>
        </article>

        <article>
          <span>Accuracy</span>

          <strong id="dailyRewardAccuracy">
            0%
          </strong>
        </article>

        <article>
          <span>Total Quiz XP</span>

          <strong id="dailyRewardTotalXp">
            +0 XP
          </strong>
        </article>
      </div>

      <p class="daily-reward-footer">
        Come back tomorrow for a new challenge.
      </p>

      <button
        id="dailyRewardContinueButton"
        type="button"
        class="primary-button daily-reward-button"
      >
        Continue
      </button>
    </section>
  `;

  document.body.appendChild(overlay);

  dailyRewardElements.overlay = overlay;

  dailyRewardElements.card = overlay.querySelector(".daily-reward-card");

  dailyRewardElements.badgeIcon = document.getElementById(
    "dailyRewardBadgeIcon",
  );

  dailyRewardElements.badgeTitle = document.getElementById(
    "dailyRewardBadgeTitle",
  );

  dailyRewardElements.bonusXp = document.getElementById("dailyRewardBonusXp");

  dailyRewardElements.totalXp = document.getElementById("dailyRewardTotalXp");

  dailyRewardElements.score = document.getElementById("dailyRewardScore");

  dailyRewardElements.accuracy = document.getElementById("dailyRewardAccuracy");

  dailyRewardElements.continueButton = document.getElementById(
    "dailyRewardContinueButton",
  );
}

function populateDailyReward() {
  const result = dailyRewardState.result || {};

  const dailyChallenge = dailyRewardState.dailyChallenge || {};

  const rewardBadge = dailyChallenge.rewardBadge || {};

  const bonusXp = getNumber(
    dailyChallenge.rewardXp ?? result.dailyChallengeBonusXp,
  );

  const totalXp = getNumber(result.xpEarned);

  const score = getNumber(result.correctAnswers ?? result.score);

  const totalQuestions = getNumber(result.totalQuestions);

  const accuracy = getNumber(result.accuracy);

  if (dailyRewardElements.badgeIcon) {
    dailyRewardElements.badgeIcon.textContent = rewardBadge.icon || "🏆";
  }

  if (dailyRewardElements.badgeTitle) {
    dailyRewardElements.badgeTitle.textContent =
      rewardBadge.title || "Daily Challenger";
  }

  if (dailyRewardElements.bonusXp) {
    dailyRewardElements.bonusXp.textContent = `+${formatNumber(bonusXp)} XP`;
  }

  if (dailyRewardElements.totalXp) {
    dailyRewardElements.totalXp.textContent = `+${formatNumber(totalXp)} XP`;
  }

  if (dailyRewardElements.score) {
    dailyRewardElements.score.textContent = `${formatNumber(score)} / ${formatNumber(
      totalQuestions,
    )}`;
  }

  if (dailyRewardElements.accuracy) {
    dailyRewardElements.accuracy.textContent = formatPercentage(accuracy);
  }
}

function openDailyReward() {
  if (!dailyRewardElements.overlay || hasRewardAlreadyShown()) {
    return;
  }

  populateDailyReward();

  dailyRewardElements.overlay.classList.remove("hidden");

  dailyRewardElements.overlay.setAttribute("aria-hidden", "false");

  document.body.classList.add("celebration-open");

  markRewardAsShown();

  dailyRewardElements.continueButton?.focus();
}

function closeDailyReward() {
  dailyRewardElements.overlay?.classList.add("hidden");

  dailyRewardElements.overlay?.setAttribute("aria-hidden", "true");

  document.body.classList.remove("celebration-open");
}

function isCelebrationOpen() {
  const levelUpOverlay = document.getElementById("levelUpOverlay");

  const achievementOverlay = document.getElementById(
    "achievementCelebrationOverlay",
  );

  const levelUpOpen = Boolean(
    levelUpOverlay && !levelUpOverlay.classList.contains("hidden"),
  );

  const achievementOpen = Boolean(
    achievementOverlay && !achievementOverlay.classList.contains("hidden"),
  );

  return levelUpOpen || achievementOpen;
}

function waitForOtherCelebrations() {
  const startedAt = Date.now();

  const maximumWait = 45000;

  dailyRewardState.pollingTimer = window.setInterval(() => {
    const waited = Date.now() - startedAt;

    if (!isCelebrationOpen() || waited >= maximumWait) {
      window.clearInterval(dailyRewardState.pollingTimer);

      dailyRewardState.pollingTimer = null;

      window.setTimeout(openDailyReward, prefersReducedMotion() ? 100 : 600);
    }
  }, 250);
}

function initializeDailyRewardCelebration() {
  dailyRewardState.submission = readDailyRewardSessionJson(
    "quizmaster_submission_response",
  );

  dailyRewardState.dailyChallenge =
    readDailyRewardSessionJson("quizmaster_daily_challenge_result") ||
    dailyRewardState.submission?.dailyChallenge ||
    null;

  dailyRewardState.result =
    dailyRewardState.submission?.result ||
    readDailyRewardSessionJson("quizmaster_result") ||
    null;

  const isCompletedDailyChallenge = Boolean(
    dailyRewardState.dailyChallenge?.completed &&
    dailyRewardState.result?.isDailyChallenge,
  );

  if (!isCompletedDailyChallenge || hasRewardAlreadyShown()) {
    return;
  }

  createDailyRewardMarkup();

  dailyRewardElements.continueButton?.addEventListener(
    "click",
    closeDailyReward,
  );

  dailyRewardElements.overlay?.addEventListener("click", (event) => {
    if (event.target === dailyRewardElements.overlay) {
      closeDailyReward();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      dailyRewardElements.overlay &&
      !dailyRewardElements.overlay.classList.contains("hidden")
    ) {
      closeDailyReward();
    }
  });

  window.setTimeout(
    waitForOtherCelebrations,
    prefersReducedMotion() ? 200 : 1900,
  );
}

window.addEventListener("beforeunload", () => {
  if (dailyRewardState.pollingTimer) {
    window.clearInterval(dailyRewardState.pollingTimer);
  }

  if (dailyRewardState.maximumWaitTimer) {
    window.clearTimeout(dailyRewardState.maximumWaitTimer);
  }
});

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeDailyRewardCelebration,
  );
} else {
  initializeDailyRewardCelebration();
}
