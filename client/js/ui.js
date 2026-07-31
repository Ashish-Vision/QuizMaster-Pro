"use strict";

const menuButton = document.getElementById("menuButton");
const navLinks = document.getElementById("navLinks");

if (menuButton && navLinks) {
  menuButton.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");

    menuButton.setAttribute("aria-expanded", String(isOpen));

    menuButton.textContent = isOpen ? "✕" : "☰";
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");

      menuButton.setAttribute("aria-expanded", "false");

      menuButton.textContent = "☰";
    });
  });

  document.addEventListener("click", (event) => {
    const clickedInsideNavigation = navLinks.contains(event.target);

    const clickedMenuButton = menuButton.contains(event.target);

    if (!clickedInsideNavigation && !clickedMenuButton) {
      navLinks.classList.remove("open");

      menuButton.setAttribute("aria-expanded", "false");

      menuButton.textContent = "☰";
    }
  });
}
