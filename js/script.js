const siteSelect = document.getElementById("siteSelect");
const monthTitle = document.getElementById("monthTitle");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

const detailsTitle = document.getElementById("detailsTitle");
const detailsSubtitle = document.getElementById("detailsSubtitle");
const slotsContainer = document.getElementById("slotsContainer");

const summarySite = document.getElementById("summarySite");
const summaryDate = document.getElementById("summaryDate");
const summaryTime = document.getElementById("summaryTime");
const reserveBtn = document.getElementById("reserveBtn");

let currentDate = new Date();
let selectedDate = null;
let selectedSlot = null;

const timeSlots = [
  { start: "08:30", end: "09:30", label: "08:30 - 09:30" },
  { start: "09:30", end: "10:30", label: "09:30 - 10:30" },
  { start: "10:30", end: "11:30", label: "10:30 - 11:30" },
  { start: "11:30", end: "12:00", label: "11:30 - 12:00 (Recreo)" },
  { start: "12:00", end: "13:00", label: "12:00 - 13:00" },
  { start: "13:00", end: "14:00", label: "13:00 - 14:00" },
  { start: "14:00", end: "15:00", label: "14:00 - 15:00" }
];

const holidays = [
  "2026-01-01",
  "2026-01-06",
  "2026-05-01",
  "2026-10-12",
  "2026-12-08",
  "2026-12-25"
];

// Déjalo vacío para que no salga nada reservado al empezar
const reservations = {
  "salon-actos": {},
  "nave": {},
  "polideportivo": {},
  "aula-multiusos": {}
};

function formatDateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isToday(date) {
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function formatDateToLong(date) {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date) {
  return holidays.includes(formatDateToISO(date));
}

function getReservedSlots(site, isoDate) {
  return reservations[site]?.[isoDate] || [];
}

function isFullyReserved(site, isoDate) {
  const reserved = getReservedSlots(site, isoDate);
  const allSlots = timeSlots.map(slot => slot.start);
  return allSlots.length > 0 && allSlots.every(slot => reserved.includes(slot));
}

function isPartiallyReserved(site, isoDate) {
  const reserved = getReservedSlots(site, isoDate);
  return reserved.length > 0 && !isFullyReserved(site, isoDate);
}

function clearSelection() {
  selectedDate = null;
  selectedSlot = null;
  summaryDate.textContent = "-";
  summaryTime.textContent = "-";
  reserveBtn.disabled = true;
  detailsTitle.textContent = "Selecciona un día";
  detailsSubtitle.textContent = "Aquí aparecerán las franjas horarias disponibles.";
  slotsContainer.innerHTML = "";
}

function updateSummarySite() {
  const selectedOption = siteSelect.options[siteSelect.selectedIndex].text;
  summarySite.textContent = selectedOption;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  updateSummarySite();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthTitle.textContent = currentDate.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1; // lunes = 0

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const site = siteSelect.value;

  let totalCells = 0;

  // Huecos vacíos antes del día 1
  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day empty";
    calendarGrid.appendChild(emptyCell);
    totalCells++;
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isoDate = formatDateToISO(date);
    const dayEl = document.createElement("div");
    dayEl.classList.add("day");

    if (isToday(date)) {
      dayEl.classList.add("today");
    }
    const dayNumber = document.createElement("div");
    dayNumber.className = "day-number";
    dayNumber.textContent = day;

    const dayStatus = document.createElement("div");
    dayStatus.className = "day-status";

    const weekend = isWeekend(date);
    const holiday = isHoliday(date);

    if (weekend || holiday) {
      dayEl.classList.add("disabled");
      dayStatus.textContent = holiday ? "Festivo" : "No disponible";
    } else if (isFullyReserved(site, isoDate)) {
      dayEl.classList.add("reserved");
      dayStatus.textContent = "Completo";
      dayEl.addEventListener("click", () => selectDay(date));
    } else if (isPartiallyReserved(site, isoDate)) {
      dayEl.classList.add("partial");
      dayStatus.textContent = "Parcial";
      dayEl.addEventListener("click", () => selectDay(date));
    } else {
      dayEl.classList.add("available");
      dayStatus.textContent = "Disponible";
      dayEl.addEventListener("click", () => selectDay(date));
    }

    if (
      selectedDate &&
      formatDateToISO(selectedDate) === isoDate &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    ) {
      dayEl.classList.add("selected");
    }

    dayEl.appendChild(dayNumber);
    dayEl.appendChild(dayStatus);
    calendarGrid.appendChild(dayEl);
    totalCells++;
  }

  // Rellenar siempre hasta 42 celdas (6 filas x 7 columnas)
  while (totalCells < 42) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day empty";
    calendarGrid.appendChild(emptyCell);
    totalCells++;
  }
}

