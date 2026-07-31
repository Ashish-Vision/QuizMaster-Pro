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

document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.passwordTarget;

    const input = getElement(targetId);

    if (!input) {
      return;
    }

    const showingPassword = input.type === "text";

    input.type = showingPassword ? "password" : "text";

    button.textContent = showingPassword ? "Show" : "Hide";

    button.setAttribute(
      "aria-label",
      showingPassword ? "Show password" : "Hide password",
    );
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

    if (!email) {
      setFieldError(
        "loginEmail",
        "loginEmailError",
        "Email address is required.",
      );

      valid = false;
    } else if (!isValidEmail(email)) {
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
      await new Promise((resolve) => {
        setTimeout(resolve, 700);
      });

      showFormMessage(
        "Login form is ready. Backend authentication will be connected in the next milestone.",
        "success",
      );
    } catch (error) {
      showFormMessage("Unable to process the request.", "error");
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

  const strengthLevels = [
    {
      width: "0%",
      text: "Password strength",
      background: "transparent",
    },
    {
      width: "20%",
      text: "Very weak",
      background: "#ff5d73",
    },
    {
      width: "40%",
      text: "Weak",
      background: "#ff855d",
    },
    {
      width: "60%",
      text: "Fair",
      background: "#ffcc66",
    },
    {
      width: "80%",
      text: "Good",
      background: "#55c9ff",
    },
    {
      width: "100%",
      text: "Strong",
      background: "#3ce6a0",
    },
  ];

  const strength = strengthLevels[score];

  strengthBar.style.width = strength.width;
  strengthBar.style.background = strength.background;

  strengthText.textContent = strength.text;
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

    setFieldError("firstName", "firstNameError", "");

    setFieldError("lastName", "lastNameError", "");

    setFieldError("registerEmail", "registerEmailError", "");

    setFieldError("registerPassword", "registerPasswordError", "");

    setFieldError("confirmPassword", "confirmPasswordError", "");

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

    if (!email) {
      setFieldError(
        "registerEmail",
        "registerEmailError",
        "Email address is required.",
      );

      valid = false;
    } else if (!isValidEmail(email)) {
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
      if (termsError) {
        termsError.textContent =
          "You must accept the terms and privacy policy.";
      }

      valid = false;
    }

    if (!valid) {
      showFormMessage("Please correct the highlighted fields.", "error");

      return;
    }

    const submitButton = registerForm.querySelector(".auth-submit-button");

    setButtonLoading(submitButton, true);

    try {
      await new Promise((resolve) => {
        setTimeout(resolve, 700);
      });

      showFormMessage(
        "Registration form is ready. Database registration will be connected in the next milestone.",
        "success",
      );
    } catch (error) {
      showFormMessage("Unable to process the request.", "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

const googleLoginButton = getElement("googleLoginButton");

const googleRegisterButton = getElement("googleRegisterButton");

function showGoogleNotice() {
  clearFormMessage();

  showFormMessage(
    "Google authentication will be added after the email authentication backend.",
    "success",
  );
}

if (googleLoginButton) {
  googleLoginButton.addEventListener("click", showGoogleNotice);
}

if (googleRegisterButton) {
  googleRegisterButton.addEventListener("click", showGoogleNotice);
}
