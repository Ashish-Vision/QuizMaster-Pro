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
};

function getCategoryFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);

  return searchParams.get("category")?.trim() || "";
}

function getStorageKey() {
  return `quizmaster_quiz_${state.category}`;
}

function showLoading() {
  elements.loadingState.classList.remove("hidden");
  elements.errorState.classList.add("hidden");
  elements.quizContent.classList.add("hidden");
}

function showError(message) {
  stopTimer();

  elements.loadingState.classList.add("hidden");
  elements.quizContent.classList.add("hidden");
  elements.errorState.classList.remove("hidden");

  elements.errorMessage.textContent = message;
}

function showQuiz() {
  elements.loadingState.classList.add("hidden");
  elements.errorState.classList.add("hidden");
  elements.quizContent.classList.remove("hidden");
}

async function loadQuiz() {
  showLoading();

  state.category = getCategoryFromUrl();

  if (!state.category) {
    showError(
      "No quiz category was selected. Return to the dashboard and choose a category.",
    );

    return;
  }

  try {
    const encodedCategory = encodeURIComponent(state.category);

    const response = await fetch(
      `/api/quiz/start/${encodedCategory}?limit=10`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await response.json();

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load quiz questions.");
    }

    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("No questions are available for this category.");
    }

    state.questions = data.questions;
    state.currentIndex = 0;
    state.remainingSeconds = QUIZ_DURATION_SECONDS;
    state.submitting = false;

    restoreProgress();

    elements.categoryName.textContent = data.category || state.category;

    elements.totalQuestionCount.textContent = state.questions.length;

    showQuiz();
    renderQuestion();
    startTimer();
  } catch (error) {
    showError(
      error.message || "An unexpected error occurred while loading the quiz.",
    );
  }
}

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
  if (!state.category || state.questions.length === 0) {
    return;
  }

  const progress = {
    answers: state.answers,
    currentIndex: state.currentIndex,
    remainingSeconds: state.remainingSeconds,
  };

  localStorage.setItem(getStorageKey(), JSON.stringify(progress));
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];

  if (!question) {
    showError("The requested quiz question was not found.");

    return;
  }

  const questionNumber = state.currentIndex + 1;

  const progressPercentage = (questionNumber / state.questions.length) * 100;

  elements.currentQuestionNumber.textContent = questionNumber;

  elements.progressBar.style.width = `${progressPercentage}%`;

  elements.progressTrack.setAttribute(
    "aria-valuenow",
    String(Math.round(progressPercentage)),
  );

  elements.questionText.textContent = question.question;

  updateDifficulty(question.difficulty);
  renderOptions(question);
  updateNavigation();
  updateAnswerInformation();
  saveProgress();
}

function updateDifficulty(difficulty = "Easy") {
  const normalizedDifficulty = difficulty.toLowerCase();

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

function updateNavigation() {
  const isFirstQuestion = state.currentIndex === 0;

  const isLastQuestion = state.currentIndex === state.questions.length - 1;

  elements.previousButton.disabled = isFirstQuestion || state.submitting;

  elements.nextButton.classList.toggle("hidden", isLastQuestion);

  elements.submitButton.classList.toggle("hidden", !isLastQuestion);
}

function updateAnswerInformation() {
  const currentQuestion = state.questions[state.currentIndex];

  const currentQuestionAnswered = Object.prototype.hasOwnProperty.call(
    state.answers,
    currentQuestion._id,
  );

  const answeredCount = state.questions.filter((question) =>
    Object.prototype.hasOwnProperty.call(state.answers, question._id),
  ).length;

  elements.answeredStatus.textContent = currentQuestionAnswered
    ? "Answered"
    : "Not answered";

  elements.answeredCount.textContent = answeredCount;
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

function updateTimerDisplay() {
  const minutes = Math.floor(state.remainingSeconds / 60);

  const seconds = state.remainingSeconds % 60;

  elements.timerValue.textContent =
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`;

  elements.timer.classList.toggle(
    "warning",
    state.remainingSeconds <= 120 && state.remainingSeconds > 30,
  );

  elements.timer.classList.toggle("danger", state.remainingSeconds <= 30);
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
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function openSubmitModal(timeExpired = false) {
  const answeredCount = state.questions.filter((question) =>
    Object.prototype.hasOwnProperty.call(state.answers, question._id),
  ).length;

  const unansweredCount = state.questions.length - answeredCount;

  if (timeExpired) {
    elements.submitSummary.textContent =
      "Time is over. Your current answers will be submitted.";
  } else if (unansweredCount > 0) {
    elements.submitSummary.textContent =
      `You have ${unansweredCount} unanswered ` +
      `${unansweredCount === 1 ? "question" : "questions"}. ` +
      "You can continue the quiz or submit now.";
  } else {
    elements.submitSummary.textContent =
      "You have answered all questions. Your quiz is ready to submit.";
  }

  elements.cancelSubmitButton.classList.toggle("hidden", timeExpired);

  elements.submitModal.classList.remove("hidden");

  elements.confirmSubmitButton.focus();
}

function closeSubmitModal() {
  if (state.submitting) {
    return;
  }

  elements.submitModal.classList.add("hidden");
}

async function submitQuiz() {
  if (state.submitting) {
    return;
  }

  state.submitting = true;
  stopTimer();

  elements.confirmSubmitButton.disabled = true;
  elements.confirmSubmitButton.textContent = "Submitting...";

  const payload = {
    category: state.category,

    answers: state.questions.map((question) => ({
      questionId: question._id,

      selectedAnswer: Object.prototype.hasOwnProperty.call(
        state.answers,
        question._id,
      )
        ? state.answers[question._id]
        : null,
    })),

    remainingSeconds: state.remainingSeconds,

    quizDurationSeconds: QUIZ_DURATION_SECONDS,
  };

  try {
    const response = await fetch("/api/quiz/submit", {
      method: "POST",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to submit the quiz.");
    }

    sessionStorage.setItem("quizmaster_result", JSON.stringify(data.result));

    localStorage.removeItem(getStorageKey());

    window.location.href = "/result";
  } catch (error) {
    state.submitting = false;

    elements.confirmSubmitButton.disabled = false;

    elements.confirmSubmitButton.textContent = "Submit Now";

    alert(error.message || "Quiz submission failed. Please try again.");

    startTimer();
  }
}

function handleKeyboardNavigation(event) {
  if (state.submitting) {
    return;
  }

  if (!elements.submitModal.classList.contains("hidden")) {
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

elements.retryButton.addEventListener("click", loadQuiz);

elements.previousButton.addEventListener("click", goToPreviousQuestion);

elements.nextButton.addEventListener("click", goToNextQuestion);

elements.submitButton.addEventListener("click", () => {
  openSubmitModal(false);
});

elements.cancelSubmitButton.addEventListener("click", closeSubmitModal);

elements.confirmSubmitButton.addEventListener("click", submitQuiz);

elements.submitModal.addEventListener("click", (event) => {
  if (event.target === elements.submitModal) {
    closeSubmitModal();
  }
});

document.addEventListener("keydown", handleKeyboardNavigation);

window.addEventListener("beforeunload", saveProgress);

loadQuiz();
