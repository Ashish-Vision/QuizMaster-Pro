"use strict";

const resultState = {
  result: null,
  submissionResponse: null,
  resultId: null,
  loading: false,
};

const elements = {
  resultCard: document.getElementById("resultCard"),
  resultError: document.getElementById("resultError"),

  resultCategory: document.getElementById("resultCategory"),

  scoreValue: document.getElementById("scoreValue"),
  scoreTotal: document.getElementById("scoreTotal"),

  accuracyValue: document.getElementById("accuracyValue"),
  correctValue: document.getElementById("correctValue"),
  wrongValue: document.getElementById("wrongValue"),
  unansweredValue: document.getElementById("unansweredValue"),

  xpValue: document.getElementById("xpValue"),
  timeValue: document.getElementById("timeValue"),

  retryQuizButton: document.getElementById("retryQuizButton"),
};

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getNumber(value).toLocaleString("en-IN");
}

function formatPercentage(value) {
  const number = getNumber(value);

  return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`;
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(getNumber(totalSeconds)));

  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`
  );
}

function getResultIdFromUrl() {
  const pathSegments = window.location.pathname.split("/").filter(Boolean);

  /*
   * Supports:
   * /result/:resultId
   */
  if (pathSegments[0] === "result" && pathSegments[1]) {
    return decodeURIComponent(pathSegments[1]);
  }

  /*
   * Supports:
   * /result?resultId=:resultId
   */
  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("resultId")?.trim() || null;
}

function readStoredJson(key) {
  try {
    const value = sessionStorage.getItem(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error(`Unable to read session storage key "${key}":`, error);

    return null;
  }
}

function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid result response.");
  }

  return response.json();
}

function showResult() {
  elements.resultError?.classList.add("hidden");
  elements.resultCard?.classList.remove("hidden");
}

function showError(message = "") {
  elements.resultCard?.classList.add("hidden");
  elements.resultError?.classList.remove("hidden");

  const errorParagraph = elements.resultError?.querySelector("p");

  if (errorParagraph && message) {
    errorParagraph.textContent = message;
  }
}

function normalizeResult(rawResult) {
  if (!rawResult || typeof rawResult !== "object") {
    return null;
  }

  const resultId =
    rawResult.resultId ||
    rawResult.id ||
    rawResult._id ||
    resultState.resultId ||
    null;

  const correctAnswers = getNumber(rawResult.correctAnswers ?? rawResult.score);

  const totalQuestions = getNumber(rawResult.totalQuestions);

  if (
    typeof rawResult.category !== "string" ||
    !rawResult.category.trim() ||
    totalQuestions <= 0
  ) {
    return null;
  }

  return {
    ...rawResult,

    resultId,

    category: rawResult.category.trim(),

    score: getNumber(rawResult.score ?? correctAnswers),

    totalQuestions,

    attemptedQuestions: getNumber(rawResult.attemptedQuestions),

    correctAnswers,

    wrongAnswers: getNumber(rawResult.wrongAnswers),

    unansweredQuestions: getNumber(rawResult.unansweredQuestions),

    accuracy: getNumber(rawResult.accuracy),

    xpEarned: getNumber(rawResult.xpEarned),

    timeTakenSeconds: getNumber(rawResult.timeTakenSeconds),
  };
}

function getDailyChallengeInformation() {
  const storedDailyChallenge = readStoredJson(
    "quizmaster_daily_challenge_result",
  );

  const storedSubmission = readStoredJson("quizmaster_submission_response");

  resultState.submissionResponse = storedSubmission;

  return storedDailyChallenge || storedSubmission?.dailyChallenge || null;
}

