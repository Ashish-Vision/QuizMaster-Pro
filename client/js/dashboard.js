"use strict";

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed.");
      }

      window.location.href = "/login";
    } catch (error) {
      console.error(error);

      logoutButton.disabled = false;
      logoutButton.textContent = "Logout";
    }
  });
}
