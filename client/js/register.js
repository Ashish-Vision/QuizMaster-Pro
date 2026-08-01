"use strict";

const elements = {
  form: document.getElementById("registerForm"),

  firstName: document.getElementById("firstName"),

  lastName: document.getElementById("lastName"),

  email: document.getElementById("registerEmail"),

  password: document.getElementById("registerPassword"),

  confirmPassword: document.getElementById("confirmPassword"),

  acceptTerms: document.getElementById("acceptTerms"),

  message:
    document.getElementById("registerMessage") ||
    document.getElementById("formMessage"),

  submitButton:
    document.getElementById("registerButton") ||
    document.querySelector('#registerForm button[type="submit"]'),

  buttonText: document.querySelector(
    '#registerForm button[type="submit"] .button-text',
  ),

  buttonLoader: document.querySelector(
    '#registerForm button[type="submit"] .button-loader',
  ),

  firstNameError: document.getElementById("firstNameError"),

  lastNameError: document.getElementById("lastNameError"),

  emailError: document.getElementById("registerEmailError"),

  passwordError: document.getElementById("registerPasswordError"),

  confirmPasswordError: document.getElementById("confirmPasswordError"),

  termsError: document.getElementById("acceptTermsError"),

  strengthBar: document.getElementById("strengthBar"),

  strengthText: document.getElementById("strengthText"),
};

function setMessage(message, type = "") {
  if (!elements.message) {
    return;
  }

  elements.message.textContent = message || "";
  elements.message.className = "form-message";

  if (type === "error") {
    elements.message.classList.add("error-message");
  }

  if (type === "success") {
    elements.message.classList.add("success-message");
  }
}

function setFieldError(element, message = "") {
  if (!element) {
    return;
  }

  element.textContent = message;
}

function clearFieldErrors() {
  setFieldError(elements.firstNameError);
  setFieldError(elements.lastNameError);
  setFieldError(elements.emailError);
  setFieldError(elements.passwordError);
  setFieldError(elements.confirmPasswordError);
  setFieldError(elements.termsError);
}

function setSubmitting(isSubmitting) {
  if (!elements.submitButton) {
    return;
  }

  elements.submitButton.disabled = isSubmitting;

  if (elements.buttonText) {
    elements.buttonText.textContent = isSubmitting
      ? "Creating Account..."
      : "Create Account";
  } else {
    elements.submitButton.textContent = isSubmitting
      ? "Creating Account..."
      : "Create Account";
  }

  if (elements.buttonLoader) {
    elements.buttonLoader.hidden = !isSubmitting;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRegistration(values) {
  clearFieldErrors();

  let isValid = true;

  if (!values.firstName) {
    setFieldError(elements.firstNameError, "First name is required.");

    isValid = false;
  } else if (values.firstName.length < 2) {
    setFieldError(
      elements.firstNameError,
      "First name must contain at least 2 characters.",
    );

    isValid = false;
  }

  if (!values.lastName) {
    setFieldError(elements.lastNameError, "Last name is required.");

    isValid = false;
  } else if (values.lastName.length < 2) {
    setFieldError(
      elements.lastNameError,
      "Last name must contain at least 2 characters.",
    );

    isValid = false;
  }

  if (!values.email) {
    setFieldError(elements.emailError, "Email address is required.");

    isValid = false;
  } else if (!isValidEmail(values.email)) {
    setFieldError(elements.emailError, "Enter a valid email address.");

    isValid = false;
  }

  if (!values.password) {
    setFieldError(elements.passwordError, "Password is required.");

    isValid = false;
  } else if (values.password.length < 8) {
    setFieldError(
      elements.passwordError,
      "Password must contain at least 8 characters.",
    );

    isValid = false;
  }

  if (!values.confirmPassword) {
    setFieldError(elements.confirmPasswordError, "Confirm your password.");

    isValid = false;
  } else if (values.password !== values.confirmPassword) {
    setFieldError(elements.confirmPasswordError, "Passwords do not match.");

    isValid = false;
  }

  if (!values.acceptTerms) {
    setFieldError(
      elements.termsError,
      "You must accept the Terms of Service and Privacy Policy.",
    );

    isValid = false;
  }

  return isValid;
}

function calculatePasswordStrength(password) {
  let score = 0;

  if (password.length >= 8) {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  return score;
}

function updatePasswordStrength() {
  if (!elements.password || !elements.strengthBar || !elements.strengthText) {
    return;
  }

  const password = elements.password.value;

  if (!password) {
    elements.strengthBar.style.width = "0%";
    elements.strengthText.textContent = "Password strength";

    return;
  }

  const score = calculatePasswordStrength(password);

  let label = "Weak";
  let width = "25%";

  if (score >= 5) {
    label = "Strong";
    width = "100%";
  } else if (score >= 3) {
    label = "Medium";
    width = "65%";
  }

  elements.strengthBar.style.width = width;
  elements.strengthText.textContent = `Password strength: ${label}`;
}

function togglePasswordVisibility(button) {
  const targetId = button.dataset.passwordTarget;

  const input = document.getElementById(targetId);

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

async function registerUser(event) {
  event.preventDefault();

  const values = {
    firstName: elements.firstName?.value.trim() || "",

    lastName: elements.lastName?.value.trim() || "",

    email: elements.email?.value.trim().toLowerCase() || "",

    password: elements.password?.value || "",

    confirmPassword: elements.confirmPassword?.value || "",

    acceptTerms: Boolean(elements.acceptTerms?.checked),
  };

  setMessage("");

  if (!validateRegistration(values)) {
    return;
  }

  setSubmitting(true);

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (response.status === 409) {
        throw new Error(
          "An account with this email already exists. Log in or resend the verification email.",
        );
      }

      throw new Error(data.message || "Unable to create your account.");
    }

    if (data.requiresEmailVerification) {
      const verificationEmail = data.email || values.email;

      sessionStorage.setItem(
        "quizmaster_verification_email",
        verificationEmail,
      );

      window.location.href = `/resend-verification?email=${encodeURIComponent(
        verificationEmail,
      )}`;

      return;
    }

    setMessage(data.message || "Account created successfully.", "success");

    window.setTimeout(() => {
      window.location.href = "/login";
    }, 800);
  } catch (error) {
    console.error("Registration error:", error);

    setMessage(error.message || "Unable to create your account.", "error");
  } finally {
    setSubmitting(false);
  }
}

function initializeRegistrationPage() {
  if (!elements.form) {
    console.error('Registration form with id "registerForm" was not found.');

    return;
  }

  initializePasswordToggles();

  elements.password?.addEventListener("input", updatePasswordStrength);

  elements.form.addEventListener("submit", registerUser);
}

document.addEventListener("DOMContentLoaded", initializeRegistrationPage);
