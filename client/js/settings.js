"use strict";

const elements = {
  loadingState: document.getElementById("settingsLoadingState"),

  errorState: document.getElementById("settingsErrorState"),

  errorMessage: document.getElementById("settingsErrorMessage"),

  retryButton: document.getElementById("retrySettingsButton"),

  content: document.getElementById("settingsContent"),

  accountAvatar: document.getElementById("accountAvatar"),

  accountName: document.getElementById("accountName"),

  accountEmail: document.getElementById("accountEmail"),

  accountRole: document.getElementById("accountRole"),

  accountXp: document.getElementById("accountXp"),

  accountQuizzes: document.getElementById("accountQuizzes"),

  accountCorrect: document.getElementById("accountCorrect"),

  accountStreak: document.getElementById("accountStreak"),

  accountCreatedAt: document.getElementById("accountCreatedAt"),

  accountLastLogin: document.getElementById("accountLastLogin"),

  profileForm: document.getElementById("profileSettingsForm"),

  firstName: document.getElementById("settingsFirstName"),

  lastName: document.getElementById("settingsLastName"),

  email: document.getElementById("settingsEmail"),

  profileMessage: document.getElementById("profileSettingsMessage"),

  saveProfileButton: document.getElementById("saveProfileButton"),

  passwordForm: document.getElementById("passwordSettingsForm"),

  currentPassword: document.getElementById("currentPassword"),

  newPassword: document.getElementById("newPassword"),

  confirmPassword: document.getElementById("confirmPassword"),

  passwordMessage: document.getElementById("passwordSettingsMessage"),

  changePasswordButton: document.getElementById("changePasswordButton"),
};

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Never";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(account) {
  const firstInitial = account.firstName?.trim().charAt(0) || "";

  const lastInitial = account.lastName?.trim().charAt(0) || "";

  return `${firstInitial}${lastInitial}`.toUpperCase() || "U";
}

function showLoading() {
  toggleElement(elements.loadingState, true);
  toggleElement(elements.errorState, false);
  toggleElement(elements.content, false);
}

function showError(message) {
  elements.errorMessage.textContent =
    message || "Unable to load account settings.";

  toggleElement(elements.loadingState, false);
  toggleElement(elements.errorState, true);
  toggleElement(elements.content, false);
}

function showContent() {
  toggleElement(elements.loadingState, false);
  toggleElement(elements.errorState, false);
  toggleElement(elements.content, true);
}

function setFormMessage(element, message, type = "") {
  element.textContent = message || "";

  element.className = "form-message";

  if (type === "success") {
    element.classList.add("success-message");
  }

  if (type === "error") {
    element.classList.add("error-message");
  }
}

function renderAccount(account) {
  const fullName =
    account.fullName ||
    `${account.firstName || ""} ${account.lastName || ""}`.trim() ||
    "QuizMaster User";

  elements.accountAvatar.textContent = getInitials(account);

  elements.accountName.textContent = fullName;

  elements.accountEmail.textContent = account.email || "";

  elements.accountRole.textContent =
    account.role === "admin" ? "Administrator" : "User";

  elements.accountRole.className =
    account.role === "admin" ? "role-badge admin" : "role-badge";

  elements.accountXp.textContent = Number(account.totalXp) || 0;

  elements.accountQuizzes.textContent = Number(account.quizzesCompleted) || 0;

  elements.accountCorrect.textContent = Number(account.correctAnswers) || 0;

  elements.accountStreak.textContent = Number(account.currentStreak) || 0;

  elements.accountCreatedAt.textContent = formatDate(account.createdAt);

  elements.accountLastLogin.textContent = formatDate(account.lastLoginAt);

  elements.firstName.value = account.firstName || "";

  elements.lastName.value = account.lastName || "";

  elements.email.value = account.email || "";
}

async function loadSettings() {
  showLoading();

  try {
    const response = await fetch("/api/settings", {
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
      throw new Error(data.message || "Unable to load account settings.");
    }

    renderAccount(data.account || {});

    showContent();
  } catch (error) {
    console.error("Settings loading error:", error);

    showError(error.message);
  }
}

async function updateProfile(event) {
  event.preventDefault();

  const firstName = elements.firstName.value.trim();

  const lastName = elements.lastName.value.trim();

  const email = elements.email.value.trim().toLowerCase();

  if (!firstName || !lastName || !email) {
    setFormMessage(
      elements.profileMessage,
      "First name, last name and email are required.",
      "error",
    );

    return;
  }

  elements.saveProfileButton.disabled = true;

  elements.saveProfileButton.textContent = "Saving...";

  setFormMessage(elements.profileMessage, "");

  try {
    const response = await fetch("/api/settings/profile", {
      method: "PATCH",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        firstName,
        lastName,
        email,
      }),
    });

    const data = await response.json();

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to update profile.");
    }

    renderAccount(data.account || {});

    setFormMessage(
      elements.profileMessage,
      data.message || "Profile updated successfully.",
      "success",
    );
  } catch (error) {
    setFormMessage(elements.profileMessage, error.message, "error");
  } finally {
    elements.saveProfileButton.disabled = false;

    elements.saveProfileButton.textContent = "Save Profile";
  }
}

async function changePassword(event) {
  event.preventDefault();

  const currentPassword = elements.currentPassword.value;

  const newPassword = elements.newPassword.value;

  const confirmPassword = elements.confirmPassword.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    setFormMessage(
      elements.passwordMessage,
      "Complete all password fields.",
      "error",
    );

    return;
  }

  if (newPassword.length < 8) {
    setFormMessage(
      elements.passwordMessage,
      "New password must contain at least 8 characters.",
      "error",
    );

    return;
  }

  if (newPassword !== confirmPassword) {
    setFormMessage(
      elements.passwordMessage,
      "New password and confirmation do not match.",
      "error",
    );

    return;
  }

  elements.changePasswordButton.disabled = true;

  elements.changePasswordButton.textContent = "Changing...";

  setFormMessage(elements.passwordMessage, "");

  try {
    const response = await fetch("/api/settings/password", {
      method: "PATCH",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    const data = await response.json();

    if (response.status === 401) {
      if (data.message?.toLowerCase().includes("current password")) {
        throw new Error(data.message);
      }

      window.location.href = "/login";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to change password.");
    }

    elements.passwordForm.reset();

    setFormMessage(
      elements.passwordMessage,
      data.message || "Password changed successfully.",
      "success",
    );
  } catch (error) {
    setFormMessage(elements.passwordMessage, error.message, "error");
  } finally {
    elements.changePasswordButton.disabled = false;

    elements.changePasswordButton.textContent = "Change Password";
  }
}

function togglePasswordVisibility(button) {
  const inputId = button.dataset.passwordTarget;

  const input = document.getElementById(inputId);

  if (!input) {
    return;
  }

  const shouldShow = input.type === "password";

  input.type = shouldShow ? "text" : "password";

  button.textContent = shouldShow ? "Hide" : "Show";

  button.setAttribute(
    "aria-label",
    shouldShow ? "Hide password" : "Show password",
  );
}

function initializePasswordToggles() {
  document.querySelectorAll("[data-password-target]").forEach((button) => {
    button.addEventListener("click", () => {
      togglePasswordVisibility(button);
    });
  });
}

function initializePage() {
  elements.retryButton?.addEventListener("click", loadSettings);

  elements.profileForm?.addEventListener("submit", updateProfile);

  elements.passwordForm?.addEventListener("submit", changePassword);

  initializePasswordToggles();

  loadSettings();
}

document.addEventListener("DOMContentLoaded", initializePage);
