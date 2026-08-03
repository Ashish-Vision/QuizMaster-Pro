"use strict";

const profileState = {
  profile: null,
  isLoading: false,
  selectedAvatarFile: null,
  avatarPreviewUrl: null,
  isUploadingAvatar: false,
};

const elements = {
  loading: document.getElementById("profileLoading"),
  error: document.getElementById("profileError"),
  errorMessage: document.getElementById("profileErrorMessage"),
  retryButton: document.getElementById("profileRetryButton"),
  content: document.getElementById("profileContent"),

  profileAvatar: document.getElementById("profileAvatar"),
  profileInitials: document.getElementById("profileInitials"),
  profileFullName: document.getElementById("profileFullName"),
  profileEmail: document.getElementById("profileEmail"),
  profileRole: document.getElementById("profileRole"),
  emailVerifiedBadge: document.getElementById("emailVerifiedBadge"),

  profileLevel: document.getElementById("profileLevel"),
  profileRankTitle: document.getElementById("profileRankTitle"),
  levelXpText: document.getElementById("levelXpText"),
  levelProgressText: document.getElementById("levelProgressText"),
  levelProgressTrack: document.getElementById("levelProgressTrack"),
  levelProgressBar: document.getElementById("levelProgressBar"),
  nextLevelText: document.getElementById("nextLevelText"),

  totalXp: document.getElementById("totalXp"),
  quizzesCompleted: document.getElementById("quizzesCompleted"),
  correctAnswers: document.getElementById("correctAnswers"),
  currentStreak: document.getElementById("currentStreak"),
  averageAccuracy: document.getElementById("averageAccuracy"),
  perfectScores: document.getElementById("perfectScores"),
  totalTime: document.getElementById("totalTime"),
  achievementCount: document.getElementById("achievementCount"),

  recentAchievementsList: document.getElementById("recentAchievementsList"),

  recentAttemptsList: document.getElementById("recentAttemptsList"),

  favoriteCategoryContent: document.getElementById("favoriteCategoryContent"),

  emailVerificationStatus: document.getElementById("emailVerificationStatus"),

  createdAt: document.getElementById("createdAt"),
  lastLoginAt: document.getElementById("lastLoginAt"),
  lastQuizDate: document.getElementById("lastQuizDate"),
  totalXpEarned: document.getElementById("totalXpEarned"),
  highestScore: document.getElementById("highestScore"),
  highestAccuracy: document.getElementById("highestAccuracy"),
  averageTime: document.getElementById("averageTime"),

  editProfileButton: document.getElementById("editProfileButton"),
  profileModal: document.getElementById("profileModal"),
  profileForm: document.getElementById("profileForm"),
  firstName: document.getElementById("firstName"),
  lastName: document.getElementById("lastName"),
  avatarFile: document.getElementById("avatarFile"),

  avatarPreview: document.getElementById("avatarPreview"),

  avatarPreviewInitials: document.getElementById("avatarPreviewInitials"),

  avatarFileName: document.getElementById("avatarFileName"),

  uploadAvatarButton: document.getElementById("uploadAvatarButton"),

  removeAvatarButton: document.getElementById("removeAvatarButton"),

  avatarUploadMessage: document.getElementById("avatarUploadMessage"),
  profileMessage: document.getElementById("profileMessage"),
  saveProfileButton: document.getElementById("saveProfileButton"),

  globalRank: document.getElementById("globalRank"),
  globalRankText: document.getElementById("globalRankText"),

  completionPercent: document.getElementById("completionPercent"),

  completionBar: document.getElementById("completionBar"),

  completionText: document.getElementById("completionText"),

  completionMissing: document.getElementById("completionMissing"),

  weeklyCurrentStreak: document.getElementById("weeklyCurrentStreak"),

  weeklyLongestStreak: document.getElementById("weeklyLongestStreak"),

  weeklyXp: document.getElementById("weeklyXp"),

  weeklyQuizzes: document.getElementById("weeklyQuizzes"),

  weeklyCalendar: document.getElementById("weeklyCalendar"),
};

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function showLoading() {
  toggleElement(elements.loading, true);
  toggleElement(elements.error, false);
  toggleElement(elements.content, false);
}

function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message || "Unable to load profile.";
  }

  toggleElement(elements.loading, false);
  toggleElement(elements.error, true);
  toggleElement(elements.content, false);
}

