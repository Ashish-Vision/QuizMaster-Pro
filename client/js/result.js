"use strict";

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

let result = null;

function formatTime(totalSeconds) {
  const safeSeconds = Number.isFinite(Number(totalSeconds))
    ? Math.max(0, Math.floor(Number(totalSeconds)))
    : 0;

  const minutes = Math.floor(safeSeconds / 60);

  const seconds = safeSeconds % 60;

  return (
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")}`
  );
}

function showError() {
  elements.resultCard.classList.add("hidden");

  elements.resultError.classList.remove("hidden");
}

function renderResult() {
  const storedResult = sessionStorage.getItem("quizmaster_result");

  if (!storedResult) {
    showError();
    return;
  }

  try {
    result = JSON.parse(storedResult);
  } catch (error) {
    console.error("Unable to read quiz result:", error);

    showError();
    return;
  }

  if (
    !result ||
    typeof result.category !== "string" ||
    !Number.isFinite(Number(result.totalQuestions))
  ) {
    showError();
    return;
  }

  elements.resultCategory.textContent = `${result.category} Quiz`;

  elements.scoreValue.textContent = result.correctAnswers;

  elements.scoreTotal.textContent = `/ ${result.totalQuestions}`;

  elements.accuracyValue.textContent = `${result.accuracy}%`;

  elements.correctValue.textContent = result.correctAnswers;

  elements.wrongValue.textContent = result.wrongAnswers;

  elements.unansweredValue.textContent = result.unansweredQuestions;

  elements.xpValue.textContent = `+${result.xpEarned} XP`;

  elements.timeValue.textContent = formatTime(result.timeTakenSeconds);
}

function retryQuiz() {
  if (!result?.category) {
    window.location.href = "/dashboard";
    return;
  }

  sessionStorage.removeItem("quizmaster_result");

  window.location.href = `/quiz?category=${encodeURIComponent(
    result.category,
  )}`;
}

elements.retryQuizButton.addEventListener("click", retryQuiz);

renderResult();
