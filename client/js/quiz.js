"use strict";

const QUIZ_DURATION_SECONDS = 10 * 60;

const state = {
  category: "",
  questions: [],
  answers: {},
  currentIndex: 0,
  remainingSeconds: QUIZ_DURATION_SECONDS,
  timerId: null,
  submitting: false,

  isDailyChallenge: false,
  dailyChallengeId: null,
  dailyChallenge: null,
  quizSessionId: null,
};

const elements = {
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  errorMessage: document.getElementById("errorMessage"),
  retryButton: document.getElementById("retryButton"),

  quizContent: document.getElementById("quizContent"),
  categoryName: document.getElementById("categoryName"),

  currentQuestionNumber: document.getElementById("currentQuestionNumber"),

  totalQuestionCount: document.getElementById("totalQuestionCount"),

  progressTrack: document.getElementById("progressTrack"),
  progressBar: document.getElementById("progressBar"),

  difficultyBadge: document.getElementById("difficultyBadge"),

  answeredStatus: document.getElementById("answeredStatus"),

  questionText: document.getElementById("questionText"),
  optionsContainer: document.getElementById("optionsContainer"),

  answeredCount: document.getElementById("answeredCount"),

  previousButton: document.getElementById("previousButton"),

  nextButton: document.getElementById("nextButton"),
  submitButton: document.getElementById("submitButton"),

  timer: document.getElementById("timer"),
  timerValue: document.getElementById("timerValue"),

  submitModal: document.getElementById("submitModal"),
  submitSummary: document.getElementById("submitSummary"),

  cancelSubmitButton: document.getElementById("cancelSubmitButton"),

  confirmSubmitButton: document.getElementById("confirmSubmitButton"),

  submitModalTitle: document.getElementById("submitModalTitle"),
};

/* ============================================================
   URL and Mode Helpers
============================================================ */

function getUrlParameters() {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    category: searchParams.get("category")?.trim() || "",

    isDailyChallenge: searchParams.get("daily") === "true",

    dailyChallengeId: searchParams.get("challengeId")?.trim() || null,
  };
}

function configureQuizMode() {
  const parameters = getUrlParameters();

  state.category = parameters.category;

  state.isDailyChallenge = parameters.isDailyChallenge;

  state.dailyChallengeId = parameters.dailyChallengeId;

  if (state.isDailyChallenge && !state.dailyChallengeId) {
    throw new Error("The daily challenge ID is missing.");
  }
}

function getStorageKey() {
  if (state.isDailyChallenge && state.dailyChallengeId) {
    return `quizmaster_daily_challenge_${state.dailyChallengeId}`;
  }

  return `quizmaster_quiz_${state.category}`;
}

/* ============================================================
   State Display
============================================================ */

function showLoading() {
  elements.loadingState?.classList.remove("hidden");
  elements.errorState?.classList.add("hidden");
  elements.quizContent?.classList.add("hidden");
}

function showError(message) {
  stopTimer();

  elements.loadingState?.classList.add("hidden");
  elements.quizContent?.classList.add("hidden");
  elements.errorState?.classList.remove("hidden");

  if (elements.errorMessage) {
    elements.errorMessage.textContent =
      message || "Something went wrong while loading the quiz.";
  }
}

function showQuiz() {
  elements.loadingState?.classList.add("hidden");
  elements.errorState?.classList.add("hidden");
  elements.quizContent?.classList.remove("hidden");
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid response.");
  }

  return response.json();
}

/* ============================================================
   Question Normalization
============================================================ */

function normalizeQuestion(question) {
  if (!question) {
    return null;
  }

  const questionId = question._id || question.id || null;

  if (
    !questionId ||
    typeof question.question !== "string" ||
    !Array.isArray(question.options)
  ) {
    return null;
  }

  return {
    ...question,
    _id: String(questionId),
    id: String(questionId),
    difficulty: question.difficulty || "Easy",
  };
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.map(normalizeQuestion).filter(Boolean);
}

/* ============================================================
   Quiz Loading
============================================================ */

async function loadStandardQuiz() {
  if (!state.category) {
    throw new Error(
      "No quiz category was selected. Return to the dashboard and choose a category.",
    );
  }

  const encodedCategory = encodeURIComponent(state.category);

  const response = await fetch(`/api/quiz/start/${encodedCategory}?limit=10`, {
    method: "GET",
    credentials: "include",

    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 401) {
    window.location.href = "/login";
    return null;
  }

  const data = await parseJsonResponse(response);

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Unable to load quiz questions.");
  }

  return {
    category: data.category || state.category,
    questions: normalizeQuestions(data.questions),
    quizSessionId: data.quizSessionId,
  };
}

