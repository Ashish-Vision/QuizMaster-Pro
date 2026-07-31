"use strict";

const state = {
  achievements: [],
  totalAchievements: 0,
  unlockedCount: 0,
  lockedCount: 0,
};

const elements = {
  totalAchievements: document.getElementById("totalAchievements"),

  unlockedCount: document.getElementById("unlockedCount"),

  lockedCount: document.getElementById("lockedCount"),

  completionPercentage: document.getElementById("completionPercentage"),

  progressMessage: document.getElementById("progressMessage"),

  progressLabel: document.getElementById("progressLabel"),

  progressTrack: document.getElementById("progressTrack"),

  progressFill: document.getElementById("progressFill"),

  statusFilter: document.getElementById("statusFilter"),

  categoryFilter: document.getElementById("categoryFilter"),

  achievementsGrid: document.getElementById("achievementsGrid"),

  loadingState: document.getElementById("loadingState"),

  errorState: document.getElementById("errorState"),

  emptyState: document.getElementById("emptyState"),

  errorMessage: document.getElementById("errorMessage"),

  retryButton: document.getElementById("retryButton"),
};

function setElementVisibility(element, isVisible) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !isVisible);
}

function formatCategory(category) {
  const categoryNames = {
    quiz: "Quiz",
    xp: "XP",
    accuracy: "Accuracy",
    streak: "Streak",
    category: "Category Mastery",
  };

  return categoryNames[category] || category;
}

