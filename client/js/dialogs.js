"use strict";

(function initializeAccessibleDialogs() {
  const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  let lastExternalFocus = null;
  let activeDialog = null;

  function getContainer(dialog) {
    return dialog.closest("[aria-hidden], .modal, .modal-backdrop") || dialog;
  }

  function isOpen(dialog) {
    const container = getContainer(dialog);
    return (
      container.getAttribute("aria-hidden") !== "true" &&
      !container.classList.contains("hidden")
    );
  }

  function getFocusableElements(dialog) {
    return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
      (element) => element.getClientRects().length > 0,
    );
  }

  function activateDialog(dialog) {
    activeDialog = dialog;
    document.body.classList.add("modal-open");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("tabindex", "-1");

    if (!dialog.contains(document.activeElement)) {
      const initialFocus =
        dialog.querySelector("[autofocus]") || getFocusableElements(dialog)[0];
      (initialFocus || dialog).focus({ preventScroll: true });
    }
  }

  function deactivateDialog(dialog) {
    if (activeDialog !== dialog) return;
    activeDialog = [...document.querySelectorAll('[role="dialog"]')]
      .reverse()
      .find((candidate) => candidate !== dialog && isOpen(candidate));

    if (activeDialog) {
      activateDialog(activeDialog);
      return;
    }

    document.body.classList.remove("modal-open");
    if (lastExternalFocus?.isConnected) {
      lastExternalFocus.focus({ preventScroll: true });
    }
  }

  function synchronizeDialog(dialog) {
    if (isOpen(dialog)) activateDialog(dialog);
    else deactivateDialog(dialog);
  }

  document.addEventListener("focusin", (event) => {
    if (!event.target.closest?.('[role="dialog"]')) {
      lastExternalFocus = event.target;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !activeDialog || !isOpen(activeDialog)) return;

    const focusable = getFocusableElements(activeDialog);
    if (focusable.length === 0) {
      event.preventDefault();
      activeDialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
      const container = getContainer(dialog);
      const observer = new window.MutationObserver(() =>
        synchronizeDialog(dialog),
      );
      observer.observe(container, {
        attributes: true,
        attributeFilter: ["aria-hidden", "class"],
      });
      synchronizeDialog(dialog);
    });
  });
})();
