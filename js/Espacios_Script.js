const spacesList = document.getElementById("spacesList");
const sortByNameBtn = document.getElementById("sortByNameBtn");

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
        </div>
      `;
    })
    .join("");
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

loadSpaces();