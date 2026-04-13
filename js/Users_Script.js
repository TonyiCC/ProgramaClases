const usersList = document.getElementById("usersList");
const sortByUserBtn = document.getElementById("sortByUserBtn");
const sortByEmailBtn = document.getElementById("sortByEmailBtn");
const sortByPasswordBtn = document.getElementById("sortByPasswordBtn");

let users = [];
let currentSort = "name";

async function loadUsers() {
  try {
    const response = await fetch("/api/users");
    const data = await response.json();

    console.log("Usuarios cargados:", data);

    if (!response.ok) {
      usersList.innerHTML = `<div class="users-message">${data.message || "No se pudieron cargar los usuarios"}</div>`;
      return;
    }

    users = data;
    renderUsers();
  } catch (error) {
    console.error("Error cargando usuarios:", error);
    usersList.innerHTML = `<div class="users-message">Error al cargar los usuarios</div>`;
  }
}

function sortUsers() {
  users.sort((a, b) => {
    if (currentSort === "email") {
      return a.email.localeCompare(b.email, "es", { sensitivity: "base" });
    }

    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
}

function renderUsers() {
  sortUsers();

  if (!users.length) {
    usersList.innerHTML = `<div class="users-message">No hay usuarios registrados</div>`;
    return;
  }

  usersList.innerHTML = users.map(user => `
    <div class="user-row" data-user-id="${user.id}">
      <input type="text" class="user-input" value="${escapeHtml(user.name)}" readonly />
      <input type="email" class="user-input" value="${escapeHtml(user.email)}" readonly />
      <input type="text" class="user-input" value="" placeholder="No visible" readonly />
    </div>
  `).join("");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

sortByUserBtn.addEventListener("click", () => {
  currentSort = "name";
  renderUsers();
});

sortByEmailBtn.addEventListener("click", () => {
  currentSort = "email";
  renderUsers();
});

sortByPasswordBtn.addEventListener("click", () => {
  currentSort = "name";
  renderUsers();
});

loadUsers();