function showContent() {
  toggleElement(elements.loading, false);
  toggleElement(elements.error, false);
  toggleElement(elements.content, true);
}

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getNumber(value).toLocaleString("en-IN");
}

function formatPercentage(value) {
  return `${getNumber(value).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDuration(secondsValue) {
  const totalSeconds = Math.max(0, Math.floor(getNumber(secondsValue)));

  if (totalSeconds < 60) {
    return `${totalSeconds} sec`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateNumber(
  element,
  finalValue,
  { duration = 800, decimals = 0, prefix = "", suffix = "" } = {},
) {
  if (!element) {
    return;
  }

  const targetValue = Math.max(0, getNumber(finalValue));

  if (prefersReducedMotion()) {
    element.textContent = `${prefix}${targetValue.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

    return;
  }

  const startTime = performance.now();

  function updateCounter(currentTime) {
    const elapsed = currentTime - startTime;

    const progress = Math.min(elapsed / duration, 1);

    const easedProgress = 1 - Math.pow(1 - progress, 3);

    const currentValue = targetValue * easedProgress;

    element.textContent = `${prefix}${currentValue.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

    if (progress < 1) {
      window.requestAnimationFrame(updateCounter);
    }
  }

  window.requestAnimationFrame(updateCounter);
}

function animateDuration(element, totalSeconds, duration = 800) {
  if (!element) {
    return;
  }

  const targetSeconds = Math.max(0, Math.floor(getNumber(totalSeconds)));

  if (prefersReducedMotion()) {
    element.textContent = formatDuration(targetSeconds);

    return;
  }

  const startTime = performance.now();

  function updateDuration(currentTime) {
    const elapsed = currentTime - startTime;

    const progress = Math.min(elapsed / duration, 1);

    const easedProgress = 1 - Math.pow(1 - progress, 3);

    const currentSeconds = Math.round(targetSeconds * easedProgress);

    element.textContent = formatDuration(currentSeconds);

    if (progress < 1) {
      window.requestAnimationFrame(updateDuration);
    }
  }

  window.requestAnimationFrame(updateDuration);
}

function animateLevelProgress(progressValue) {
  const progress = Math.min(100, Math.max(0, getNumber(progressValue)));

  if (elements.levelProgressTrack) {
    elements.levelProgressTrack.setAttribute("aria-valuenow", String(progress));
  }

  if (!elements.levelProgressBar) {
    return;
  }

  elements.levelProgressBar.style.width = "0%";

  if (prefersReducedMotion()) {
    elements.levelProgressBar.style.width = `${progress}%`;

    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      elements.levelProgressBar.style.width = `${progress}%`;
    });
  });
}

function animateVisibleCards() {
  if (prefersReducedMotion()) {
    return;
  }

  const cards = document.querySelectorAll(
    [
      ".stat-card",
      ".achievement-item",
      ".attempt-item",
      ".details-card",
      ".activity-card",
    ].join(","),
  );

  cards.forEach((card, index) => {
    card.animate(
      [
        {
          opacity: 0,
          transform: "translateY(14px)",
        },
        {
          opacity: 1,
          transform: "translateY(0)",
        },
      ],
      {
        duration: 420,
        delay: Math.min(index * 45, 360),
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      },
    );
  });
}

function getInitials(firstName, lastName) {
  const firstInitial =
    typeof firstName === "string" ? firstName.trim().charAt(0) : "";

  const lastInitial =
    typeof lastName === "string" ? lastName.trim().charAt(0) : "";

  return `${firstInitial}${lastInitial}`.toUpperCase() || "U";
}

function renderAvatar(profile) {
  if (!elements.profileAvatar || !elements.profileInitials) {
    return;
  }

  elements.profileInitials.textContent = getInitials(
    profile.firstName,
    profile.lastName,
  );

  if (profile.avatar) {
    elements.profileAvatar.style.backgroundImage = `url("${profile.avatar}")`;

    elements.profileAvatar.classList.add("has-image");
  } else {
    elements.profileAvatar.style.backgroundImage = "";

    elements.profileAvatar.classList.remove("has-image");
  }
}

function renderLevel(profile) {
  const level = Math.max(1, getNumber(profile.level));

  const progress = Math.min(100, Math.max(0, getNumber(profile.levelProgress)));

  if (elements.profileLevel) {
    elements.profileLevel.textContent = `Level ${level}`;
  }

  if (elements.profileRankTitle) {
    elements.profileRankTitle.textContent = profile.rankTitle || "Beginner";
  }

  if (elements.levelXpText) {
    elements.levelXpText.textContent = `${formatNumber(profile.totalXp)} XP`;
  }

  if (elements.levelProgressText) {
    elements.levelProgressText.textContent = `${progress.toFixed(0)}%`;
  }

  animateLevelProgress(progress);

  if (!elements.nextLevelText) {
    return;
  }

  if (profile.isMaximumLevel) {
    elements.nextLevelText.textContent =
      "Maximum level reached. You are a QuizMaster Pro!";

    return;
  }

  const remaining = formatNumber(profile.xpRemainingForNextLevel);

  const nextTitle = profile.nextLevelTitle || `Level ${level + 1}`;

  elements.nextLevelText.textContent = `${remaining} XP until ${nextTitle}`;
}

function renderVerification(profile) {
  const isVerified = Boolean(profile.emailVerified);

  if (elements.emailVerifiedBadge) {
    elements.emailVerifiedBadge.textContent = isVerified
      ? "✓ Verified"
      : "Verification pending";

    elements.emailVerifiedBadge.classList.toggle("verified", isVerified);
  }

  if (elements.emailVerificationStatus) {
    elements.emailVerificationStatus.textContent = isVerified
      ? "Verified"
      : "Not verified";

    elements.emailVerificationStatus.classList.toggle(
      "verified-text",
      isVerified,
    );
  }
}

function createAchievementItem(achievement) {
  const item = document.createElement("article");

  item.className = "achievement-item";

  const icon = document.createElement("span");

  icon.className = "achievement-icon";
  icon.textContent = achievement.icon || "🏆";

  icon.setAttribute("aria-hidden", "true");

  const information = document.createElement("div");

  information.className = "achievement-information";

  const title = document.createElement("h3");

  title.textContent = achievement.title || "Achievement";

  const description = document.createElement("p");

  description.textContent = achievement.description || "";

  const date = document.createElement("small");

  date.textContent = `Unlocked ${formatShortDate(achievement.unlockedAt)}`;

  information.append(title, description, date);

  item.append(icon, information);

  return item;
}

function renderRecentAchievements(achievements) {
  if (!elements.recentAchievementsList) {
    return;
  }

  elements.recentAchievementsList.innerHTML = "";

  if (!Array.isArray(achievements) || achievements.length === 0) {
    elements.recentAchievementsList.innerHTML = `
      <div class="empty-state">
        <span>🏆</span>
        <p>Complete quizzes to unlock achievements.</p>
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  achievements.forEach((achievement) => {
    fragment.appendChild(createAchievementItem(achievement));
  });

  elements.recentAchievementsList.appendChild(fragment);
}

function createAttemptItem(attempt) {
  const link = document.createElement("a");

  link.className = "attempt-item";

  link.href = attempt.id
    ? `/result/${encodeURIComponent(attempt.id)}`
    : "/history";

  const main = document.createElement("div");

  main.className = "attempt-main";

  const category = document.createElement("strong");

  category.textContent = attempt.category || "Unknown Category";

  const details = document.createElement("span");

  details.textContent = `${formatNumber(attempt.score)} / ${formatNumber(
    attempt.totalQuestions,
  )} • ${formatShortDate(attempt.completedAt)}`;

  main.append(category, details);

  const metrics = document.createElement("div");

  metrics.className = "attempt-metrics";

  const accuracy = document.createElement("strong");

  accuracy.textContent = formatPercentage(attempt.accuracy);

  const xp = document.createElement("span");

  xp.textContent = `+${formatNumber(attempt.xpEarned)} XP`;

  metrics.append(accuracy, xp);

  link.append(main, metrics);

  return link;
}

function renderRecentAttempts(attempts) {
  if (!elements.recentAttemptsList) {
    return;
  }

  elements.recentAttemptsList.innerHTML = "";

  if (!Array.isArray(attempts) || attempts.length === 0) {
    elements.recentAttemptsList.innerHTML = `
      <div class="empty-state">
        <span>🧠</span>
        <p>Your recent quiz attempts will appear here.</p>
      </div>
    `;

    return;
  }

  const fragment = document.createDocumentFragment();

  attempts.forEach((attempt) => {
    fragment.appendChild(createAttemptItem(attempt));
  });

  elements.recentAttemptsList.appendChild(fragment);
}

function renderFavoriteCategory(category) {
  if (!elements.favoriteCategoryContent) {
    return;
  }

  elements.favoriteCategoryContent.innerHTML = "";

  if (!category) {
    elements.favoriteCategoryContent.innerHTML = `
      <div class="empty-state">
        <span>📚</span>
        <p>Complete quizzes to discover your favorite category.</p>
      </div>
    `;

    return;
  }

  const wrapper = document.createElement("div");

  wrapper.className = "favorite-category";

  const titleSection = document.createElement("div");

  titleSection.className = "favorite-category-title";

  const icon = document.createElement("span");

  icon.textContent = "📚";

  icon.setAttribute("aria-hidden", "true");

  const titleContent = document.createElement("div");

  const label = document.createElement("small");

  label.textContent = "Most played category";

  const title = document.createElement("strong");

  title.textContent = category.name || "Unknown";

  titleContent.append(label, title);

  titleSection.append(icon, titleContent);

  const statistics = document.createElement("div");

  statistics.className = "category-statistics";

  const values = [
    ["Attempts", formatNumber(category.attempts)],
    ["Correct Answers", formatNumber(category.correctAnswers)],
    ["Average Accuracy", formatPercentage(category.averageAccuracy)],
    ["XP Earned", formatNumber(category.totalXp)],
  ];

  values.forEach(([name, value]) => {
    const item = document.createElement("div");

    const itemLabel = document.createElement("span");

    itemLabel.textContent = name;

    const itemValue = document.createElement("strong");

    itemValue.textContent = value;

    item.append(itemLabel, itemValue);

    statistics.appendChild(item);
  });

  wrapper.append(titleSection, statistics);

  elements.favoriteCategoryContent.appendChild(wrapper);
}

function renderStatistics(profile) {
  const statistics = profile.statistics || {};

  animateNumber(elements.totalXp, profile.totalXp);

  animateNumber(elements.quizzesCompleted, profile.quizzesCompleted);

  animateNumber(elements.correctAnswers, profile.correctAnswers);

  animateNumber(elements.currentStreak, profile.currentStreak);

  animateNumber(elements.averageAccuracy, statistics.averageAccuracy, {
    decimals: 1,
    suffix: "%",
  });

  animateNumber(elements.perfectScores, statistics.perfectScores);

  animateDuration(elements.totalTime, statistics.totalTimeSeconds);

  animateNumber(elements.achievementCount, profile.achievementCount);

  animateNumber(elements.totalXpEarned, statistics.totalXpEarned);

  animateNumber(elements.highestScore, statistics.highestScore);

  animateNumber(elements.highestAccuracy, statistics.highestAccuracy, {
    decimals: 1,
    suffix: "%",
  });

  animateDuration(elements.averageTime, statistics.averageTimeSeconds);
}

function renderAccountDetails(profile) {
  if (elements.createdAt) {
    elements.createdAt.textContent = formatDate(profile.createdAt);
  }

  if (elements.lastLoginAt) {
    elements.lastLoginAt.textContent = formatDate(profile.lastLoginAt);
  }

  if (elements.lastQuizDate) {
    elements.lastQuizDate.textContent = formatDate(profile.lastQuizDate);
  }
}

function renderWeeklyActivity(weeklyActivity = {}) {
  const days = Array.isArray(weeklyActivity.days) ? weeklyActivity.days : [];

  const currentStreak = Number(weeklyActivity.currentStreak || 0);

  const longestStreak = Number(weeklyActivity.longestWeeklyStreak || 0);

  const weeklyXp = Number(weeklyActivity.xpEarned || 0);

  const weeklyQuizzes = Number(weeklyActivity.quizzesCompleted || 0);

  if (elements.weeklyCurrentStreak) {
    elements.weeklyCurrentStreak.textContent = `${formatNumber(currentStreak)} ${
      currentStreak === 1 ? "day" : "days"
    }`;
  }

  if (elements.weeklyLongestStreak) {
    elements.weeklyLongestStreak.textContent = `${formatNumber(longestStreak)} ${
      longestStreak === 1 ? "day" : "days"
    }`;
  }

  if (elements.weeklyXp) {
    elements.weeklyXp.textContent = `${formatNumber(weeklyXp)} XP`;
  }

  if (elements.weeklyQuizzes) {
    elements.weeklyQuizzes.textContent = formatNumber(weeklyQuizzes);
  }

  if (!elements.weeklyCalendar) {
    return;
  }

  elements.weeklyCalendar.innerHTML = "";

  if (days.length === 0) {
    const emptyState = document.createElement("div");

    emptyState.className = "weekly-calendar-empty";

    emptyState.textContent = "No weekly activity is available yet.";

    elements.weeklyCalendar.appendChild(emptyState);

    return;
  }

  days.forEach((day) => {
    const dayCard = document.createElement("article");

    dayCard.className = "weekly-day-card";

    if (day.isActive) {
      dayCard.classList.add("active");
    }

    if (day.isToday) {
      dayCard.classList.add("today");
    }

    const quizCount = Number(day.quizCount || 0);
    const xpEarned = Number(day.xpEarned || 0);
    const accuracy = Number(day.averageAccuracy || 0);

    dayCard.tabIndex = 0;

    dayCard.setAttribute(
      "aria-label",
      [
        day.dayLabel || "Day",
        quizCount === 1 ? "1 quiz" : `${quizCount} quizzes`,
        `${xpEarned} XP`,
        `${accuracy.toFixed(1)} percent accuracy`,
      ].join(", "),
    );

    dayCard.title = [
      day.dateKey || "",
      `${quizCount} ${quizCount === 1 ? "quiz" : "quizzes"}`,
      `${xpEarned} XP`,
      `${accuracy.toFixed(1)}% accuracy`,
    ].join(" • ");

    const dayName = document.createElement("span");

    dayName.className = "weekly-day-name";

    dayName.textContent = day.dayLabel || "-";

    const activityIcon = document.createElement("span");

    activityIcon.className = "weekly-day-icon";

    if (day.isToday && day.isActive) {
      activityIcon.textContent = "🔥";
    } else if (day.isActive) {
      activityIcon.textContent = "✓";
    } else if (day.isToday) {
      activityIcon.textContent = "•";
    } else {
      activityIcon.textContent = "—";
    }

    const dateText = document.createElement("span");

    dateText.className = "weekly-day-date";

    if (day.date) {
      const date = new Date(day.date);

      dateText.textContent = Number.isNaN(date.getTime())
        ? day.dateKey || ""
        : date.toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          });
    } else {
      dateText.textContent = day.dateKey || "";
    }

    const quizText = document.createElement("strong");

    quizText.className = "weekly-day-quizzes";

    quizText.textContent = quizCount === 1 ? "1 quiz" : `${quizCount} quizzes`;

    const xpText = document.createElement("small");

    xpText.className = "weekly-day-xp";

    xpText.textContent = `+${formatNumber(xpEarned)} XP`;

    dayCard.append(dayName, activityIcon, dateText, quizText, xpText);

    elements.weeklyCalendar.appendChild(dayCard);
  });
}