async function loadDailyChallengeQuiz() {
  const response = await fetch(
    `/api/daily-challenge/${encodeURIComponent(state.dailyChallengeId)}/start`,
    {
      method: "POST",
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
    throw new Error(data.message || "Unable to start the daily challenge.");
  }

  const challenge = data.challenge;

  if (!challenge) {
    throw new Error("The daily challenge response is invalid.");
  }

  state.dailyChallenge = challenge;

  return {
    category: challenge.category || state.category || "Daily Challenge",

    questions: normalizeQuestions(challenge.questions),
    quizSessionId: data.quizSessionId,
  };
}

async function loadQuiz() {
  showLoading();
  stopTimer();

  try {
    configureQuizMode();

    const quizData = state.isDailyChallenge
      ? await loadDailyChallengeQuiz()
      : await loadStandardQuiz();

    if (!quizData) {
      return;
    }

    if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error("No questions are available for this quiz.");
    }

    state.category = quizData.category;
    state.questions = quizData.questions;
    state.quizSessionId = quizData.quizSessionId;
    state.currentIndex = 0;
    state.remainingSeconds = QUIZ_DURATION_SECONDS;
    state.submitting = false;
    state.answers = {};

    restoreProgress();

    if (elements.categoryName) {
      elements.categoryName.textContent = state.isDailyChallenge
        ? `🔥 ${state.category} Daily Challenge`
        : state.category;
    }

    if (elements.totalQuestionCount) {
      elements.totalQuestionCount.textContent = state.questions.length;
    }

    if (state.isDailyChallenge && elements.submitModalTitle) {
      elements.submitModalTitle.textContent = "Submit daily challenge?";
    }

    showQuiz();
    renderQuestion();
    startTimer();
  } catch (error) {
    console.error("Quiz loading error:", error);

    showError(
      error.message || "An unexpected error occurred while loading the quiz.",
    );
  }
}

/* ============================================================
   Progress Storage
============================================================ */

function restoreProgress() {
  try {
    const storedProgress = localStorage.getItem(getStorageKey());

    if (!storedProgress) {
      state.answers = {};
      return;
    }

    const parsedProgress = JSON.parse(storedProgress);

    if (
      parsedProgress &&
      typeof parsedProgress.answers === "object" &&
      parsedProgress.answers !== null
    ) {
      state.answers = parsedProgress.answers;
    }

    if (
      Number.isInteger(parsedProgress.currentIndex) &&
      parsedProgress.currentIndex >= 0 &&
      parsedProgress.currentIndex < state.questions.length
    ) {
      state.currentIndex = parsedProgress.currentIndex;
    }

    if (
      Number.isInteger(parsedProgress.remainingSeconds) &&
      parsedProgress.remainingSeconds > 0 &&
      parsedProgress.remainingSeconds <= QUIZ_DURATION_SECONDS
    ) {
      state.remainingSeconds = parsedProgress.remainingSeconds;
    }
  } catch (error) {
    console.error("Unable to restore quiz progress:", error);

    state.answers = {};
  }
}

function saveProgress() {
  if (!state.category || state.questions.length === 0 || state.submitting) {
    return;
  }

  const progress = {
    answers: state.answers,
    currentIndex: state.currentIndex,
    remainingSeconds: state.remainingSeconds,

    isDailyChallenge: state.isDailyChallenge,

    dailyChallengeId: state.dailyChallengeId,
  };

  localStorage.setItem(getStorageKey(), JSON.stringify(progress));
}

function clearProgress() {
  localStorage.removeItem(getStorageKey());
}

/* ============================================================
   Question Rendering
============================================================ */

function renderQuestion() {
  const question = state.questions[state.currentIndex];

  if (!question) {
    showError("The requested quiz question was not found.");

    return;
  }

  const questionNumber = state.currentIndex + 1;

  const progressPercentage = (questionNumber / state.questions.length) * 100;

  if (elements.currentQuestionNumber) {
    elements.currentQuestionNumber.textContent = questionNumber;
  }

  if (elements.progressBar) {
    elements.progressBar.style.width = `${progressPercentage}%`;
  }

  elements.progressTrack?.setAttribute(
    "aria-valuenow",
    String(Math.round(progressPercentage)),
  );

  if (elements.questionText) {
    elements.questionText.textContent = question.question;
  }

  updateDifficulty(question.difficulty);
  renderOptions(question);
  updateNavigation();
  updateAnswerInformation();
  saveProgress();
}

function updateDifficulty(difficulty = "Easy") {
  if (!elements.difficultyBadge) {
    return;
  }

  const normalizedDifficulty = String(difficulty).toLowerCase();

  elements.difficultyBadge.textContent = difficulty;

  elements.difficultyBadge.classList.remove("medium", "hard");

  if (normalizedDifficulty === "medium") {
    elements.difficultyBadge.classList.add("medium");
  }

  if (normalizedDifficulty === "hard") {
    elements.difficultyBadge.classList.add("hard");
  }
}

