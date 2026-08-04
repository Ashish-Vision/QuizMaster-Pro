"use strict";

const state = {
  settings: [],
  originalValues: {},
  currentValues: {},
  isLoading: false,
  isSaving: false,
  toastTimer: null,
};

const elements = {
  form: document.getElementById("adminSettingsForm"),

  loadingState: document.getElementById("settingsLoadingState"),
  errorState: document.getElementById("settingsErrorState"),
  errorMessage: document.getElementById("settingsErrorMessage"),
  retryButton: document.getElementById("retrySettingsButton"),
  content: document.getElementById("settingsContent"),

  saveButton: document.getElementById("saveSettingsButton"),
  footerSaveButton: document.getElementById("footerSaveButton"),

  resetButton: document.getElementById("resetSettingsButton"),
  footerResetButton: document.getElementById("footerResetButton"),

  statusIndicator: document.getElementById("settingsStatusIndicator"),
  statusText: document.getElementById("settingsStatusText"),
  lastUpdated: document.getElementById("settingsLastUpdated"),
  footerChangeMessage: document.getElementById("footerChangeMessage"),

  maintenanceMode: document.getElementById("maintenance_mode"),
  maintenanceWarning: document.getElementById("maintenanceWarning"),

  resetModal: document.getElementById("resetSettingsModal"),
  confirmResetButton: document.getElementById("confirmResetSettingsButton"),
  resetMessage: document.getElementById("resetSettingsMessage"),

  toast: document.getElementById("settingsToast"),
  toastIcon: document.getElementById("settingsToastIcon"),
  toastTitle: document.getElementById("settingsToastTitle"),
  toastMessage: document.getElementById("settingsToastMessage"),
};

function showElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = String(value ?? "");
}

function getNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Last updated information unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function showLoadingState() {
  showElement(elements.loadingState, true);
  showElement(elements.errorState, false);
  showElement(elements.content, false);
}

function showErrorState(message) {
  setText(
    elements.errorMessage,
    message || "Unable to load platform settings.",
  );

  showElement(elements.loadingState, false);
  showElement(elements.errorState, true);
  showElement(elements.content, false);
}

function showContentState() {
  showElement(elements.loadingState, false);
  showElement(elements.errorState, false);
  showElement(elements.content, true);
}

function getFieldByKey(key) {
  return document.getElementById(key);
}

function normalizeValueForField(setting, field) {
  if (!field) {
    return null;
  }

  if (setting.valueType === "boolean") {
    return Boolean(field.checked);
  }

  if (setting.valueType === "number") {
    return getNumber(field.value);
  }

  return field.value.trim();
}

function applyValueToField(setting) {
  const field = getFieldByKey(setting.key);

  if (!field) {
    return;
  }

  if (setting.valueType === "boolean") {
    field.checked = Boolean(setting.value);
    return;
  }

  field.value = setting.value ?? "";
}

function buildValuesObject() {
  const values = {};

  state.settings.forEach((setting) => {
    const field = getFieldByKey(setting.key);

    if (!field) {
      return;
    }

    values[setting.key] = normalizeValueForField(setting, field);
  });

  return values;
}

function valuesAreEqual(first, second) {
  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  return firstKeys.every((key) => first[key] === second[key]);
}

function hasUnsavedChanges() {
  state.currentValues = buildValuesObject();

  return !valuesAreEqual(state.originalValues, state.currentValues);
}

function updateMaintenanceWarning() {
  showElement(
    elements.maintenanceWarning,
    Boolean(elements.maintenanceMode?.checked),
  );
}

function setStatus(mode) {
  if (!elements.statusIndicator) {
    return;
  }

  elements.statusIndicator.classList.remove("saved", "unsaved", "saving");

  if (mode === "saving") {
    elements.statusIndicator.classList.add("saving");
    setText(elements.statusText, "Saving changes...");
    setText(elements.footerChangeMessage, "Saving platform settings...");
    return;
  }

  if (mode === "unsaved") {
    elements.statusIndicator.classList.add("unsaved");
    setText(elements.statusText, "Unsaved changes");
    setText(elements.footerChangeMessage, "You have unsaved changes");
    return;
  }

  elements.statusIndicator.classList.add("saved");
  setText(elements.statusText, "All changes saved");
  setText(elements.footerChangeMessage, "No unsaved changes");
}

