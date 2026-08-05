"use strict";

const VALIDATION_ORIGIN = "https://quizmaster.invalid";

const INVALID_RAW_CHARACTER_PATTERN = /[\u0000-\u0020\u007f\\]/;
const INVALID_DECODED_CHARACTER_PATTERN = /[\u0000-\u001f\u007f\\]/;
const INVALID_PERCENT_ESCAPE_PATTERN = /%(?![0-9a-fA-F]{2})/;

const INVALID_LINK_MESSAGE =
  "Notification link must be empty or a same-origin path beginning with a single '/'.";

function invalidResult() {
  return {
    isValid: false,
    message: INVALID_LINK_MESSAGE,
  };
}

function validateNotificationLink(value) {
  if (typeof value !== "string") {
    return invalidResult();
  }

  if (value === "") {
    return {
      isValid: true,
      message: "",
    };
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    INVALID_RAW_CHARACTER_PATTERN.test(value) ||
    INVALID_PERCENT_ESCAPE_PATTERN.test(value)
  ) {
    return invalidResult();
  }

  let decodedValue;

  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    return invalidResult();
  }

  if (
    decodedValue.startsWith("//") ||
    INVALID_DECODED_CHARACTER_PATTERN.test(decodedValue)
  ) {
    return invalidResult();
  }

  try {
    const parsedUrl = new URL(value, VALIDATION_ORIGIN);

    if (
      parsedUrl.origin !== VALIDATION_ORIGIN ||
      !parsedUrl.pathname.startsWith("/") ||
      parsedUrl.pathname.startsWith("//") ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return invalidResult();
    }
  } catch {
    return invalidResult();
  }

  return {
    isValid: true,
    message: "",
  };
}

module.exports = {
  INVALID_LINK_MESSAGE,
  validateNotificationLink,
};
