"use strict";

const state = {
  days: 30,
  isLoading: false,
};

const elements = {
  usersCount: document.getElementById("usersCount"),
  questionsCount: document.getElementById("questionsCount"),
  attemptsCount: document.getElementById("attemptsCount"),
  xpCount: document.getElementById("xpCount"),

  daysSelect: document.getElementById("daysSelect"),
  refreshButton: document.getElementById("refreshButton"),
  loadingState: document.getElementById("loadingState"),

  reportButtons: document.querySelectorAll("[data-report]"),
};

function setText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = String(value ?? "");
}

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getNumber(value).toLocaleString("en-IN");
}

function showStatus(message, type = "") {
  if (!elements.loadingState) {
    return;
  }

  elements.loadingState.className = "loading";

  if (type) {
    elements.loadingState.classList.add(type);
  }

  elements.loadingState.classList.remove("hidden");

  elements.loadingState.textContent = message;
}

function hideStatus() {
  elements.loadingState?.classList.add("hidden");
}

function setLoadingState(isLoading) {
  state.isLoading = isLoading;

  if (elements.refreshButton) {
    elements.refreshButton.disabled = isLoading;
    elements.refreshButton.textContent = isLoading ? "Loading..." : "Refresh";
  }
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an invalid response.");
  }

  return response.json();
}

function renderSummary(summary = {}) {
  setText(elements.usersCount, formatNumber(summary.totalUsers));
  setText(elements.questionsCount, formatNumber(summary.totalQuestions));
  setText(elements.attemptsCount, formatNumber(summary.totalAttempts));
  setText(elements.xpCount, formatNumber(summary.totalXpEarned));
}

async function loadReportSummary() {
  if (state.isLoading) {
    return;
  }

  setLoadingState(true);
  showStatus("Loading report summary...");

  try {
    const response = await fetch(
      `/api/admin/reports/summary?days=${state.days}`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",

        headers: {
          Accept: "application/json",
        },
      },
    );

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
      throw new Error(data.message || "Unable to load report summary.");
    }

    renderSummary(data.summary);

    showStatus(
      `Report data updated for the last ${getNumber(data.period?.days)} days.`,
      "success",
    );

    window.setTimeout(hideStatus, 1800);
  } catch (error) {
    console.error("Report summary error:", error);

    showStatus(error.message || "Unable to load report summary.", "error");
  } finally {
    setLoadingState(false);
  }
}

function buildReportUrl(reportType) {
  const baseUrl = `/api/admin/reports/${encodeURIComponent(reportType)}`;

  const params = new URLSearchParams();

  if (reportType === "attempts") {
    params.set("days", String(state.days));
  }

  const queryString = params.toString();

  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function getFilenameFromDisposition(disposition, fallbackName) {
  if (!disposition) {
    return fallbackName;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const regularMatch = disposition.match(/filename="?([^"]+)"?/i);

  return regularMatch?.[1] || fallbackName;
}

async function downloadReport(reportType, button) {
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Preparing...";

  showStatus(`Preparing ${reportType} report...`);

  try {
    const response = await fetch(buildReportUrl(reportType), {
      method: "GET",
      credentials: "include",
      cache: "no-store",

      headers: {
        Accept: "text/csv",
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

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();

        throw new Error(
          data.message || `Unable to download ${reportType} report.`,
        );
      }

      throw new Error(`Unable to download ${reportType} report.`);
    }

    const blob = await response.blob();

    const disposition = response.headers.get("content-disposition");

    const filename = getFilenameFromDisposition(
      disposition,
      `quizmaster-${reportType}-${Date.now()}.csv`,
    );

    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = filename;

    document.body.appendChild(link);

    link.click();
    link.remove();

    URL.revokeObjectURL(objectUrl);

    showStatus(
      `${reportType.charAt(0).toUpperCase()}${reportType.slice(
        1,
      )} report downloaded successfully.`,
      "success",
    );

    window.setTimeout(hideStatus, 1800);
  } catch (error) {
    console.error("Report download error:", error);

    showStatus(
      error.message || `Unable to download ${reportType} report.`,
      "error",
    );
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function initializeReports() {
  state.days = getNumber(elements.daysSelect?.value) || 30;

  elements.daysSelect?.addEventListener("change", () => {
    state.days = getNumber(elements.daysSelect.value) || 30;

    loadReportSummary();
  });

  elements.refreshButton?.addEventListener("click", loadReportSummary);

  elements.reportButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const reportType = button.dataset.report;

      if (!reportType) {
        return;
      }

      downloadReport(reportType, button);
    });
  });

  loadReportSummary();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeReports, {
    once: true,
  });
} else {
  initializeReports();
}
