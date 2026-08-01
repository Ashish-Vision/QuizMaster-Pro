"use strict";

const elements = {
  loadingState: document.getElementById("tokenLoadingState"),

  errorState: document.getElementById("tokenErrorState"),

  errorMessage: document.getElementById("tokenErrorMessage"),

  content: document.getElementById("resetPasswordContent"),

  successState: document.getElementById("resetSuccessState"),

  form: document.getElementById("resetPasswordForm"),

  newPassword: document.getElementById("resetNewPassword"),

  confirmPassword: document.getElementById("resetConfirmPassword"),

  message: document.getElementById("resetPasswordMessage"),

  submitButton: document.getElementById("resetPasswordButton"),
};

let resetToken = "";

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function setMessage(message, type = "") {
  elements.message.textContent = message || "";

  elements.message.className = "form-message";

  if (type === "success") {
    elements.message.classList.add("success-message");
  }

  if (type === "error") {
    elements.message.classList.add("error-message");
  }
}

function getTokenFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("token")?.trim() || "";
}

function showLoading() {
  toggleElement(elements.loadingState, true);
  toggleElement(elements.errorState, false);
  toggleElement(elements.content, false);
  toggleElement(elements.successState, false);
}

function showError(message) {
  elements.errorMessage.textContent =
    message || "This password-reset link is invalid or has expired.";

  toggleElement(elements.loadingState, false);
  toggleElement(elements.errorState, true);
  toggleElement(elements.content, false);
  toggleElement(elements.successState, false);
}

function showForm() {
  toggleElement(elements.loadingState, false);
  toggleElement(elements.errorState, false);
  toggleElement(elements.content, true);
  toggleElement(elements.successState, false);
}

function showSuccess() {
  toggleElement(elements.loadingState, false);
  toggleElement(elements.errorState, false);
  toggleElement(elements.content, false);
  toggleElement(elements.successState, true);
}

async function validateResetToken() {
  showLoading();

  resetToken = getTokenFromUrl();

  if (!resetToken) {
    showError("No password-reset token was provided.");

    return;
  }

  try {
    const encodedToken = encodeURIComponent(resetToken);

    const response = await fetch(
      `/api/password-reset/validate/${encodedToken}`,
      {
        method: "GET",

        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "This password-reset link is invalid or has expired.",
      );
    }

    showForm();
  } catch (error) {
    showError(error.message);
  }
}

async function resetPassword(event) {
  event.preventDefault();

  const newPassword = elements.newPassword.value;

  const confirmPassword = elements.confirmPassword.value;

  if (!newPassword || !confirmPassword) {
    setMessage("Complete both password fields.", "error");

    return;
  }

  if (newPassword.length < 8) {
    setMessage("New password must contain at least 8 characters.", "error");

    return;
  }

  if (newPassword !== confirmPassword) {
    setMessage("New password and confirmation do not match.", "error");

    return;
  }

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Resetting...";

  setMessage("");

  try {
    const encodedToken = encodeURIComponent(resetToken);

    const response = await fetch(`/api/password-reset/reset/${encodedToken}`, {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        newPassword,
        confirmPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to reset your password.");
    }

    elements.form.reset();

    showSuccess();
  } catch (error) {
    setMessage(error.message || "Unable to reset your password.", "error");
  } finally {
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = "Reset Password";
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
  elements.form?.addEventListener("submit", resetPassword);

  initializePasswordToggles();

  validateResetToken();
}

document.addEventListener("DOMContentLoaded", initializePage);
