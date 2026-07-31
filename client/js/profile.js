"use strict";

const profileState = {
  profile: null,
};

const elements = {
  profileAvatar: document.getElementById("profileAvatar"),
  profileInitials: document.getElementById("profileInitials"),
  profileFullName: document.getElementById("profileFullName"),
  profileEmail: document.getElementById("profileEmail"),
  profileRole: document.getElementById("profileRole"),

  totalXp: document.getElementById("totalXp"),
  quizzesCompleted: document.getElementById("quizzesCompleted"),
  correctAnswers: document.getElementById("correctAnswers"),
  currentStreak: document.getElementById("currentStreak"),
  highestScore: document.getElementById("highestScore"),
  averageAccuracy: document.getElementById("averageAccuracy"),
  highestAccuracy: document.getElementById("highestAccuracy"),
  averageTime: document.getElementById("averageTime"),
  totalXpEarned: document.getElementById("totalXpEarned"),

  createdAt: document.getElementById("createdAt"),
  lastLoginAt: document.getElementById("lastLoginAt"),
  lastQuizDate: document.getElementById("lastQuizDate"),

  favoriteCategoryContent: document.getElementById("favoriteCategoryContent"),

  editProfileButton: document.getElementById("editProfileButton"),
  profileModal: document.getElementById("profileModal"),
  profileForm: document.getElementById("profileForm"),
  firstName: document.getElementById("firstName"),
  lastName: document.getElementById("lastName"),
  avatar: document.getElementById("avatar"),
  profileMessage: document.getElementById("profileMessage"),
  saveProfileButton: document.getElementById("saveProfileButton"),
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getInitials(firstName, lastName) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

function renderAvatar(profile) {
  const initials = getInitials(profile.firstName, profile.lastName);

  elements.profileInitials.textContent = initials || "U";

  if (profile.avatar) {
    elements.profileAvatar.style.backgroundImage = `url("${profile.avatar}")`;

    elements.profileAvatar.classList.add("has-image");
  } else {
    elements.profileAvatar.style.backgroundImage = "";
    elements.profileAvatar.classList.remove("has-image");
  }
}

function renderFavoriteCategory(category) {
  if (!category) {
    elements.favoriteCategoryContent.innerHTML =
      "<p>No quiz category data available.</p>";

    return;
  }

  elements.favoriteCategoryContent.innerHTML = `
    <div class="favorite-category">
      <strong>${category.name || "Unknown"}</strong>

      <div class="category-statistics">
        <span>
          Attempts
          <b>${formatNumber(category.attempts)}</b>
        </span>

        <span>
          Correct Answers
          <b>${formatNumber(category.correctAnswers)}</b>
        </span>

        <span>
          Accuracy
          <b>${Number(category.averageAccuracy || 0).toFixed(1)}%</b>
        </span>

        <span>
          XP Earned
          <b>${formatNumber(category.totalXp)}</b>
        </span>
      </div>
    </div>
  `;
}

function renderProfile(profile) {
  profileState.profile = profile;

  const statistics = profile.statistics || {};

  elements.profileFullName.textContent =
    profile.fullName ||
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim();

  elements.profileEmail.textContent = profile.email || "";
  elements.profileRole.textContent = profile.role || "user";

  renderAvatar(profile);

  elements.totalXp.textContent = formatNumber(profile.totalXp);
  elements.quizzesCompleted.textContent = formatNumber(
    profile.quizzesCompleted,
  );
  elements.correctAnswers.textContent = formatNumber(profile.correctAnswers);
  elements.currentStreak.textContent = formatNumber(profile.currentStreak);

  elements.highestScore.textContent = formatNumber(statistics.highestScore);

  elements.averageAccuracy.textContent = `${Number(statistics.averageAccuracy || 0).toFixed(1)}%`;

  elements.highestAccuracy.textContent = `${Number(statistics.highestAccuracy || 0).toFixed(1)}%`;

  elements.averageTime.textContent = `${formatNumber(statistics.averageTimeSeconds)} sec`;

  elements.totalXpEarned.textContent = formatNumber(statistics.totalXpEarned);

  elements.createdAt.textContent = formatDate(profile.createdAt);
  elements.lastLoginAt.textContent = formatDate(profile.lastLoginAt);
  elements.lastQuizDate.textContent = formatDate(profile.lastQuizDate);

  renderFavoriteCategory(statistics.favoriteCategory);
}

async function loadProfile() {
  try {
    const response = await fetch("/api/profile", {
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to load profile.");
    }

    renderProfile(data.profile);
  } catch (error) {
    console.error(error);

    elements.profileMessage.textContent = error.message;
    elements.profileMessage.classList.add("error-message");
  }
}

function openProfileModal() {
  const profile = profileState.profile;

  if (!profile) {
    return;
  }

  elements.firstName.value = profile.firstName || "";
  elements.lastName.value = profile.lastName || "";
  elements.avatar.value = profile.avatar || "";
  elements.profileMessage.textContent = "";

  elements.profileModal.classList.remove("hidden");
  elements.profileModal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  elements.firstName.focus();
}

function closeProfileModal() {
  elements.profileModal.classList.add("hidden");
  elements.profileModal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");
}

async function updateProfile(event) {
  event.preventDefault();

  const payload = {
    firstName: elements.firstName.value.trim(),
    lastName: elements.lastName.value.trim(),
    avatar: elements.avatar.value.trim(),
  };

  elements.saveProfileButton.disabled = true;
  elements.saveProfileButton.textContent = "Saving...";
  elements.profileMessage.textContent = "";
  elements.profileMessage.className = "form-message";

  try {
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to update profile.");
    }

    renderProfile(data.profile);

    elements.profileMessage.textContent =
      data.message || "Profile updated successfully.";

    elements.profileMessage.classList.add("success-message");

    setTimeout(() => {
      closeProfileModal();
    }, 700);
  } catch (error) {
    elements.profileMessage.textContent = error.message;
    elements.profileMessage.classList.add("error-message");
  } finally {
    elements.saveProfileButton.disabled = false;
    elements.saveProfileButton.textContent = "Save Changes";
  }
}

elements.editProfileButton.addEventListener("click", openProfileModal);

elements.profileForm.addEventListener("submit", updateProfile);

document.querySelectorAll("[data-close-modal]").forEach((element) => {
  element.addEventListener("click", closeProfileModal);
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !elements.profileModal.classList.contains("hidden")
  ) {
    closeProfileModal();
  }
});

loadProfile();
