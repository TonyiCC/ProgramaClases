const connectBtn = document.getElementById("connectBtn");
const connectDropdown = document.getElementById("connectDropdown");
const connectMenu = document.getElementById("connectMenu");
const openLoginBtn = document.getElementById("openLoginBtn");
const openRegisterBtn = document.getElementById("openRegisterBtn");
const logoutBtn = document.getElementById("logoutBtn");

const loginBox = document.getElementById("loginBox");
const loginIdentifier = document.getElementById("loginIdentifier");
const loginPassword = document.getElementById("loginPassword");
const loginRegisterLink = document.getElementById("loginRegisterLink");

const registerBox = document.getElementById("registerBox");
const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const registerLoginLink = document.getElementById("registerLoginLink");

const loginIdentifierError = document.getElementById("loginIdentifierError");
const loginPasswordError = document.getElementById("loginPasswordError");
const loginFormError = document.getElementById("loginFormError");

const registerNameError = document.getElementById("registerNameError");
const registerEmailError = document.getElementById("registerEmailError");
const registerPasswordError = document.getElementById("registerPasswordError");
const registerFormError = document.getElementById("registerFormError");

const usersBtn = document.getElementById("usersBtn");
const editSpacesBtn = document.getElementById("editSpacesBtn");
const spacesGrid = document.getElementById("spacesGrid");

let currentUser = null;
let spaces = [];

function hideError(element) {
  element.textContent = "";
  element.classList.add("hidden");
}

function showError(element, message) {
  element.textContent = message;
  element.classList.remove("hidden");
}

function clearLoginErrors() {
  hideError(loginIdentifierError);
  hideError(loginPasswordError);
  hideError(loginFormError);
}

function clearRegisterErrors() {
  hideError(registerNameError);
  hideError(registerEmailError);
  hideError(registerPasswordError);
  hideError(registerFormError);
}

function updateConnectMenu() {
  if (currentUser) {
    openLoginBtn.classList.add("hidden");
    openRegisterBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    openLoginBtn.classList.remove("hidden");
    openRegisterBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }
}

function updateAdminButtons() {
  const isAdmin = currentUser?.role === "admin";
  usersBtn.classList.toggle("hidden", !isAdmin);
  editSpacesBtn.classList.toggle("hidden", !isAdmin);
}

function updateConnectButton() {
  connectBtn.textContent = currentUser?.name || "Connect";
  updateConnectMenu();
  updateAdminButtons();
}

function showConnectMenu() {
  connectMenu.classList.remove("hidden");
  loginBox.classList.add("hidden");
  registerBox.classList.add("hidden");
}

function showLoginBox() {
  clearLoginErrors();
  connectMenu.classList.add("hidden");
  loginBox.classList.remove("hidden");
  registerBox.classList.add("hidden");
  setTimeout(() => loginIdentifier.focus(), 0);
}

function showRegisterBox() {
  clearRegisterErrors();
  connectMenu.classList.add("hidden");
  loginBox.classList.add("hidden");
  registerBox.classList.remove("hidden");
  setTimeout(() => registerName.focus(), 0);
}

function toggleConnectDropdown() {
  connectDropdown.classList.toggle("open");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSpacesMenu() {
  if (!spaces.length) {
    spacesGrid.innerHTML = `<div class="empty-state">No hay espacios disponibles.</div>`;
    return;
  }

  spacesGrid.innerHTML = spaces
    .map((space) => {
      const imageMarkup = space.imageUrl
        ? `<div class="space-card-image"><img src="${escapeHtml(space.imageUrl)}" alt="${escapeHtml(space.name)}"></div>`
        : `<div class="space-card-image placeholder"></div>`;

      return `
        <article class="space-card" data-space-code="${escapeHtml(space.code)}">
          ${imageMarkup}
          <div class="space-card-name">${escapeHtml(space.name)}</div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".space-card").forEach((card) => {
    card.addEventListener("click", () => {
      const code = card.dataset.spaceCode;
      window.location.href = `/CalendarioHTML.html?site=${encodeURIComponent(code)}`;
    });
  });
}

async function loadCurrentUser() {
  const response = await fetch("/api/auth/me");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al cargar el usuario");
  }

  currentUser = data.user;
  updateConnectButton();
}

async function loadSpaces() {
  const response = await fetch("/api/spaces");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al cargar los espacios");
  }

  spaces = data;
  renderSpacesMenu();
}

connectBtn.addEventListener("click", () => {
  toggleConnectDropdown();
});

connectDropdown.addEventListener("click", (event) => {
  event.stopPropagation();
});

openLoginBtn.addEventListener("click", showLoginBox);
openRegisterBtn.addEventListener("click", showRegisterBox);
loginRegisterLink.addEventListener("click", showRegisterBox);
registerLoginLink.addEventListener("click", showLoginBox);

usersBtn.addEventListener("click", () => {
  window.location.href = "/Users_HTML.html";
});

editSpacesBtn.addEventListener("click", () => {
  window.location.href = "/EspaciosHTML.html";
});

loginBox.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearLoginErrors();

  const identifier = loginIdentifier.value.trim();
  const password = loginPassword.value;

  if (!identifier) {
    showError(loginFormError, "Introduce tu usuario o correo");
    return;
  }

  if (!password) {
    showError(loginPasswordError, "Introduce tu contraseña");
    return;
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.field === "password") {
        showError(loginPasswordError, data.message);
      } else {
        showError(loginFormError, data.message || "No se pudo iniciar sesión");
      }
      return;
    }

    window.location.reload();
  } catch (error) {
    console.error(error);
    showError(loginFormError, "Error al iniciar sesión");
  }
});

registerBox.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearRegisterErrors();

  const name = registerName.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value;

  if (!name) {
    showError(registerNameError, "Introduce un usuario");
    return;
  }

  if (!email) {
    showError(registerEmailError, "Introduce un correo");
    return;
  }

  if (!password) {
    showError(registerPasswordError, "Introduce una contraseña");
    return;
  }

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.field === "name") {
        showError(registerNameError, data.message);
      } else if (data.field === "email") {
        showError(registerEmailError, data.message);
      } else if (data.field === "password") {
        showError(registerPasswordError, data.message);
      } else {
        showError(registerFormError, data.message || "No se pudo registrar");
      }
      return;
    }

    window.location.reload();
  } catch (error) {
    console.error(error);
    showError(registerFormError, "Error al registrar el usuario");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "No se pudo cerrar sesión");
      return;
    }

    window.location.reload();
  } catch (error) {
    console.error(error);
    alert("Error al cerrar sesión");
  }
});

async function initMenu() {
  showConnectMenu();
  updateConnectButton();

  try {
    await loadCurrentUser();
  } catch (error) {
    console.error(error);
  }

  try {
    await loadSpaces();
  } catch (error) {
    console.error(error);
    spacesGrid.innerHTML = `<div class="empty-state">No se pudieron cargar los espacios.</div>`;
  }
}

initMenu();