function updateSaveButtons() {
  const hasChanges = hasUnsavedChanges();

  const shouldDisable = !hasChanges || state.isSaving || state.isLoading;

  if (elements.saveButton) {
    elements.saveButton.disabled = shouldDisable;
  }

  if (elements.footerSaveButton) {
    elements.footerSaveButton.disabled = shouldDisable;
  }

  setStatus(hasChanges ? "unsaved" : "saved");
}

function markInvalid(field, isInvalid) {
  field?.classList.toggle("invalid", isInvalid);
}

function validateSettings() {
  let isValid = true;

  const platformName = getFieldByKey("platform_name");
  const platformDescription = getFieldByKey("platform_description");
  const quizTime = getFieldByKey("default_quiz_time_minutes");
  const questionsPerQuiz = getFieldByKey("questions_per_quiz");
  const xpMultiplier = getFieldByKey("default_xp_multiplier");
  const maintenanceMessage = getFieldByKey("maintenance_message");

  const platformNameInvalid =
    !platformName?.value.trim() || platformName.value.trim().length > 100;

  markInvalid(platformName, platformNameInvalid);

  if (platformNameInvalid) {
    isValid = false;
  }

  const platformDescriptionInvalid =
    platformDescription?.value.trim().length > 500;

  markInvalid(platformDescription, platformDescriptionInvalid);

  if (platformDescriptionInvalid) {
    isValid = false;
  }

  const quizTimeValue = getNumber(quizTime?.value, NaN);

  const quizTimeInvalid =
    !Number.isFinite(quizTimeValue) || quizTimeValue < 1 || quizTimeValue > 180;

  markInvalid(quizTime, quizTimeInvalid);

  if (quizTimeInvalid) {
    isValid = false;
  }

  const questionsPerQuizValue = getNumber(questionsPerQuiz?.value, NaN);

  const questionsPerQuizInvalid =
    !Number.isInteger(questionsPerQuizValue) ||
    questionsPerQuizValue < 1 ||
    questionsPerQuizValue > 100;

  markInvalid(questionsPerQuiz, questionsPerQuizInvalid);

  if (questionsPerQuizInvalid) {
    isValid = false;
  }

  const xpMultiplierValue = getNumber(xpMultiplier?.value, NaN);

  const xpMultiplierInvalid =
    !Number.isFinite(xpMultiplierValue) ||
    xpMultiplierValue < 0 ||
    xpMultiplierValue > 10;

  markInvalid(xpMultiplier, xpMultiplierInvalid);

  if (xpMultiplierInvalid) {
    isValid = false;
  }

  const maintenanceMessageInvalid =
    maintenanceMessage?.value.trim().length > 500 ||
    (elements.maintenanceMode?.checked && !maintenanceMessage?.value.trim());

  markInvalid(maintenanceMessage, maintenanceMessageInvalid);

  if (maintenanceMessageInvalid) {
    isValid = false;
  }

  return isValid;
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid response.");
  }

  return response.json();
}

function renderSettings(settings) {
  state.settings = Array.isArray(settings) ? settings : [];

  state.settings.forEach(applyValueToField);

  state.originalValues = buildValuesObject();
  state.currentValues = {
    ...state.originalValues,
  };

  const updatedDates = state.settings
    .map((setting) => new Date(setting.updatedAt))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (updatedDates.length > 0) {
    const latestDate = new Date(
      Math.max(...updatedDates.map((date) => date.getTime())),
    );

    setText(elements.lastUpdated, `Last updated ${formatDateTime(latestDate)}`);
  } else {
    setText(elements.lastUpdated, "Last updated information unavailable");
  }

  updateMaintenanceWarning();
  updateSaveButtons();
  showContentState();
}

