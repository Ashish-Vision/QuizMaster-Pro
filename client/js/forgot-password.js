"use strict";

const elements = {
  form: document.getElementById("forgotPasswordForm"),
  email: document.getElementById("forgotPasswordEmail"),
  message: document.getElementById("forgotPasswordMessage"),
  submitButton: document.getElementById("forgotPasswordButton"),
  developmentSection: document.getElementById("developmentResetSection"),
  developmentLink: document.getElementById("developmentResetLink"),
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

async function requestPasswordReset(event) {
  event.preventDefault();

  const email = elements.email.value.trim().toLowerCase();

  if (!email) {
    setMessage("Enter your email address.", "error");
    return;
  }

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Generating...";

  setMessage("");

  elements.developmentSection.classList.add("hidden");

  try {
    const response = await fetch("/api/password-reset/forgot", {
      method: "POST",
      credentials: "include",

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
      throw new Error(
        data.message || "Unable to generate password-reset instructions.",
      );
    }

    setMessage(
      data.message || "Password-reset instructions were created.",
      "success",
    );

    const resetUrl = data.development?.resetUrl;

    if (resetUrl) {
      elements.developmentLink.href = resetUrl;
      elements.developmentSection.classList.remove("hidden");
    }
  } catch (error) {
    setMessage(error.message || "Unable to process the request.", "error");
  } finally {
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = "Generate Reset Link";
  }
}

elements.form?.addEventListener("submit", requestPasswordReset);
