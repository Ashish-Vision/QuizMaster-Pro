"use strict";

const elements = {
  categoriesContainer: document.getElementById("categoriesContainer"),
  searchInput: document.getElementById("searchInput"),
  logoutButton: document.getElementById("logoutButton"),
};

const categoryDetails = {
  Java: {
    icon: "☕",
    description: "OOP, collections, exceptions, inheritance, and threads.",
  },

  Python: {
    icon: "🐍",
    description: "Functions, lists, dictionaries, OOP, and exceptions.",
  },

  C: {
    icon: "💻",
    description: "Pointers, arrays, functions, memory, and fundamentals.",
  },

  DBMS: {
    icon: "🗄️",
    description: "SQL, keys, normalization, joins, and transactions.",
  },

  "Operating Systems": {
    icon: "🖥️",
    description: "Processes, scheduling, memory, paging, and deadlocks.",
  },

  "Computer Networks": {
    icon: "🌐",
    description: "TCP/IP, DNS, HTTP, routing, protocols, and networking.",
  },
};

let categories = [];

function getCategoryDetails(category) {
  return (
    categoryDetails[category] || {
      icon: "🧠",
      description:
        "Challenge your knowledge with questions from this category.",
    }
  );
}

function createCategoryCard(category) {
  const details = getCategoryDetails(category);

  const card = document.createElement("article");
  card.className = "category-card";
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Start ${category} quiz`);

  const topSection = document.createElement("div");

  const icon = document.createElement("div");
  icon.className = "category-icon";
  icon.textContent = details.icon;

  const title = document.createElement("h3");
  title.textContent = category;

  const description = document.createElement("p");
  description.textContent = details.description;

  topSection.append(icon, title, description);

  const footer = document.createElement("div");
  footer.className = "category-footer";

  const difficulty = document.createElement("span");
  difficulty.className = "category-difficulty";
  difficulty.textContent = "Easy • Medium • Hard";

  const start = document.createElement("span");
  start.className = "category-start";
  start.textContent = "Start Quiz →";

  footer.append(difficulty, start);
  card.append(topSection, footer);

  const openQuiz = () => {
    const encodedCategory = encodeURIComponent(category);

    window.location.href = `/quiz?category=${encodedCategory}`;
  };

  card.addEventListener("click", openQuiz);

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openQuiz();
    }
  });

  return card;
}

function renderCategories(categoryList) {
  elements.categoriesContainer.innerHTML = "";

  if (categoryList.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "category-empty";
    emptyMessage.textContent = "No quiz categories match your search.";

    elements.categoriesContainer.appendChild(emptyMessage);

    return;
  }

  categoryList.forEach((category) => {
    elements.categoriesContainer.appendChild(createCategoryCard(category));
  });
}

async function loadCategories() {
  elements.categoriesContainer.innerHTML = `
    <div class="category-loading">
      Loading quiz categories...
    </div>
  `;

  try {
    const response = await fetch("/api/quiz/categories", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load quiz categories.");
    }

    if (!Array.isArray(data.categories)) {
      throw new Error("The categories response is invalid.");
    }

    categories = data.categories;

    renderCategories(categories);
  } catch (error) {
    elements.categoriesContainer.innerHTML = "";

    const errorMessage = document.createElement("div");
    errorMessage.className = "category-error";
    errorMessage.textContent = error.message || "An unexpected error occurred.";

    elements.categoriesContainer.appendChild(errorMessage);
  }
}

function filterCategories() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();

  const filteredCategories = categories.filter((category) =>
    category.toLowerCase().includes(searchTerm),
  );

  renderCategories(filteredCategories);
}

async function logout() {
  elements.logoutButton.disabled = true;
  elements.logoutButton.textContent = "Logging out...";

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Logout failed.");
    }

    localStorage.removeItem("quizmaster_user");

    window.location.href = "/login";
  } catch (error) {
    alert(error.message || "Unable to log out. Please try again.");

    elements.logoutButton.disabled = false;
    elements.logoutButton.textContent = "Logout";
  }
}

elements.searchInput.addEventListener("input", filterCategories);

elements.logoutButton.addEventListener("click", logout);

loadCategories();