async function loadSettings() {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;

  showLoadingState();

  try {
    const response = await fetch("/api/admin/settings", {
      method: "GET",
      credentials: "include",
      cache: "no-store",

      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load platform settings.");
    }

    renderSettings(data.settings);
  } catch (error) {
    console.error("Settings loading error:", error);

    showErrorState(error.message || "Unable to load platform settings.");
  } finally {
    state.isLoading = false;
  }
}

function showToast({ type = "success", title, message }) {
  if (!elements.toast) {
    return;
  }

  window.clearTimeout(state.toastTimer);

  elements.toast.classList.remove("error");

  if (type === "error") {
    elements.toast.classList.add("error");
  }

  setText(elements.toastIcon, type === "error" ? "!" : "✓");

  setText(
    elements.toastTitle,
    title || (type === "error" ? "Error" : "Success"),
  );

  setText(elements.toastMessage, message || "");

  showElement(elements.toast, true);

  state.toastTimer = window.setTimeout(() => {
    showElement(elements.toast, false);
  }, 3500);
}

async function saveSettings(event) {
  event?.preventDefault();

  if (state.isSaving || !hasUnsavedChanges()) {
    return;
  }

  if (!validateSettings()) {
    showToast({
      type: "error",
      title: "Invalid settings",
      message: "Review the highlighted fields before saving.",
    });

    return;
  }

  state.isSaving = true;

  if (elements.saveButton) {
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = "Saving...";
  }

  if (elements.footerSaveButton) {
    elements.footerSaveButton.disabled = true;
    elements.footerSaveButton.textContent = "Saving...";
  }

  setStatus("saving");

  try {
    const settings = buildValuesObject();

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      credentials: "include",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        settings,
      }),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to save platform settings.");
    }

    state.originalValues = {
      ...settings,
    };

    state.currentValues = {
      ...settings,
    };

    setText(elements.lastUpdated, `Last updated ${formatDateTime(new Date())}`);

    updateSaveButtons();

    showToast({
      title: "Settings updated",
      message: data.message || "Platform settings saved successfully.",
    });
  } catch (error) {
    console.error("Settings save error:", error);

    setStatus("unsaved");

    showToast({
      type: "error",
      title: "Unable to save settings",
      message: error.message || "Platform settings could not be saved.",
    });
  } finally {
    state.isSaving = false;

    if (elements.saveButton) {
      elements.saveButton.textContent = "Save Changes";
    }

    if (elements.footerSaveButton) {
      elements.footerSaveButton.textContent = "Save Changes";
    }

    updateSaveButtons();
  }
}

function openResetModal() {
  elements.resetMessage?.classList.remove("error", "success");

  setText(elements.resetMessage, "");

  showElement(elements.resetModal, true);

  elements.resetModal?.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");
}

function closeResetModal() {
  showElement(elements.resetModal, false);

  elements.resetModal?.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");
}

async function resetSettings() {
  if (state.isSaving) {
    return;
  }

  state.isSaving = true;

  const originalText =
    elements.confirmResetButton?.textContent || "Reset Settings";

  if (elements.confirmResetButton) {
    elements.confirmResetButton.disabled = true;
    elements.confirmResetButton.textContent = "Resetting...";
  }

  elements.resetMessage?.classList.remove("error", "success");

  setText(elements.resetMessage, "");

  try {
    const response = await fetch("/api/admin/settings/reset", {
      method: "POST",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }

    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to reset platform settings.");
    }

    renderSettings(data.settings);

    elements.resetMessage?.classList.add("success");

    setText(
      elements.resetMessage,
      data.message || "Platform settings restored.",
    );

    showToast({
      title: "Settings restored",
      message:
        data.message || "Platform settings were restored to their defaults.",
    });

    window.setTimeout(closeResetModal, 650);
  } catch (error) {
    console.error("Settings reset error:", error);

    elements.resetMessage?.classList.add("error");

    setText(
      elements.resetMessage,
      error.message || "Unable to reset settings.",
    );
  } finally {
    state.isSaving = false;

    if (elements.confirmResetButton) {
      elements.confirmResetButton.disabled = false;
      elements.confirmResetButton.textContent = originalText;
    }

    updateSaveButtons();
  }
}

function handleFieldChange() {
  updateMaintenanceWarning();
  updateSaveButtons();
}

function warnBeforeLeaving(event) {
  if (!hasUnsavedChanges()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
}

function initializeSettings() {
  elements.form?.addEventListener("submit", saveSettings);

  elements.saveButton?.addEventListener("click", saveSettings);

  elements.resetButton?.addEventListener("click", openResetModal);

  elements.footerResetButton?.addEventListener("click", openResetModal);

  elements.confirmResetButton?.addEventListener("click", resetSettings);

  elements.retryButton?.addEventListener("click", loadSettings);

  elements.form?.querySelectorAll("input, textarea").forEach((field) => {
    field.addEventListener("input", handleFieldChange);
    field.addEventListener("change", handleFieldChange);
  });

  document.querySelectorAll("[data-close-reset-modal]").forEach((element) => {
    element.addEventListener("click", closeResetModal);
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !elements.resetModal?.classList.contains("hidden")
    ) {
      closeResetModal();
    }
  });

  window.addEventListener("beforeunload", warnBeforeLeaving);

  loadSettings();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSettings, {
    once: true,
  });
} else {
  initializeSettings();
}
