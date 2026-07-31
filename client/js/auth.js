"use strict";

const loginForm = document.getElementById("loginForm");

const registerForm = document.getElementById("registerForm");

const formMessage = document.getElementById("formMessage");

function getElement(id) {
  return document.getElementById(id);
}

function setFieldError(inputId, errorId, message) {
  const input = getElement(inputId);
  const error = getElement(errorId);

  if (input) {
    input.classList.toggle("input-error", Boolean(message));
  }

  if (error) {
    error.textContent = message;
  }
}

function clearFormMessage() {
  if (!formMessage) {
    return;
  }

  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function showFormMessage(message, type) {
  if (!formMessage) {
    return;
  }

  formMessage.textContent = message;
  formMessage.className = `form-message visible ${type}`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setButtonLoading(button, loading) {
  if (!button) {
    return;
  }

  button.disabled = loading;

  button.classList.toggle("loading", loading);
}

async function sendAuthRequest(endpoint, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Authentication failed.");
  }

  return data;
}

document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.passwordTarget;

    const input = getElement(targetId);

    if (!input) {
      return;
    }

    const isVisible = input.type === "text";

    input.type = isVisible ? "password" : "text";

    button.textContent = isVisible ? "Show" : "Hide";
  });
});

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormMessage();

    const email = getElement("loginEmail").value.trim();

    const password = getElement("loginPassword").value;

    let valid = true;

    setFieldError("loginEmail", "loginEmailError", "");

    setFieldError("loginPassword", "loginPasswordError", "");

    if (!isValidEmail(email)) {
      setFieldError(
        "loginEmail",
        "loginEmailError",
        "Enter a valid email address.",
      );

      valid = false;
    }

    if (!password) {
      setFieldError(
        "loginPassword",
        "loginPasswordError",
        "Password is required.",
      );

      valid = false;
    }

    if (!valid) {
      showFormMessage("Please correct the highlighted fields.", "error");

      return;
    }

    const submitButton = loginForm.querySelector(".auth-submit-button");

    setButtonLoading(submitButton, true);

    try {
      const data = await sendAuthRequest("/api/auth/login", {
        email,
        password,
      });

      showFormMessage(data.message, "success");

      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 700);
    } catch (error) {
      showFormMessage(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

const passwordInput = getElement("registerPassword");

if (passwordInput) {
  passwordInput.addEventListener("input", () => {
    updatePasswordStrength(passwordInput.value);
  });
}

function updatePasswordStrength(password) {
  const strengthBar = getElement("strengthBar");

  const strengthText = getElement("strengthText");

  if (!strengthBar || !strengthText) {
    return;
  }

  let score = 0;

  if (password.length >= 8) {
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

  const levels = [
    ["0%", "Password strength", "transparent"],
    ["20%", "Very weak", "#ff5d73"],
    ["40%", "Weak", "#ff855d"],
    ["60%", "Fair", "#ffcc66"],
    ["80%", "Good", "#55c9ff"],
    ["100%", "Strong", "#3ce6a0"],
  ];

  const [width, text, background] = levels[score];

  strengthBar.style.width = width;
  strengthBar.style.background = background;

  strengthText.textContent = text;
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormMessage();

    const firstName = getElement("firstName").value.trim();

    const lastName = getElement("lastName").value.trim();

    const email = getElement("registerEmail").value.trim();

    const password = getElement("registerPassword").value;

    const confirmPassword = getElement("confirmPassword").value;

    const acceptTerms = getElement("acceptTerms").checked;

    let valid = true;

    [
      ["firstName", "firstNameError"],
      ["lastName", "lastNameError"],
      ["registerEmail", "registerEmailError"],
      ["registerPassword", "registerPasswordError"],
      ["confirmPassword", "confirmPasswordError"],
    ].forEach(([inputId, errorId]) => {
      setFieldError(inputId, errorId, "");
    });

    const termsError = getElement("acceptTermsError");

    if (termsError) {
      termsError.textContent = "";
    }

    if (firstName.length < 2) {
      setFieldError(
        "firstName",
        "firstNameError",
        "Enter at least 2 characters.",
      );

      valid = false;
    }

    if (lastName.length < 2) {
      setFieldError(
        "lastName",
        "lastNameError",
        "Enter at least 2 characters.",
      );

      valid = false;
    }

    if (!isValidEmail(email)) {
      setFieldError(
        "registerEmail",
        "registerEmailError",
        "Enter a valid email address.",
      );

      valid = false;
    }

    if (password.length < 8) {
      setFieldError(
        "registerPassword",
        "registerPasswordError",
        "Password must contain at least 8 characters.",
      );

      valid = false;
    }

    if (password !== confirmPassword) {
      setFieldError(
        "confirmPassword",
        "confirmPasswordError",
        "Passwords do not match.",
      );

      valid = false;
    }

    if (!acceptTerms) {
      termsError.textContent = "You must accept the terms.";

      valid = false;
    }

    if (!valid) {
      showFormMessage("Please correct the highlighted fields.", "error");

      return;
    }

    const submitButton = registerForm.querySelector(".auth-submit-button");

    setButtonLoading(submitButton, true);

    try {
      const data = await sendAuthRequest("/api/auth/register", {
        firstName,
        lastName,
        email,
        password,
      });

      showFormMessage(data.message, "success");

      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 700);
    } catch (error) {
      showFormMessage(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
