"use strict";

const resultState = {
  result: null,
  submissionResponse: null,
  dailyChallenge: null,
  resultId: null,
  loading: false,
  reviewVisible: false,
  animationFrameIds: new Set(),
};

const elements = {
  resultCard: document.getElementById("resultCard"),
  resultError: document.getElementById("resultError"),
  resultErrorMessage: document.getElementById("resultErrorMessage"),

  resultIcon: document.getElementById("resultIcon"),
  resultLabel: document.getElementById("resultLabel"),
  resultCategory: document.getElementById("resultCategory"),

  dailyChallengeReward: document.getElementById("dailyChallengeReward"),

  dailyChallengeRewardText: document.getElementById("dailyChallengeRewardText"),

  scoreCircle: document.getElementById("scoreCircle"),
  scoreValue: document.getElementById("scoreValue"),
  scoreTotal: document.getElementById("scoreTotal"),

  accuracyValue: document.getElementById("accuracyValue"),
  correctValue: document.getElementById("correctValue"),
  wrongValue: document.getElementById("wrongValue"),
  unansweredValue: document.getElementById("unansweredValue"),

  xpValue: document.getElementById("xpValue"),
  timeValue: document.getElementById("timeValue"),

  retryQuizButton: document.getElementById("retryQuizButton"),

  reviewAnswersButton: document.getElementById("reviewAnswersButton"),

  reviewSection: document.getElementById("reviewSection"),

  closeReviewButton: document.getElementById("closeReviewButton"),

  reviewList: document.getElementById("reviewList"),

  reviewCorrectCount: document.getElementById("reviewCorrectCount"),

  reviewWrongCount: document.getElementById("reviewWrongCount"),

  reviewUnansweredCount: document.getElementById("reviewUnansweredCount"),
};

/* ============================================================
   Number and Formatting Helpers
============================================================ */

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

/* ============================================================
   Animation Helpers
============================================================ */

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function cancelResultAnimations() {
  resultState.animationFrameIds.forEach((animationFrameId) => {
    window.cancelAnimationFrame(animationFrameId);
  });

  resultState.animationFrameIds.clear();
}

function animateNumber({
  element,
  from = 0,
  to = 0,
  duration = 900,
  formatter = formatNumber,
  delay = 0,
}) {
  if (!element) {
    return;
  }

  const startValue = getNumber(from);
  const targetValue = getNumber(to);

  if (prefersReducedMotion() || duration <= 0 || startValue === targetValue) {
    element.textContent = formatter(targetValue);

    return;
  }

  let animationStartTime = null;
  let delayStartTime = null;

  function animationStep(timestamp) {
    if (delayStartTime === null) {
      delayStartTime = timestamp;
    }

    if (timestamp - delayStartTime < delay) {
      const delayFrameId = window.requestAnimationFrame(animationStep);

      resultState.animationFrameIds.add(delayFrameId);

      return;
    }

    if (animationStartTime === null) {
      animationStartTime = timestamp;
    }

    const elapsed = timestamp - animationStartTime;

    const progress = Math.min(elapsed / duration, 1);

    /*
     * Ease-out cubic:
     * starts quickly and slows near the target.
     */
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    const currentValue =
      startValue + (targetValue - startValue) * easedProgress;

    element.textContent = formatter(currentValue);

    if (progress < 1) {
      const frameId = window.requestAnimationFrame(animationStep);

      resultState.animationFrameIds.add(frameId);
    } else {
      element.textContent = formatter(targetValue);
    }
  }

  const frameId = window.requestAnimationFrame(animationStep);

  resultState.animationFrameIds.add(frameId);
}

function animateResultStatistics(result) {
  cancelResultAnimations();

  animateNumber({
    element: elements.scoreValue,
    from: 0,
    to: result.correctAnswers,
    duration: 700,
    delay: 100,
    formatter(value) {
      return formatNumber(Math.round(value));
    },
  });

  animateNumber({
    element: elements.accuracyValue,
    from: 0,
    to: result.accuracy,
    duration: 850,
    delay: 180,
    formatter(value) {
      return `${value.toFixed(value >= 100 ? 0 : 1)}%`;
    },
  });

  animateNumber({
    element: elements.correctValue,
    from: 0,
    to: result.correctAnswers,
    duration: 700,
    delay: 220,
    formatter(value) {
      return formatNumber(Math.round(value));
    },
  });

  animateNumber({
    element: elements.wrongValue,
    from: 0,
    to: result.wrongAnswers,
    duration: 700,
    delay: 280,
    formatter(value) {
      return formatNumber(Math.round(value));
    },
  });

  animateNumber({
    element: elements.unansweredValue,
    from: 0,
    to: result.unansweredQuestions,
    duration: 700,
    delay: 340,
    formatter(value) {
      return formatNumber(Math.round(value));
    },
  });

  animateNumber({
    element: elements.xpValue,
    from: 0,
    to: result.xpEarned,
    duration: 1200,
    delay: 400,
    formatter(value) {
      return `+${formatNumber(Math.round(value))} XP`;
    },
  });
}