function renderOptions(question) {
  if (!elements.optionsContainer) {
    return;
  }

  elements.optionsContainer.innerHTML = "";

  const selectedAnswer = state.answers[question._id];

  question.options.forEach((option, optionIndex) => {
    const optionButton = document.createElement("button");

    optionButton.type = "button";
    optionButton.className = "option-button";

    optionButton.setAttribute("role", "radio");

    optionButton.setAttribute(
      "aria-checked",
      selectedAnswer === optionIndex ? "true" : "false",
    );

    if (selectedAnswer === optionIndex) {
      optionButton.classList.add("selected");
    }

    const optionLetter = document.createElement("span");

    optionLetter.className = "option-letter";

    optionLetter.textContent = String.fromCharCode(65 + optionIndex);

    const optionText = document.createElement("span");

    optionText.className = "option-text";

    optionText.textContent = option;

    optionButton.append(optionLetter, optionText);

    optionButton.addEventListener("click", () => {
      selectAnswer(question._id, optionIndex);
    });

    elements.optionsContainer.appendChild(optionButton);
  });
}

function selectAnswer(questionId, optionIndex) {
  if (state.submitting) {
    return;
  }

  state.answers[questionId] = optionIndex;

  renderQuestion();
}

/* ============================================================
   Navigation
============================================================ */

function updateNavigation() {
  const isFirstQuestion = state.currentIndex === 0;

  const isLastQuestion = state.currentIndex === state.questions.length - 1;

  if (elements.previousButton) {
    elements.previousButton.disabled = isFirstQuestion || state.submitting;
  }

  elements.nextButton?.classList.toggle("hidden", isLastQuestion);

  elements.submitButton?.classList.toggle("hidden", !isLastQuestion);
}

function updateAnswerInformation() {
  const currentQuestion = state.questions[state.currentIndex];

  if (!currentQuestion) {
    return;
  }

  const currentQuestionAnswered = Object.prototype.hasOwnProperty.call(
    state.answers,
    currentQuestion._id,
  );

  const answeredCount = state.questions.filter((question) =>
    Object.prototype.hasOwnProperty.call(state.answers, question._id),
  ).length;

  if (elements.answeredStatus) {
    elements.answeredStatus.textContent = currentQuestionAnswered
      ? "Answered"
      : "Not answered";
  }

  if (elements.answeredCount) {
    elements.answeredCount.textContent = answeredCount;
  }
}

function goToPreviousQuestion() {
  if (state.submitting || state.currentIndex <= 0) {
    return;
  }

  state.currentIndex -= 1;
  renderQuestion();
}

function goToNextQuestion() {
  if (state.submitting || state.currentIndex >= state.questions.length - 1) {
    return;
  }

  state.currentIndex += 1;
  renderQuestion();
}

/* ============================================================
   Timer
============================================================ */

function updateTimerDisplay() {
  const minutes = Math.floor(state.remainingSeconds / 60);

  const seconds = state.remainingSeconds % 60;

  if (elements.timerValue) {
    elements.timerValue.textContent =
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;
  }

  elements.timer?.classList.toggle(
    "warning",
    state.remainingSeconds <= 120 && state.remainingSeconds > 30,
  );

  elements.timer?.classList.toggle("danger", state.remainingSeconds <= 30);
}

function startTimer() {
  stopTimer();
  updateTimerDisplay();

  state.timerId = window.setInterval(() => {
    state.remainingSeconds -= 1;

    if (state.remainingSeconds < 0) {
      state.remainingSeconds = 0;
    }

    updateTimerDisplay();
    saveProgress();

    if (state.remainingSeconds === 0) {
      stopTimer();
      openSubmitModal(true);
    }
  }, 1000);
}

function stopTimer() {
  if (!state.timerId) {
    return;
  }

  window.clearInterval(state.timerId);
  state.timerId = null;
}

/* ============================================================
   Submission Modal
============================================================ */

