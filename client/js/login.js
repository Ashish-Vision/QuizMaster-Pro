"use strict";

const elements = {
  form: document.getElementById("loginForm"),

  email:
    document.getElementById("loginEmail") ||
    document.querySelector('#loginForm [name="email"]'),

  password:
    document.getElementById("loginPassword") ||
    document.querySelector('#loginForm [name="password"]'),

  rememberMe:
    document.getElementById("rememberMe") ||
    document.querySelector('#loginForm [name="rememberMe"]'),

  submitButton:
    document.getElementById("loginButton") ||
    document.querySelector('#loginForm button[type="submit"]'),

  message:
    document.getElementById("loginMessage") ||
    document.getElementById("formMessage"),
};

function setMessage(message, type = "") {
  if (!elements.message) {
    return;
  }

  elements.message.textContent = message || "";
  elements.message.className = "form-message";

  if (type === "success") {
    elements.message.classList.add("success-message");
  }

  if (type === "error") {
    elements.message.classList.add("error-message");
  }
}

function setSubmitting(isSubmitting) {
  if (!elements.submitButton) {
    return;
  }

  elements.submitButton.disabled = isSubmitting;

  const buttonText = elements.submitButton.querySelector(".button-text");

  if (buttonText) {
    buttonText.textContent = isSubmitting ? "Signing In..." : "Sign In";
  } else {
    elements.submitButton.textContent = isSubmitting
      ? "Signing In..."
      : "Sign In";
  }

  elements.submitButton.classList.toggle("loading", isSubmitting);
}

function validateForm(email, password) {
  if (!email || !password) {
    return "Email address and password are required.";
  }

  if (!email.includes("@")) {
    return "Enter a valid email address.";
  }

  return null;
}

function getPageMessage() {
  const searchParams = new URLSearchParams(window.location.search);

  const status = searchParams.get("status");

  if (status === "registered") {
    return {
      message:
        "Account created successfully. Check your email to verify your account.",
      type: "success",
    };
  }

  if (status === "verified") {
    return {
      message: "Email verified successfully. You can now sign in.",
      type: "success",
    };
  }

  if (status === "password-reset") {
    return {
      message: "Password reset successfully. Sign in using your new password.",
      type: "success",
    };
  }

  return null;
}

function restoreVerificationEmail() {
  const storedEmail = sessionStorage.getItem("quizmaster_verification_email");

  if (storedEmail && elements.email && !elements.email.value) {
    elements.email.value = storedEmail;
  }
}

async function loginUser(event) {
  event.preventDefault();

  setMessage("");

  const email = elements.email?.value.trim().toLowerCase() || "";

  const password = elements.password?.value || "";

  const rememberMe = Boolean(elements.rememberMe?.checked);

  const validationError = validateForm(email, password);

  if (validationError) {
    setMessage(validationError, "error");
    const firstInvalidField =
      !email || !email.includes("@") ? elements.email : elements.password;
    firstInvalidField?.focus();
    return;
  }

  setSubmitting(true);

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        email,
        password,
        rememberMe,
      }),
    });

    const data = await response.json();

    if (response.status === 403 && data.code === "EMAIL_NOT_VERIFIED") {
      const verificationEmail = data.email || email;

      sessionStorage.setItem(
        "quizmaster_verification_email",
        verificationEmail,
      );

      setMessage(
        "Please verify your email address before logging in.",
        "error",
      );

      window.setTimeout(() => {
        window.location.href = `/resend-verification?email=${encodeURIComponent(
          verificationEmail,
        )}`;
      }, 1200);

      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to sign in.");
    }

    sessionStorage.removeItem("quizmaster_verification_email");

    setMessage(data.message || "Login successful.", "success");

    window.location.href = "/dashboard";
  } catch (error) {
    console.error("Login error:", error);

    setMessage(error.message || "Unable to sign in.", "error");
  } finally {
    setSubmitting(false);
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

function initializeLoginPage() {
  if (!elements.form) {
    console.error('Login form with id "loginForm" was not found.');

    return;
  }

  restoreVerificationEmail();

  const pageMessage = getPageMessage();

  if (pageMessage) {
    setMessage(pageMessage.message, pageMessage.type);

    window.history.replaceState({}, document.title, "/login");
  }

  elements.form.addEventListener("submit", loginUser);

  initializePasswordToggles();
}

document.addEventListener("DOMContentLoaded", initializeLoginPage);
