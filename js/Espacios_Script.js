const spacesList = document.getElementById("spacesList");
const sortByNameBtn = document.getElementById("sortByNameBtn");
const addSpaceBtn = document.getElementById("addSpaceBtn");

let spaces = [];

async function loadSpaces() {
  try {
    const response = await fetch("/api/admin/spaces");
    const data = await response.json();

    if (!response.ok) {
      spacesList.innerHTML = `<div class="spaces-message">${data.message || "No se pudieron cargar los espacios"}</div>`;
      return;
    }

    spaces = data;
    renderSpaces();
  } catch (error) {
    console.error(error);
    spacesList.innerHTML = `<div class="spaces-message">Error al cargar los espacios</div>`;
  }
}

function renderSpaces() {
  const sortedSpaces = [...spaces].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" })
  );

  if (!sortedSpaces.length) {
    spacesList.innerHTML = `<div class="spaces-message">No hay espacios registrados</div>`;
    return;
  }

  spacesList.innerHTML = sortedSpaces
    .map((space) => {
      return `
        <div class="space-row" data-space-id="${space.id}">
          <div class="space-field">${escapeHtml(space.name || "")}</div>
          <div class="space-actions">
            <button
              type="button"
              class="space-delete-btn"
              title="Eliminar espacio"
              aria-label="Eliminar espacio"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9zm1 12c-1.1 0-2-.9-2-2V8h12v11c0 1.1-.9 2-2 2H8z"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  attachDeleteEvents();
}

function attachDeleteEvents() {
  const rows = document.querySelectorAll(".space-row");

  rows.forEach((row) => {
    const deleteBtn = row.querySelector(".space-delete-btn");

    deleteBtn.addEventListener("click", async () => {
      const spaceId = row.dataset.spaceId;

      try {
        const response = await fetch(`/api/admin/spaces/${spaceId}`, {
          method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.message || "No se pudo eliminar el espacio");
          return;
        }

        await loadSpaces();
      } catch (error) {
        console.error(error);
        alert("Error al eliminar el espacio");
      }
    });
  });
}

function addTemporarySpaceRow() {
  const existingTempRow = document.querySelector(".space-row.temp-row");

  if (existingTempRow) {
    const input = existingTempRow.querySelector(".space-input");
    if (input) input.focus();
    return;
  }

  const emptyMessage = spacesList.querySelector(".spaces-message");
  if (emptyMessage) {
    spacesList.innerHTML = "";
  }

  const tempRow = document.createElement("div");
  tempRow.className = "space-row temp-row";

  tempRow.innerHTML = `
    <div class="space-create-row">
      <input
        type="text"
        class="space-input"
        placeholder="Escribe el nombre del nuevo espacio"
      />
      <p class="space-error"></p>
    </div>
    <div class="space-actions">
      <button type="button" class="space-save-btn">Guardar</button>
    </div>
  `;

  spacesList.appendChild(tempRow);

  const input = tempRow.querySelector(".space-input");
  const saveBtn = tempRow.querySelector(".space-save-btn");
  const errorEl = tempRow.querySelector(".space-error");

  saveBtn.addEventListener("click", async () => {
    const name = input.value.trim();
    errorEl.textContent = "";

    try {
      const response = await fetch("/api/admin/spaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
      });

      const data = await response.json();

      if (!response.ok) {
        errorEl.textContent = data.message || "No se pudo crear el espacio";
        return;
      }

      await loadSpaces();
    } catch (error) {
      console.error(error);
      errorEl.textContent = "Error al crear el espacio";
    }
  });

  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveBtn.click();
    }
  });

  input.focus();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

sortByNameBtn.addEventListener("click", () => {
  renderSpaces();
});

addSpaceBtn.addEventListener("click", () => {
  addTemporarySpaceRow();
});

loadSpaces();