/* ============================================================
   URL and Storage Helpers
============================================================ */

function getResultIdFromUrl() {
  const pathSegments = window.location.pathname.split("/").filter(Boolean);

  if (pathSegments[0] === "result" && pathSegments[1]) {
    return decodeURIComponent(pathSegments[1]);
  }

  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("resultId")?.trim() || null;
}

function readStoredJson(key) {
  try {
    const value = sessionStorage.getItem(key);

    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Unable to read session storage key "${key}":`, error);

    return null;
  }
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid result response.");
  }

  return response.json();
}

/* ============================================================
   Visibility Helpers
============================================================ */

function toggleElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !shouldShow);
}

function showResult() {
  toggleElement(elements.resultError, false);

  toggleElement(elements.resultCard, true);
}

function showError(message = "") {
  cancelResultAnimations();

  toggleElement(elements.resultCard, false);

  toggleElement(elements.reviewSection, false);

  toggleElement(elements.resultError, true);

  if (elements.resultErrorMessage && message) {
    elements.resultErrorMessage.textContent = message;
  }
}

/* ============================================================
   Result Normalization
============================================================ */

function normalizeQuestion(question) {
  if (!question) {
    return null;
  }

  return {
    id: question._id || question.id || null,

    question: question.question || "Question unavailable",

    options: Array.isArray(question.options) ? question.options : [],

    explanation: question.explanation || "",

    difficulty: question.difficulty || "Easy",
  };
}

function normalizeAnswer(answer, index) {
  if (!answer || typeof answer !== "object") {
    return null;
  }

  const question = normalizeQuestion(answer.question);

  return {
    index,
    question,

    selectedAnswer:
      answer.selectedAnswer === null || answer.selectedAnswer === undefined
        ? null
        : getNumber(answer.selectedAnswer),

    correctAnswer:
      answer.correctAnswer === null || answer.correctAnswer === undefined
        ? null
        : getNumber(answer.correctAnswer),

    isCorrect: Boolean(answer.isCorrect),
  };
}

function normalizeResult(rawResult) {
  if (!rawResult || typeof rawResult !== "object") {
    return null;
  }

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

    resultId:
      rawResult.resultId ||
      rawResult.id ||
      rawResult._id ||
      resultState.resultId ||
      null,

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

    answers: Array.isArray(rawResult.answers)
      ? rawResult.answers.map(normalizeAnswer).filter(Boolean)
      : [],
  };
}

/* ============================================================
   Daily Challenge Information
============================================================ */

function getDailyChallengeInformation() {
  const storedDailyChallenge = readStoredJson(
    "quizmaster_daily_challenge_result",
  );

  const storedSubmission = readStoredJson("quizmaster_submission_response");

  resultState.submissionResponse = storedSubmission;

  return storedDailyChallenge || storedSubmission?.dailyChallenge || null;
}

function isDailyChallengeResult(result) {
  return Boolean(
    result?.isDailyChallenge ||
    resultState.dailyChallenge?.completed ||
    resultState.submissionResponse?.result?.isDailyChallenge,
  );
}

function renderDailyChallengeInformation(result) {
  const isDailyChallenge = isDailyChallengeResult(result);

  toggleElement(elements.dailyChallengeReward, isDailyChallenge);

  if (!isDailyChallenge) {
    return;
  }

  if (elements.resultIcon) {
    elements.resultIcon.textContent = "🔥";
  }

  if (elements.resultLabel) {
    elements.resultLabel.textContent = "Daily challenge completed";
  }

  if (elements.dailyChallengeRewardText) {
    const bonusXp = getNumber(
      result.dailyChallengeBonusXp ||
        resultState.dailyChallenge?.rewardXp ||
        resultState.submissionResponse?.result?.dailyChallengeBonusXp,
    );

    elements.dailyChallengeRewardText.textContent =
      bonusXp > 0
        ? `You earned +${formatNumber(bonusXp)} bonus XP`
        : "Today's challenge reward has been claimed";
  }

  if (elements.retryQuizButton) {
    elements.retryQuizButton.textContent = "Return to Dashboard";
  }
}

/* ============================================================
   Result Rendering
============================================================ */

function renderScoreProgress(result) {
  if (!elements.scoreCircle) {
    return;
  }

  const percentage = Math.min(Math.max(getNumber(result.accuracy), 0), 100);

  elements.scoreCircle.style.setProperty(
    "--score-progress",
    `${percentage * 3.6}deg`,
  );

  elements.scoreCircle.setAttribute(
    "aria-label",
    `Score ${result.correctAnswers} out of ${result.totalQuestions}`,
  );
}

function renderResult(rawResult) {
  const result = normalizeResult(rawResult);

  if (!result) {
    showError("The result data is incomplete or invalid.");

    return false;
  }

  resultState.result = result;

  resultState.dailyChallenge = getDailyChallengeInformation();

  const isDailyChallenge = isDailyChallengeResult(result);

  if (elements.resultCategory) {
    elements.resultCategory.textContent = isDailyChallenge
      ? `🔥 ${result.category} Daily Challenge`
      : `${result.category} Quiz`;
  }

  /*
   * Set initial values before animation starts.
   */
  if (elements.scoreValue) {
    elements.scoreValue.textContent = "0";
  }

  if (elements.scoreTotal) {
    elements.scoreTotal.textContent = `/ ${formatNumber(
      result.totalQuestions,
    )}`;
  }

  if (elements.accuracyValue) {
    elements.accuracyValue.textContent = "0%";
  }

  if (elements.correctValue) {
    elements.correctValue.textContent = "0";
  }

  if (elements.wrongValue) {
    elements.wrongValue.textContent = "0";
  }

  if (elements.unansweredValue) {
    elements.unansweredValue.textContent = "0";
  }

  if (elements.xpValue) {
    elements.xpValue.textContent = "+0 XP";
  }

  if (elements.timeValue) {
    elements.timeValue.textContent = formatTime(result.timeTakenSeconds);
  }

  renderScoreProgress(result);

  renderDailyChallengeInformation(result);

  renderReview(result);

  if (elements.reviewAnswersButton && result.answers.length === 0) {
    elements.reviewAnswersButton.disabled = true;

    elements.reviewAnswersButton.textContent = "Review Unavailable";
  }

  showResult();

  /*
   * Begin all result animations after
   * the result card becomes visible.
   */
  window.requestAnimationFrame(() => {
    animateResultStatistics(result);
  });

  return true;
}

/* ============================================================
   Review Rendering
============================================================ */

function getOptionText(question, answerIndex) {
  if (answerIndex === null || answerIndex === undefined) {
    return "Not answered";
  }

  if (
    !question ||
    !Array.isArray(question.options) ||
    !question.options[answerIndex]
  ) {
    return `Option ${answerIndex + 1}`;
  }

  return question.options[answerIndex];
}

function createAnswerBlock({ label, value, className, icon }) {
  const wrapper = document.createElement("div");

  wrapper.className = `review-answer ${className}`.trim();

  const heading = document.createElement("span");

  heading.className = "review-answer-label";

  heading.textContent = `${icon} ${label}`;

  const answerText = document.createElement("strong");

  answerText.textContent = value;

  wrapper.append(heading, answerText);

  return wrapper;
}

function createReviewItem(answer) {
  const question = answer.question;

  const article = document.createElement("article");

  article.className = "review-item";

  if (answer.isCorrect) {
    article.classList.add("correct");
  } else if (answer.selectedAnswer === null) {
    article.classList.add("unanswered");
  } else {
    article.classList.add("wrong");
  }

  const header = document.createElement("div");

  header.className = "review-item-header";

  const questionNumber = document.createElement("span");

  questionNumber.className = "review-question-number";

  questionNumber.textContent = `Question ${answer.index + 1}`;

  const difficulty = document.createElement("span");

  difficulty.className = `review-difficulty ${String(
    question?.difficulty || "Easy",
  ).toLowerCase()}`;

  difficulty.textContent = question?.difficulty || "Easy";

  header.append(questionNumber, difficulty);

  const questionText = document.createElement("h3");

  questionText.textContent = question?.question || "Question unavailable";

  const answersContainer = document.createElement("div");

  answersContainer.className = "review-answer-grid";

  const selectedAnswerText = getOptionText(question, answer.selectedAnswer);

  const correctAnswerText = getOptionText(question, answer.correctAnswer);

  let selectedClass = "selected-answer";

  let selectedIcon = "➖";

  if (answer.selectedAnswer === null) {
    selectedClass += " unanswered-answer";

    selectedIcon = "⚪";
  } else if (answer.isCorrect) {
    selectedClass += " correct-answer";

    selectedIcon = "✅";
  } else {
    selectedClass += " wrong-answer";

    selectedIcon = "❌";
  }

  answersContainer.append(
    createAnswerBlock({
      label: "Your Answer",
      value: selectedAnswerText,
      className: selectedClass,
      icon: selectedIcon,
    }),

    createAnswerBlock({
      label: "Correct Answer",
      value: correctAnswerText,
      className: "correct-answer",
      icon: "✅",
    }),
  );

  const explanation = document.createElement("div");

  explanation.className = "review-explanation";

  const explanationTitle = document.createElement("span");

  explanationTitle.textContent = "Explanation";

  const explanationText = document.createElement("p");

  explanationText.textContent =
    question?.explanation || "No explanation is available for this question.";

  explanation.append(explanationTitle, explanationText);

  article.append(header, questionText, answersContainer, explanation);

  return article;
}

function renderReview(result) {
  if (!elements.reviewList) {
    return;
  }

  elements.reviewList.innerHTML = "";

  if (elements.reviewCorrectCount) {
    elements.reviewCorrectCount.textContent = formatNumber(
      result.correctAnswers,
    );
  }

  if (elements.reviewWrongCount) {
    elements.reviewWrongCount.textContent = formatNumber(result.wrongAnswers);
  }

  if (elements.reviewUnansweredCount) {
    elements.reviewUnansweredCount.textContent = formatNumber(
      result.unansweredQuestions,
    );
  }

  if (!result.answers.length) {
    const empty = document.createElement("div");

    empty.className = "review-empty";

    empty.textContent = "Answer details are not available for this result.";

    elements.reviewList.appendChild(empty);

    return;
  }

  result.answers.forEach((answer) => {
    elements.reviewList.appendChild(createReviewItem(answer));
  });
}

/* ============================================================
   Result Loading
============================================================ */

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
    if (resultState.resultId) {
      const apiResult = await fetchResult(resultState.resultId);

      if (apiResult && renderResult(apiResult)) {
        return;
      }
    }

    const storedResult = readStoredJson("quizmaster_result");

    if (storedResult && renderResult(storedResult)) {
      return;
    }

    showError("We could not find your recent quiz result.");
  } catch (error) {
    console.error("Unable to load quiz result:", error);

    const storedResult = readStoredJson("quizmaster_result");

    if (storedResult && renderResult(storedResult)) {
      return;
    }

    showError(error.message || "We could not find your recent quiz result.");
  } finally {
    resultState.loading = false;
  }
}

/* ============================================================
   Review Toggle
============================================================ */

function toggleReview(forceState = null) {
  if (!resultState.result || !resultState.result.answers.length) {
    return;
  }

  resultState.reviewVisible =
    forceState === null ? !resultState.reviewVisible : Boolean(forceState);

  toggleElement(elements.reviewSection, resultState.reviewVisible);

  if (elements.reviewAnswersButton) {
    elements.reviewAnswersButton.textContent = resultState.reviewVisible
      ? "Hide Answers"
      : "Review Answers";

    elements.reviewAnswersButton.setAttribute(
      "aria-expanded",
      String(resultState.reviewVisible),
    );
  }

  if (resultState.reviewVisible) {
    elements.reviewSection?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

/* ============================================================
   Retry Navigation
============================================================ */

function retryQuiz() {
  const result = resultState.result;

  if (!result?.category) {
    window.location.href = "/dashboard";

    return;
  }

  const isDailyChallenge = isDailyChallengeResult(result);

  sessionStorage.removeItem("quizmaster_result");

  sessionStorage.removeItem("quizmaster_submission_response");

  sessionStorage.removeItem("quizmaster_daily_challenge_result");

  if (isDailyChallenge) {
    window.location.href = "/dashboard";

    return;
  }

  window.location.href = `/quiz?category=${encodeURIComponent(
    result.category,
  )}`;
}

/* ============================================================
   Event Listeners
============================================================ */

elements.retryQuizButton?.addEventListener("click", retryQuiz);

elements.reviewAnswersButton?.addEventListener("click", () => {
  toggleReview();
});

elements.closeReviewButton?.addEventListener("click", () => {
  toggleReview(false);
});

window.addEventListener("beforeunload", cancelResultAnimations);

loadResult();
