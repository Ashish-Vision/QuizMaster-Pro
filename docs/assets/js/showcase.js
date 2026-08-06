"use strict";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const header = document.querySelector("[data-header]");
const menuButton = document.querySelector("[data-menu-button]");
const menu = document.querySelector("[data-menu]");
const navigationLinks = Array.from(
  document.querySelectorAll('.nav-links a[href^="#"]'),
);
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const galleryCards = Array.from(document.querySelectorAll("[data-category]"));

function setMenuState(isOpen, { restoreFocus = false } = {}) {
  if (!menu || !menuButton) return;

  menu.classList.toggle("is-open", isOpen);
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute(
    "aria-label",
    isOpen ? "Close navigation menu" : "Open navigation menu",
  );

  if (restoreFocus) menuButton.focus();
}

function initializeNavigation() {
  if (!menu || !menuButton) return;

  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") !== "true";
    setMenuState(isOpen);
  });

  navigationLinks.forEach((link) => {
    link.addEventListener("click", () => setMenuState(false));
  });

  document.addEventListener("click", (event) => {
    if (
      menuButton.getAttribute("aria-expanded") === "true" &&
      !menu.contains(event.target) &&
      !menuButton.contains(event.target)
    ) {
      setMenuState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menuButton.getAttribute("aria-expanded") === "true"
    ) {
      setMenuState(false, { restoreFocus: true });
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) setMenuState(false);
  });
}

function initializeHeader() {
  if (!header) return;

  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

function initializeActiveSections() {
  if (!("IntersectionObserver" in window) || navigationLinks.length === 0) {
    return;
  }

  const linksBySection = new Map(
    navigationLinks.map((link) => [link.hash.slice(1), link]),
  );
  const sections = Array.from(linksBySection.keys())
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort(
          (first, second) => second.intersectionRatio - first.intersectionRatio,
        )[0];

      if (!visibleEntry) return;

      navigationLinks.forEach((link) => link.classList.remove("is-active"));
      linksBySection.get(visibleEntry.target.id)?.classList.add("is-active");
    },
    { rootMargin: "-25% 0px -60%", threshold: [0.05, 0.25, 0.5] },
  );

  sections.forEach((section) => observer.observe(section));
}

function initializeGalleryFilters() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter || "all";

      filterButtons.forEach((candidate) => {
        const isActive = candidate === button;
        candidate.classList.toggle("is-active", isActive);
        candidate.setAttribute("aria-pressed", String(isActive));
      });

      galleryCards.forEach((card) => {
        card.hidden = filter !== "all" && card.dataset.category !== filter;
      });
    });
  });
}

function initializeImageFallbacks() {
  document.querySelectorAll("img[data-gallery-image]").forEach((image) => {
    image.addEventListener("error", () => {
      const placeholder = image.parentElement?.querySelector(
        "[data-image-placeholder]",
      );

      image.hidden = true;
      if (placeholder) placeholder.hidden = false;
    });
  });
}

function revealAll() {
  document
    .querySelectorAll("[data-reveal]")
    .forEach((element) => element.classList.add("is-visible"));
}

function initializeReveal() {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealAll();
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );

  document
    .querySelectorAll("[data-reveal]")
    .forEach((element) => observer.observe(element));
}

initializeNavigation();
initializeHeader();
initializeActiveSections();
initializeGalleryFilters();
initializeImageFallbacks();
initializeReveal();

reducedMotion.addEventListener("change", (event) => {
  if (event.matches) revealAll();
});
