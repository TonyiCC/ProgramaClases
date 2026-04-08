const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Permite recibir JSON en POST
app.use(express.json());

// Sirve index.html, css, js y assets
app.use(express.static(path.join(__dirname)));

// Ruta de prueba
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend funcionando correctamente" });
});

// Datos de ejemplo
const reservations = [];

// Ver reservas
app.get("/api/reservations", (req, res) => {
  res.json(reservations);
});

// Crear reserva
app.post("/api/reservations", (req, res) => {
  const { site, date, slotStart } = req.body;

  if (!site || !date || !slotStart) {
    return res.status(400).json({
      message: "Faltan datos: site, date y slotStart son obligatorios"
    });
  }

  const exists = reservations.some(
    r => r.site === site && r.date === date && r.slotStart === slotStart
  );

  if (exists) {
    return res.status(409).json({
      message: "Esa franja ya está reservada"
    });
  }

  const newReservation = {
    id: reservations.length + 1,
    site,
    date,
    slotStart
  };

  reservations.push(newReservation);

  res.status(201).json({
    message: "Reserva creada",
    reservation: newReservation
  });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});