function renderProfile(profile) {
  profileState.profile = profile;

  const fullName =
    profile.fullName ||
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
    "QuizMaster Player";

  if (elements.profileFullName) {
    elements.profileFullName.textContent = fullName;
  }

  if (elements.profileEmail) {
    elements.profileEmail.textContent = profile.email || "";
  }

  if (elements.profileRole) {
    elements.profileRole.textContent = profile.role || "user";
  }

  renderAvatar(profile);
  renderLevel(profile);
  renderOverview(profile);
  renderVerification(profile);
  renderStatistics(profile);
  renderAccountDetails(profile);

  renderFavoriteCategory(profile.statistics?.favoriteCategory);

  renderRecentAchievements(profile.recentAchievements);

  renderRecentAttempts(profile.recentAttempts);
  renderWeeklyActivity(profile.weeklyActivity);

  window.requestAnimationFrame(() => {
    animateVisibleCards();
  });
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid profile response.");
  }

  return response.json();
}

async function loadProfile() {
  if (profileState.isLoading) {
    return;
  }

  profileState.isLoading = true;

  showLoading();

  try {
    const response = await fetch("/api/profile", {
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

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success || !data.profile) {
      throw new Error(data.message || "Unable to load profile.");
    }

    showContent();

    window.requestAnimationFrame(() => {
      renderProfile(data.profile);
    });
  } catch (error) {
    console.error("Profile loading error:", error);

    showError(error.message || "Unable to load profile.");
  } finally {
    profileState.isLoading = false;
  }
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function clearAvatarMessage() {
  if (!elements.avatarUploadMessage) {
    return;
  }

  elements.avatarUploadMessage.textContent = "";
  elements.avatarUploadMessage.className = "form-message";
}

function showAvatarMessage(message, type = "error") {
  if (!elements.avatarUploadMessage) {
    return;
  }

  elements.avatarUploadMessage.textContent = message;

  elements.avatarUploadMessage.className =
    type === "success"
      ? "form-message success-message"
      : "form-message error-message";
}

function releaseAvatarPreviewUrl() {
  if (!profileState.avatarPreviewUrl) {
    return;
  }

  URL.revokeObjectURL(profileState.avatarPreviewUrl);
  profileState.avatarPreviewUrl = null;
}

function setAvatarPreview(imageUrl = "") {
  if (!elements.avatarPreview || !elements.avatarPreviewInitials) {
    return;
  }

  const profile = profileState.profile || {};

  elements.avatarPreviewInitials.textContent =
    getInitials(profile.firstName, profile.lastName) || "U";

  if (imageUrl) {
    elements.avatarPreview.style.backgroundImage = `url("${imageUrl}")`;

    elements.avatarPreview.classList.add("has-image");
  } else {
    elements.avatarPreview.style.backgroundImage = "";
    elements.avatarPreview.classList.remove("has-image");
  }
}

function resetAvatarSelector() {
  releaseAvatarPreviewUrl();

  profileState.selectedAvatarFile = null;

  if (elements.avatarFile) {
    elements.avatarFile.value = "";
  }

  if (elements.avatarFileName) {
    elements.avatarFileName.textContent = "No image selected";
  }

  if (elements.uploadAvatarButton) {
    elements.uploadAvatarButton.disabled = true;
  }

  setAvatarPreview(profileState.profile?.avatar || "");

  clearAvatarMessage();
}

function validateAvatarFile(file) {
  if (!file) {
    return "Select an image before uploading.";
  }

  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return "Only JPEG, PNG and WebP images are allowed.";
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return "Profile picture cannot exceed 5 MB.";
  }

  return "";
}

function handleAvatarFileSelection(event) {
  clearAvatarMessage();
  releaseAvatarPreviewUrl();

  const file = event.target.files?.[0] || null;

  const validationMessage = validateAvatarFile(file);

  if (validationMessage) {
    profileState.selectedAvatarFile = null;

    if (elements.avatarFile) {
      elements.avatarFile.value = "";
    }

    if (elements.avatarFileName) {
      elements.avatarFileName.textContent = "No image selected";
    }

    if (elements.uploadAvatarButton) {
      elements.uploadAvatarButton.disabled = true;
    }

    setAvatarPreview(profileState.profile?.avatar || "");

    showAvatarMessage(validationMessage);

    return;
  }

  profileState.selectedAvatarFile = file;

  profileState.avatarPreviewUrl = URL.createObjectURL(file);

  setAvatarPreview(profileState.avatarPreviewUrl);

  if (elements.avatarFileName) {
    elements.avatarFileName.textContent = `${file.name} (${(
      file.size /
      (1024 * 1024)
    ).toFixed(2)} MB)`;
  }

  if (elements.uploadAvatarButton) {
    elements.uploadAvatarButton.disabled = false;
  }
}

async function uploadProfileAvatar() {
  const file = profileState.selectedAvatarFile;

  const validationMessage = validateAvatarFile(file);

  if (validationMessage) {
    showAvatarMessage(validationMessage);
    return;
  }

  if (profileState.isUploadingAvatar) {
    return;
  }

  profileState.isUploadingAvatar = true;

  const originalText =
    elements.uploadAvatarButton?.textContent || "Upload Picture";

  if (elements.uploadAvatarButton) {
    elements.uploadAvatarButton.disabled = true;
    elements.uploadAvatarButton.textContent = "Uploading...";
  }

  clearAvatarMessage();

  try {
    const formData = new FormData();

    formData.append("avatar", file);

    const response = await fetch("/api/profile/avatar", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to upload profile picture.");
    }

    if (profileState.profile) {
      profileState.profile.avatar = data.avatar || "";
    }

    renderAvatar(profileState.profile);

    setAvatarPreview(data.avatar || "");

    releaseAvatarPreviewUrl();
    profileState.selectedAvatarFile = null;

    if (elements.avatarFile) {
      elements.avatarFile.value = "";
    }

    if (elements.avatarFileName) {
      elements.avatarFileName.textContent = "Profile picture uploaded";
    }

    showAvatarMessage(
      data.message || "Profile picture uploaded successfully.",
      "success",
    );

    /*
     * Reload profile data so profile-completion
     * percentage is refreshed.
     */
    await loadProfile();
  } catch (error) {
    console.error("Avatar upload error:", error);

    showAvatarMessage(error.message || "Unable to upload profile picture.");
  } finally {
    profileState.isUploadingAvatar = false;

    if (elements.uploadAvatarButton) {
      elements.uploadAvatarButton.textContent = originalText;

      elements.uploadAvatarButton.disabled = !profileState.selectedAvatarFile;
    }
  }
}

async function removeProfileAvatar() {
  if (!profileState.profile?.avatar) {
    showAvatarMessage("There is no profile picture to remove.");

    return;
  }

  const shouldRemove = window.confirm("Remove your current profile picture?");

  if (!shouldRemove) {
    return;
  }

  const originalText =
    elements.removeAvatarButton?.textContent || "Remove Picture";

  if (elements.removeAvatarButton) {
    elements.removeAvatarButton.disabled = true;
    elements.removeAvatarButton.textContent = "Removing...";
  }

  clearAvatarMessage();

  try {
    const response = await fetch("/api/profile/avatar", {
      method: "DELETE",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to remove profile picture.");
    }

    profileState.profile.avatar = "";

    renderAvatar(profileState.profile);
    resetAvatarSelector();

    showAvatarMessage(
      data.message || "Profile picture removed successfully.",
      "success",
    );

    await loadProfile();
  } catch (error) {
    console.error("Avatar removal error:", error);

    showAvatarMessage(error.message || "Unable to remove profile picture.");
  } finally {
    if (elements.removeAvatarButton) {
      elements.removeAvatarButton.disabled = false;
      elements.removeAvatarButton.textContent = originalText;
    }
  }
}
function openProfileModal() {
  const profile = profileState.profile;

  if (!profile || !elements.profileModal) {
    return;
  }

  if (elements.firstName) {
    elements.firstName.value = profile.firstName || "";
  }

  if (elements.lastName) {
    elements.lastName.value = profile.lastName || "";
  }

  resetAvatarSelector();

  if (elements.removeAvatarButton) {
    elements.removeAvatarButton.disabled = !profile.avatar;
  }

  clearProfileMessage();
  clearAvatarMessage();

  elements.profileModal.classList.remove("hidden");
  elements.profileModal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  elements.firstName?.focus();
}

function closeProfileModal() {
  if (!elements.profileModal) {
    return;
  }

  elements.profileModal.classList.add("hidden");
  elements.profileModal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");

  releaseAvatarPreviewUrl();

  profileState.selectedAvatarFile = null;

  if (elements.avatarFile) {
    elements.avatarFile.value = "";
  }

  elements.editProfileButton?.focus();
}

/* ============================================================
   Profile Form Messages
============================================================ */

function clearProfileMessage() {
  if (!elements.profileMessage) {
    return;
  }

  elements.profileMessage.textContent = "";
  elements.profileMessage.className = "form-message";
}

function showProfileMessage(message, type = "error") {
  if (!elements.profileMessage) {
    return;
  }

  elements.profileMessage.textContent = message || "";

  elements.profileMessage.className =
    type === "success"
      ? "form-message success-message"
      : "form-message error-message";
}

/* ============================================================
   Profile Form Validation
============================================================ */

function validateProfileForm() {
  const firstName = elements.firstName?.value.trim() || "";
  const lastName = elements.lastName?.value.trim() || "";

  if (firstName.length < 2 || firstName.length > 50) {
    throw new Error("First name must contain between 2 and 50 characters.");
  }

  if (lastName.length < 2 || lastName.length > 50) {
    throw new Error("Last name must contain between 2 and 50 characters.");
  }

  return {
    firstName,
    lastName,
  };
}

/* ============================================================
   Update Profile Information
============================================================ */

async function updateProfile(event) {
  event.preventDefault();

  if (!elements.profileForm || !elements.saveProfileButton) {
    return;
  }

  const originalButtonText =
    elements.saveProfileButton.textContent || "Save Changes";

  elements.saveProfileButton.disabled = true;
  elements.saveProfileButton.textContent = "Saving...";

  clearProfileMessage();

  try {
    const payload = validateProfileForm();

    const response = await fetch("/api/profile", {
      method: "PUT",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify(payload),
    });

    const data = await parseJsonResponse(response);

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to update profile.");
    }

    if (!data.profile) {
      throw new Error("The server did not return the updated profile.");
    }

    renderProfile(data.profile);

    showProfileMessage(
      data.message || "Profile updated successfully.",
      "success",
    );

    window.setTimeout(() => {
      closeProfileModal();
    }, 700);
  } catch (error) {
    console.error("Profile update error:", error);

    showProfileMessage(error.message || "Unable to update profile.", "error");
  } finally {
    elements.saveProfileButton.disabled = false;
    elements.saveProfileButton.textContent = originalButtonText;
  }
}

/* ============================================================
   Page Initialization
============================================================ */

function initializeProfilePage() {
  elements.retryButton?.addEventListener("click", loadProfile);

  elements.editProfileButton?.addEventListener("click", openProfileModal);

  elements.profileForm?.addEventListener("submit", updateProfile);

  elements.avatarFile?.addEventListener("change", handleAvatarFileSelection);

  elements.uploadAvatarButton?.addEventListener("click", uploadProfileAvatar);

  elements.removeAvatarButton?.addEventListener("click", removeProfileAvatar);

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", closeProfileModal);
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      elements.profileModal &&
      !elements.profileModal.classList.contains("hidden")
    ) {
      closeProfileModal();
    }
  });

  window.addEventListener("beforeunload", releaseAvatarPreviewUrl);

  loadProfile();
}