function openSubmitModal(timeExpired = false) {
  const answeredCount = state.questions.filter((question) =>
    Object.prototype.hasOwnProperty.call(state.answers, question._id),
  ).length;

  const unansweredCount = state.questions.length - answeredCount;

  if (elements.submitModalTitle) {
    elements.submitModalTitle.textContent = state.isDailyChallenge
      ? "Submit daily challenge?"
      : "Submit your quiz?";
  }

  if (elements.submitSummary) {
    if (timeExpired) {
      elements.submitSummary.textContent = state.isDailyChallenge
        ? "Time is over. Your daily challenge answers will be submitted."
        : "Time is over. Your current answers will be submitted.";
    } else if (unansweredCount > 0) {
      elements.submitSummary.textContent =
        `You have ${unansweredCount} unanswered ` +
        `${unansweredCount === 1 ? "question" : "questions"}. ` +
        "You can continue the quiz or submit now.";
    } else {
      elements.submitSummary.textContent = state.isDailyChallenge
        ? "You have answered all questions. Your daily challenge is ready to submit."
        : "You have answered all questions. Your quiz is ready to submit.";
    }
  }

  elements.cancelSubmitButton?.classList.toggle("hidden", timeExpired);

  elements.submitModal?.classList.remove("hidden");

  elements.confirmSubmitButton?.focus();
}

function closeSubmitModal() {
  if (state.submitting) {
    return;
  }

  elements.submitModal?.classList.add("hidden");
}

/* ============================================================
   Quiz Submission
============================================================ */

function createSubmissionPayload() {
  return {
    answers: state.questions.map((question) => ({
      questionId: question._id,

      selectedAnswer: Object.prototype.hasOwnProperty.call(
        state.answers,
        question._id,
      )
        ? state.answers[question._id]
        : null,
    })),
    quizSessionId: state.quizSessionId,
  };
}

async function submitQuiz() {
  if (state.submitting) {
    return;
  }

  state.submitting = true;
  stopTimer();

  if (elements.confirmSubmitButton) {
    elements.confirmSubmitButton.disabled = true;

    elements.confirmSubmitButton.textContent = state.isDailyChallenge
      ? "Submitting Challenge..."
      : "Submitting...";
  }

  try {
    const response = await fetch("/api/quiz/submit", {
      method: "POST",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",

        Accept: "application/json",
      },

      body: JSON.stringify(createSubmissionPayload()),
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    const data = await parseJsonResponse(response);

    if (response.status === 409 && data.existingResultId) {
      clearProgress();
      window.location.href = `/result/${encodeURIComponent(
        data.existingResultId,
      )}`;
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to submit the quiz.");
    }

    sessionStorage.setItem("quizmaster_result", JSON.stringify(data.result));

    sessionStorage.setItem(
      "quizmaster_submission_response",
      JSON.stringify(data),
    );

    if (data.dailyChallenge && data.dailyChallenge.completed) {
      sessionStorage.setItem(
        "quizmaster_daily_challenge_result",
        JSON.stringify(data.dailyChallenge),
      );
    } else {
      sessionStorage.removeItem("quizmaster_daily_challenge_result");
    }

    clearProgress();

    const resultId = data.result?.resultId;

    if (resultId) {
      window.location.href = `/result/${encodeURIComponent(resultId)}`;
    } else {
      window.location.href = "/result";
    }
  } catch (error) {
    console.error("Quiz submission error:", error);

    state.submitting = false;

    if (elements.confirmSubmitButton) {
      elements.confirmSubmitButton.disabled = false;

      elements.confirmSubmitButton.textContent = "Submit Now";
    }

    window.alert(error.message || "Quiz submission failed. Please try again.");

    startTimer();
  }
}

/* ============================================================
   Keyboard Navigation
============================================================ */

function handleKeyboardNavigation(event) {
  if (state.submitting) {
    return;
  }

  if (
    elements.submitModal &&
    !elements.submitModal.classList.contains("hidden")
  ) {
    if (event.key === "Escape") {
      closeSubmitModal();
    }

    return;
  }

  if (event.key === "ArrowLeft") {
    goToPreviousQuestion();
  }

  if (event.key === "ArrowRight") {
    goToNextQuestion();
  }

  const numberPressed = Number.parseInt(event.key, 10);

  if (numberPressed >= 1 && numberPressed <= 4) {
    const currentQuestion = state.questions[state.currentIndex];

    if (currentQuestion && numberPressed <= currentQuestion.options.length) {
      selectAnswer(currentQuestion._id, numberPressed - 1);
    }
  }
}

/* ============================================================
   Event Listeners
============================================================ */

elements.retryButton?.addEventListener("click", loadQuiz);

elements.previousButton?.addEventListener("click", goToPreviousQuestion);

elements.nextButton?.addEventListener("click", goToNextQuestion);

elements.submitButton?.addEventListener("click", () => {
  openSubmitModal(false);
});

elements.cancelSubmitButton?.addEventListener("click", closeSubmitModal);

elements.confirmSubmitButton?.addEventListener("click", submitQuiz);

elements.submitModal?.addEventListener("click", (event) => {
  if (event.target === elements.submitModal) {
    closeSubmitModal();
  }
});

document.addEventListener("keydown", handleKeyboardNavigation);

window.addEventListener("beforeunload", () => {
  if (!state.submitting) {
    saveProgress();
  }
});

loadQuiz();
