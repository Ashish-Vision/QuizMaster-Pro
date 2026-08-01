"use strict";

const elements = {
  form: document.getElementById("resendVerificationForm"),

  email: document.getElementById("verificationEmail"),

  message: document.getElementById("resendVerificationMessage"),

  submitButton: document.getElementById("resendVerificationButton"),
};

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

function getEmailFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("email")?.trim() || "";
}

function getStoredEmail() {
  return sessionStorage.getItem("quizmaster_verification_email") || "";
}

function populateEmail() {
  const email = getEmailFromUrl() || getStoredEmail();

  if (email) {
    elements.email.value = email;
  }
}

async function resendVerification(event) {
  event.preventDefault();

  const email = elements.email.value.trim().toLowerCase();

  if (!email) {
    setMessage("Enter your email address.", "error");

    return;
  }

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Sending...";

  setMessage("");

  try {
    const response = await fetch("/api/email-verification/resend", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        email,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to resend verification email.");
    }

    sessionStorage.setItem("quizmaster_verification_email", email);

    setMessage(
      data.message || "Verification email sent successfully.",
      "success",
    );
  } catch (error) {
    console.error("Verification resend error:", error);

    setMessage(
      error.message || "Unable to resend verification email.",
      "error",
    );
  } finally {
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = "Resend Verification Email";
  }
}

function initializePage() {
  populateEmail();

  elements.form?.addEventListener("submit", resendVerification);
}

document.addEventListener("DOMContentLoaded", initializePage);
