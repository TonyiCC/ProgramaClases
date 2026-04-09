const siteSelect = document.getElementById("siteSelect");
const monthTitle = document.getElementById("monthTitle");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

const detailsTitle = document.getElementById("detailsTitle");
const detailsSubtitle = document.getElementById("detailsSubtitle");
const slotsContainer = document.getElementById("slotsContainer");

let currentDate = new Date();
let selectedDate = null;

let currentUser = null;
let holidays = [];
let reservations = {};
let isLoading = false;

const timeSlots = [
  { start: "08:30", end: "09:30", label: "08:30 - 09:30" },
  { start: "09:30", end: "10:30", label: "09:30 - 10:30" },
  { start: "10:30", end: "11:30", label: "10:30 - 11:30" },
  { start: "11:30", end: "12:00", label: "11:30 - 12:00 (Recreo)" },
  { start: "12:00", end: "13:00", label: "12:00 - 13:00" },
  { start: "13:00", end: "14:00", label: "13:00 - 14:00" },
  { start: "14:00", end: "15:00", label: "14:00 - 15:00" }
];

function formatDateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

function getReservationsForDay(site, isoDate) {
  return reservations[site]?.[isoDate] || [];
}

function getReservationForSlot(site, isoDate, slotStart) {
  const dayReservations = getReservationsForDay(site, isoDate);
  return dayReservations.find(r => r.slotStart === slotStart) || null;
}

function getReservedSlots(site, isoDate) {
  return getReservationsForDay(site, isoDate).map(r => r.slotStart);
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

function canCancelReservation(reservation) {
  if (!reservation || !currentUser) return false;
  return currentUser.role === "admin" || currentUser.id === reservation.userId;
}

function clearSelection() {
  selectedDate = null;
  detailsTitle.textContent = "Selecciona un día";
  detailsSubtitle.textContent = "Aquí aparecerán las franjas horarias disponibles.";
  slotsContainer.innerHTML = "";
}

function buildReservationsMap(rows) {
  const map = {};
  const currentSite = siteSelect.value;

  map[currentSite] = {};

  rows.forEach(reservation => {
    if (!map[currentSite][reservation.date]) {
      map[currentSite][reservation.date] = [];
    }

    map[currentSite][reservation.date].push({
      id: reservation.id,
      userId: reservation.userId,
      reservedByName: reservation.reservedByName,
      reservedByEmail: reservation.reservedByEmail,
      slotStart: reservation.slotStart,
      slotEnd: reservation.slotEnd,
      site: reservation.site
    });
  });

  return map;
}

async function loadCurrentUser() {
  const response = await fetch("/api/auth/me");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al cargar el usuario");
  }

  currentUser = data.user;
}

async function loadHolidays() {
  const response = await fetch("/api/holidays");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al cargar festivos");
  }

  holidays = data.map(item => item.date);
}

async function loadReservations() {
  const site = siteSelect.value;
  const month = formatMonthToISO(currentDate);

  const response = await fetch(
    `/api/reservations?site=${encodeURIComponent(site)}&month=${encodeURIComponent(month)}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al cargar reservas");
  }

  reservations = buildReservationsMap(data);
}

async function loadCalendarData() {
  try {
    isLoading = true;

    await loadCurrentUser();

    if (holidays.length === 0) {
      await loadHolidays();
    }

    await loadReservations();
    renderCalendar();

    if (selectedDate) {
      renderSlots();
    }
  } catch (error) {
    console.error(error);
    alert("Error al cargar los datos del calendario");
  } finally {
    isLoading = false;
  }
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthTitle.textContent = currentDate.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const site = siteSelect.value;

  let totalCells = 0;

  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day empty";
    calendarGrid.appendChild(emptyCell);
    totalCells++;
  }

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
      dayStatus.textContent = isLoading ? "Cargando..." : "Disponible";
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

  while (totalCells < 42) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day empty";
    calendarGrid.appendChild(emptyCell);
    totalCells++;
  }
}

function selectDay(date) {
  selectedDate = date;

  detailsTitle.textContent = "Horarios del día";
  detailsSubtitle.textContent = formatDateToLong(date);

  renderSlots();
  renderCalendar();
}

async function createReservation(slotStart) {
  if (!selectedDate) return;

  const reservationData = {
    site: siteSelect.value,
    date: formatDateToISO(selectedDate),
    slotStart
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



    await loadCurrentUser();
    await loadReservations();
    renderSlots();
    renderCalendar();
  } catch (error) {
    console.error(error);
    alert("No se pudo conectar con el backend");
  }
}

async function cancelReservation(reservationId) {
  try {
    const response = await fetch(`/api/reservations/${reservationId}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "No se pudo cancelar la reserva");
      return;
    }

    await loadCurrentUser();
    await loadReservations();
    renderSlots();
    renderCalendar();
  } catch (error) {
    console.error(error);
    alert("Error al cancelar la reserva");
  }
}

function renderSlots() {
  slotsContainer.innerHTML = "";

  if (!selectedDate) return;

  const site = siteSelect.value;
  const isoDate = formatDateToISO(selectedDate);

  timeSlots.forEach(slot => {
    const slotEl = document.createElement("div");
    slotEl.classList.add("slot");

    const reservation = getReservationForSlot(site, isoDate, slot.start);
    const isReserved = Boolean(reservation);

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${slot.label}</strong><br>
      <span>${getSlotText(slot, reservation)}</span>
    `;

    const button = document.createElement("button");

    if (isReserved) {
      const cancellable = canCancelReservation(reservation);

      slotEl.classList.add("busy");

      if (cancellable) {
        slotEl.classList.add("cancellable");
        button.textContent = "Ocupado";

        slotEl.addEventListener("mouseenter", () => {
          button.textContent = "Cancelar";
        });

        slotEl.addEventListener("mouseleave", () => {
          button.textContent = "Ocupado";
        });

        button.addEventListener("click", async () => {
          await cancelReservation(reservation.id);
        });
      } else {
        button.textContent = "Ocupado";
        button.disabled = true;
      }
    } else {
      slotEl.classList.add("free");
      button.textContent = "Reservar";
      button.addEventListener("click", async () => {
        await createReservation(slot.start);
      });
    }

    slotEl.appendChild(info);
    slotEl.appendChild(button);
    slotsContainer.appendChild(slotEl);
  });
}

function isOwnerReservation(reservation) {
  if (!reservation || !currentUser) return false;
  return currentUser.id === reservation.userId;
}

function getSlotText(slot, reservation) {
  if (reservation) {
    const name = reservation.reservedByName || "otra persona";

    if (isOwnerReservation(reservation)) {
      return `Reservado por ${name} (tú)`;
    }

    return `Reservado por ${name}`;
  }

  if (slot.start === "11:30") {
    return "Disponible (Recreo)";
  }

  return "Disponible";
}

prevMonthBtn.addEventListener("click", async () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  clearSelection();
  await loadCalendarData();
});

nextMonthBtn.addEventListener("click", async () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  clearSelection();
  await loadCalendarData();
});

siteSelect.addEventListener("change", async () => {
  clearSelection();
  await loadCalendarData();
});

async function initApp() {
  renderCalendar();
  await loadCalendarData();
}

initApp();