function formatUnlockDate(dateValue) {
  if (!dateValue) {
    return "Not unlocked yet";
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

function calculateCompletionPercentage() {
  if (state.totalAchievements === 0) {
    return 0;
  }

  return Math.round((state.unlockedCount / state.totalAchievements) * 100);
}

function renderSummary() {
  const percentage = calculateCompletionPercentage();

  elements.totalAchievements.textContent = String(state.totalAchievements);

  elements.unlockedCount.textContent = String(state.unlockedCount);

  elements.lockedCount.textContent = String(state.lockedCount);

  elements.completionPercentage.textContent = `${percentage}%`;

  elements.progressLabel.textContent = `${state.unlockedCount} / ${state.totalAchievements}`;

  elements.progressFill.style.width = `${percentage}%`;

  elements.progressTrack.setAttribute("aria-valuenow", String(percentage));

  if (percentage === 100) {
    elements.progressMessage.textContent =
      "You unlocked every available achievement.";
  } else if (percentage >= 75) {
    elements.progressMessage.textContent =
      "Excellent progress. You are close to completing the collection.";
  } else if (percentage >= 50) {
    elements.progressMessage.textContent =
      "You have unlocked more than half of the achievement collection.";
  } else if (state.unlockedCount > 0) {
    elements.progressMessage.textContent =
      "Keep completing quizzes to unlock more achievements.";
  } else {
    elements.progressMessage.textContent =
      "Complete your first quiz to start unlocking achievements.";
  }
}

function createAchievementCard(achievement) {
  const article = document.createElement("article");

  article.className = achievement.isUnlocked
    ? "achievement-card unlocked-card"
    : "achievement-card locked-card";

  article.dataset.status = achievement.isUnlocked ? "unlocked" : "locked";

  article.dataset.category = achievement.category;

  const statusLabel = achievement.isUnlocked ? "Unlocked" : "Locked";

  const statusIcon = achievement.isUnlocked ? "✓" : "🔒";

  article.innerHTML = `
    <div class="achievement-card-header">
      <div class="achievement-icon-wrapper">
        <span class="achievement-icon">
          ${achievement.icon || "🏆"}
        </span>
      </div>

      <span class="achievement-status">
        <span aria-hidden="true">
          ${statusIcon}
        </span>

        ${statusLabel}
      </span>
    </div>

    <div class="achievement-content">
      <span class="achievement-category">
        ${formatCategory(achievement.category)}
      </span>

      <h3>${achievement.title}</h3>

      <p>${achievement.description}</p>
    </div>

    <div class="achievement-footer">
      <span>
        ${achievement.isUnlocked ? "Unlocked on" : "Requirement"}
      </span>

      <strong>
        ${
          achievement.isUnlocked
            ? formatUnlockDate(achievement.unlockedAt)
            : getRequirementText(achievement)
        }
      </strong>
    </div>
  `;

  return article;
}

function getRequirementText(achievement) {
  switch (achievement.code) {
    case "FIRST_QUIZ":
    case "QUIZ_EXPLORER":
    case "QUIZ_MASTER":
      return `${achievement.threshold} quiz${
        achievement.threshold === 1 ? "" : "zes"
      }`;

    case "XP_BEGINNER":
    case "XP_CHAMPION":
    case "XP_LEGEND":
      return `${achievement.threshold.toLocaleString("en-IN")} XP`;

    case "PERFECT_SCORE":
      return "100% accuracy";

    case "ACCURACY_EXPERT":
      return `${achievement.threshold} high-accuracy quizzes`;

    case "STREAK_STARTER":
    case "STREAK_MASTER":
      return `${achievement.threshold}-day streak`;

    case "CATEGORY_SPECIALIST":
      return `${achievement.threshold} quizzes in one category`;

    default:
      return String(achievement.threshold);
  }
}

function getFilteredAchievements() {
  const selectedStatus = elements.statusFilter.value;

  const selectedCategory = elements.categoryFilter.value;

  return state.achievements.filter((achievement) => {
    const statusMatches =
      selectedStatus === "all" ||
      (selectedStatus === "unlocked" && achievement.isUnlocked) ||
      (selectedStatus === "locked" && !achievement.isUnlocked);

    const categoryMatches =
      selectedCategory === "all" || achievement.category === selectedCategory;

    return statusMatches && categoryMatches;
  });
}

function renderAchievements() {
  const filteredAchievements = getFilteredAchievements();

  elements.achievementsGrid.innerHTML = "";

  if (filteredAchievements.length === 0) {
    setElementVisibility(elements.achievementsGrid, false);

    setElementVisibility(elements.emptyState, true);

    return;
  }

  const fragment = document.createDocumentFragment();

  for (const achievement of filteredAchievements) {
    fragment.appendChild(createAchievementCard(achievement));
  }

  elements.achievementsGrid.appendChild(fragment);

  setElementVisibility(elements.emptyState, false);

  setElementVisibility(elements.achievementsGrid, true);
}

function showLoadingState() {
  setElementVisibility(elements.loadingState, true);
  setElementVisibility(elements.errorState, false);
  setElementVisibility(elements.emptyState, false);

  setElementVisibility(elements.achievementsGrid, false);
}

function showErrorState(message) {
  elements.errorMessage.textContent =
    message || "The achievements could not be loaded.";

  setElementVisibility(elements.loadingState, false);
  setElementVisibility(elements.errorState, true);
  setElementVisibility(elements.emptyState, false);

  setElementVisibility(elements.achievementsGrid, false);
}

async function loadAchievements() {
  showLoadingState();

  try {
    const response = await fetch("/api/achievements", {
      method: "GET",

      headers: {
        Accept: "application/json",
      },

      credentials: "same-origin",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      throw new Error(data.message || "Failed to load achievements.");
    }

    state.achievements = Array.isArray(data.achievements)
      ? data.achievements
      : [];

    state.totalAchievements = Number(data.totalAchievements) || 0;

    state.unlockedCount = Number(data.unlockedCount) || 0;

    state.lockedCount = Number(data.lockedCount) || 0;

    renderSummary();
    renderAchievements();

    setElementVisibility(elements.loadingState, false);

    setElementVisibility(elements.errorState, false);
  } catch (error) {
    console.error("Achievement loading error:", error);

    showErrorState(error.message);
  }
}

elements.statusFilter.addEventListener("change", renderAchievements);

elements.categoryFilter.addEventListener("change", renderAchievements);

elements.retryButton.addEventListener("click", loadAchievements);

loadAchievements();
