"use strict";

const elements = {
  loadingState: document.getElementById("verificationLoadingState"),

  successState: document.getElementById("verificationSuccessState"),

  errorState: document.getElementById("verificationErrorState"),

  errorMessage: document.getElementById("verificationErrorMessage"),

  resendLink: document.getElementById("resendVerificationLink"),
};

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function showLoading() {
  toggleElement(elements.loadingState, true);
  toggleElement(elements.successState, false);
  toggleElement(elements.errorState, false);
}

function showSuccess() {
  toggleElement(elements.loadingState, false);
  toggleElement(elements.successState, true);
  toggleElement(elements.errorState, false);

  sessionStorage.removeItem("quizmaster_verification_email");
}

function showError(message) {
  elements.errorMessage.textContent =
    message || "This email-verification link is invalid or has expired.";

  const storedEmail =
    sessionStorage.getItem("quizmaster_verification_email") || "";

  if (storedEmail && elements.resendLink) {
    elements.resendLink.href = `/resend-verification?email=${encodeURIComponent(
      storedEmail,
    )}`;
  }

  toggleElement(elements.loadingState, false);
  toggleElement(elements.successState, false);
  toggleElement(elements.errorState, true);
}

function getTokenFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("token")?.trim() || "";
}

async function verifyEmail() {
  showLoading();

  const token = getTokenFromUrl();

  if (!token) {
    showError("No email-verification token was provided.");

    return;
  }

  try {
    const response = await fetch(
      `/api/email-verification/verify/${encodeURIComponent(token)}`,
      {
        method: "GET",

        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to verify your email address.");
    }

    showSuccess();
  } catch (error) {
    console.error("Email verification error:", error);

    showError(error.message);
  }
}

document.addEventListener("DOMContentLoaded", verifyEmail);
