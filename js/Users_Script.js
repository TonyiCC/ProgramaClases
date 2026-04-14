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

    if (!response.ok) {
      usersList.innerHTML = `<div class="users-message">${data.message || "No se pudieron cargar los usuarios"}</div>`;
      return;
    }

    users = data;
    renderUsers();
  } catch (error) {
    console.error(error);
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

  usersList.innerHTML = users.map((user) => {
    return `
      <div class="user-row" data-user-id="${user.id}">
        <div class="user-field">
          <input type="text" class="user-input user-name" value="${escapeHtml(user.name)}" />
          <p class="field-error error-name"></p>
        </div>

        <div class="user-field">
          <input type="email" class="user-input user-email" value="${escapeHtml(user.email)}" />
          <p class="field-error error-email"></p>
        </div>

        <div class="user-field">
          <input type="password" class="user-input user-password" value="" placeholder="Nueva contraseña" />
          <p class="field-error error-password"></p>
        </div>

        <div class="user-field">
          <button type="button" class="save-btn">Guardar</button>
          <p class="field-error error-form"></p>
        </div>
      </div>
    `;
  }).join("");

  attachSaveEvents();
}

function attachSaveEvents() {
  const rows = document.querySelectorAll(".user-row");

  rows.forEach((row) => {
    const saveBtn = row.querySelector(".save-btn");

    saveBtn.addEventListener("click", async () => {
      const userId = row.dataset.userId;
      const nameInput = row.querySelector(".user-name");
      const emailInput = row.querySelector(".user-email");
      const passwordInput = row.querySelector(".user-password");

      const errorName = row.querySelector(".error-name");
      const errorEmail = row.querySelector(".error-email");
      const errorPassword = row.querySelector(".error-password");
      const errorForm = row.querySelector(".error-form");

      clearRowErrors(errorName, errorEmail, errorPassword, errorForm);

      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value
          })
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.field === "name") {
            errorName.textContent = data.message;
          } else if (data.field === "email") {
            errorEmail.textContent = data.message;
          } else if (data.field === "password") {
            errorPassword.textContent = data.message;
          } else {
            errorForm.textContent = data.message || "No se pudo guardar";
          }
          return;
        }

        passwordInput.value = "";
        await loadUsers();
      } catch (error) {
        console.error(error);
        errorForm.textContent = "Error al guardar";
      }
    });
  });
}

function clearRowErrors(...elements) {
  elements.forEach((element) => {
    element.textContent = "";
  });
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