function renderResult(rawResult) {
  const normalizedResult = normalizeResult(rawResult);

  if (!normalizedResult) {
    showError("The result data is incomplete or invalid.");

    return false;
  }

  resultState.result = normalizedResult;

  const dailyChallenge = getDailyChallengeInformation();

  const isDailyChallenge = Boolean(
    normalizedResult.isDailyChallenge || dailyChallenge?.completed,
  );

  if (elements.resultCategory) {
    elements.resultCategory.textContent = isDailyChallenge
      ? `🔥 ${normalizedResult.category} Daily Challenge`
      : `${normalizedResult.category} Quiz`;
  }

  if (elements.scoreValue) {
    elements.scoreValue.textContent = formatNumber(
      normalizedResult.correctAnswers,
    );
  }

  if (elements.scoreTotal) {
    elements.scoreTotal.textContent = `/ ${formatNumber(
      normalizedResult.totalQuestions,
    )}`;
  }

  if (elements.accuracyValue) {
    elements.accuracyValue.textContent = formatPercentage(
      normalizedResult.accuracy,
    );
  }

  if (elements.correctValue) {
    elements.correctValue.textContent = formatNumber(
      normalizedResult.correctAnswers,
    );
  }

  if (elements.wrongValue) {
    elements.wrongValue.textContent = formatNumber(
      normalizedResult.wrongAnswers,
    );
  }

  if (elements.unansweredValue) {
    elements.unansweredValue.textContent = formatNumber(
      normalizedResult.unansweredQuestions,
    );
  }

  if (elements.xpValue) {
    elements.xpValue.textContent = `+${formatNumber(
      normalizedResult.xpEarned,
    )} XP`;
  }

  if (elements.timeValue) {
    elements.timeValue.textContent = formatTime(
      normalizedResult.timeTakenSeconds,
    );
  }

  if (elements.retryQuizButton && isDailyChallenge) {
    elements.retryQuizButton.textContent = "Return to Dashboard";
  }

  showResult();

  return true;
}

async function fetchResult(resultId) {
  const response = await fetch(
    `/api/quiz/result/${encodeURIComponent(resultId)}`,
    {
      method: "GET",
      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    },
  );

  if (response.status === 401) {
    window.location.href = "/login";

    return null;
  }

  const data = await parseJsonResponse(response);

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load the quiz result.");
  }

  if (!data.result) {
    throw new Error("The server did not return a quiz result.");
  }

  return data.result;
}

async function loadResult() {
  if (resultState.loading) {
    return;
  }

  resultState.loading = true;

  resultState.resultId = getResultIdFromUrl();

  try {
    /*
     * Primary source:
     * Load the permanent result from MongoDB using
     * the result ID in the page URL.
     */
    if (resultState.resultId) {
      const apiResult = await fetchResult(resultState.resultId);

      if (apiResult) {
        renderResult(apiResult);

        return;
      }
    }

    /*
     * Fallback:
     * Supports the old /result page flow that stores
     * the result only in sessionStorage.
     */
    const storedResult = readStoredJson("quizmaster_result");

    if (storedResult) {
      const rendered = renderResult(storedResult);

      if (rendered) {
        return;
      }
    }

    showError("We could not find your recent quiz result.");
  } catch (error) {
    console.error("Unable to load quiz result:", error);

    /*
     * Try sessionStorage if the API request fails.
     */
    const storedResult = readStoredJson("quizmaster_result");

    if (storedResult && renderResult(storedResult)) {
      return;
    }

    showError(error.message || "We could not find your recent quiz result.");
  } finally {
    resultState.loading = false;
  }
}

function retryQuiz() {
  const result = resultState.result;

  if (!result?.category) {
    window.location.href = "/dashboard";

    return;
  }

  const dailyChallenge = getDailyChallengeInformation();

  const isDailyChallenge = Boolean(
    result.isDailyChallenge || dailyChallenge?.completed,
  );

  sessionStorage.removeItem("quizmaster_result");

  sessionStorage.removeItem("quizmaster_submission_response");

  sessionStorage.removeItem("quizmaster_daily_challenge_result");

  /*
   * Daily challenges may only be completed once.
   * The button therefore returns to the dashboard
   * instead of starting the challenge again.
   */
  if (isDailyChallenge) {
    window.location.href = "/dashboard";

    return;
  }

  window.location.href = `/quiz?category=${encodeURIComponent(
    result.category,
  )}`;
}

elements.retryQuizButton?.addEventListener("click", retryQuiz);

loadResult();