/* ============================================================
   Profile Overview
============================================================ */

function renderOverview(profile) {
  const ranking = profile?.ranking || null;

  if (elements.globalRank) {
    elements.globalRank.textContent = ranking?.rank ? `#${ranking.rank}` : "—";
  }

  if (elements.globalRankText) {
    if (ranking?.rank) {
      elements.globalRankText.textContent = `of ${formatNumber(
        ranking.totalPlayers,
      )} players • Top ${formatNumber(ranking.topPercentage)}%`;
    } else {
      elements.globalRankText.textContent = "Ranking is not available yet";
    }
  }

  const completion = profile?.profileCompletion || null;

  if (!completion) {
    if (elements.completionPercent) {
      elements.completionPercent.textContent = "0%";
    }

    if (elements.completionBar) {
      elements.completionBar.style.width = "0%";
    }

    if (elements.completionText) {
      elements.completionText.textContent = "0 / 0 completed";
    }

    if (elements.completionMissing) {
      elements.completionMissing.textContent =
        "Profile completion data is unavailable.";
    }

    return;
  }

  const percentage = Math.min(
    100,
    Math.max(0, getNumber(completion.completionPercentage)),
  );

  if (elements.completionPercent) {
    elements.completionPercent.textContent = `${percentage}%`;
  }

  if (elements.completionBar) {
    elements.completionBar.style.width = `${percentage}%`;

    elements.completionBar.setAttribute("aria-valuenow", String(percentage));
  }

  if (elements.completionText) {
    elements.completionText.textContent = `${formatNumber(
      completion.completedItems,
    )} / ${formatNumber(completion.totalItems)} completed`;
  }

  if (elements.completionMissing) {
    const missingItems = Array.isArray(completion.missingItems)
      ? completion.missingItems
      : [];

    elements.completionMissing.textContent =
      missingItems.length > 0
        ? `Missing: ${missingItems.join(", ")}`
        : "Profile Complete 🎉";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeProfilePage);
} else {
  initializeProfilePage();
}
