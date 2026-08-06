"use strict";

(function exposeSharedBrowserUtilities(globalObject) {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(
    value,
    { fallback = "Unknown", includeTime = false } = {},
  ) {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(includeTime && { hour: "2-digit", minute: "2-digit" }),
    }).format(date);
  }

  function formatNumber(value) {
    return (Number(value) || 0).toLocaleString("en-IN");
  }

  function getInitials(person, fallback = "U") {
    if (!person) return fallback;
    const first = person.firstName?.charAt(0) || "";
    const last = person.lastName?.charAt(0) || "";
    return `${first}${last}`.toUpperCase() || fallback;
  }

  function toggleElement(element, shouldShow) {
    element?.classList.toggle("hidden", !shouldShow);
  }

  globalObject.QuizMaster = Object.freeze({
    escapeHtml,
    formatDate,
    formatNumber,
    getInitials,
    toggleElement,
  });
})(window);