function selectDay(date) {
  selectedDate = date;
  selectedSlot = null;
  summaryDate.textContent = formatDateToLong(date);
  summaryTime.textContent = "-";
  reserveBtn.disabled = true;

  detailsTitle.textContent = "Horarios del día";
  detailsSubtitle.textContent = formatDateToLong(date);

  renderSlots();
  renderCalendar();
}

function renderSlots() {
  slotsContainer.innerHTML = "";

  if (!selectedDate) return;

  const site = siteSelect.value;
  const isoDate = formatDateToISO(selectedDate);
  const reservedSlots = getReservedSlots(site, isoDate);

  timeSlots.forEach(slot => {
    const slotEl = document.createElement("div");
    slotEl.classList.add("slot");

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${slot.label}</strong><br>
      <span>${getSlotText(slot, reservedSlots)}</span>
    `;

    const button = document.createElement("button");

    if (reservedSlots.includes(slot.start)) {
      slotEl.classList.add("busy");
      button.textContent = "Ocupado";
      button.disabled = true;
    } else {
      slotEl.classList.add("free");
      button.textContent = "Seleccionar";
      button.addEventListener("click", () => {
        selectedSlot = slot.label;
        summaryTime.textContent = slot.label;
        reserveBtn.disabled = false;
      });
    }

    slotEl.appendChild(info);
    slotEl.appendChild(button);
    slotsContainer.appendChild(slotEl);
  });
}

function getSlotText(slot, reservedSlots) {
  if (reservedSlots.includes(slot.start)) {
    return "Ya reservado";
  }

  if (slot.start === "11:30") {
    return "Disponible (Recreo)";
  }

  return "Disponible";
}

prevMonthBtn.addEventListener("click", () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  clearSelection();
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  clearSelection();
  renderCalendar();
});

siteSelect.addEventListener("change", () => {
  clearSelection();
  renderCalendar();
});

reserveBtn.addEventListener("click", async () => {
  if (!selectedDate || !selectedSlot) return;

  const slot = timeSlots.find(s => s.label === selectedSlot);

  if (!slot) {
    alert("No se ha encontrado la franja horaria seleccionada");
    return;
  }

  const reservationData = {
    site: siteSelect.value,
    date: formatDateToISO(selectedDate),
    slotStart: slot.start
  };

  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(reservationData)
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Error al crear la reserva");
      return;
    }

    alert("Reserva creada correctamente");

    // Guardar también en memoria local del front
    if (!reservations[reservationData.site]) {
      reservations[reservationData.site] = {};
    }

    if (!reservations[reservationData.site][reservationData.date]) {
      reservations[reservationData.site][reservationData.date] = [];
    }

    reservations[reservationData.site][reservationData.date].push(reservationData.slotStart);

    selectedSlot = null;
    summaryTime.textContent = "-";
    reserveBtn.disabled = true;

    renderSlots();
    renderCalendar();
  } catch (error) {
    console.error(error);
    alert("No se pudo conectar con el backend");
  }
});
updateSummarySite();
renderCalendar();