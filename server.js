const express = require("express");
const path = require("path");
const { all, get, run, initDatabase } = require("./db");

const app = express();
const PORT = 3000;

//---------------------INICIO SESION ------------------------//
const session = require("express-session");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);

app.use(
  session({
    secret: "cambia-esto-por-una-clave-larga",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedPassword) {
  const [salt, storedKey] = storedPassword.split(":");

  if (!salt || !storedKey) return false;

  const derivedKey = await scrypt(password, salt, 64);
  const storedBuffer = Buffer.from(storedKey, "hex");

  if (storedBuffer.length !== derivedKey.length) return false;

  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Debes iniciar sesión" });
  }

  next();
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Nombre, email y contraseña son obligatorios"
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      return res.status(400).json({
        message: "El nombre es demasiado corto"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "La contraseña debe tener al menos 6 caracteres"
      });
    }

    const existingUser = await get(
      `SELECT id FROM users WHERE email = ?`,
      [cleanEmail]
    );

    if (existingUser) {
      return res.status(409).json({
        message: "Ya existe un usuario con ese email"
      });
    }

    const hashedPassword = await hashPassword(password);

    const result = await run(
      `
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, 'user')
      `,
      [cleanName, cleanEmail, hashedPassword]
    );

    const newUser = await get(
      `
      SELECT id, name, email, role, created_at AS createdAt
      FROM users
      WHERE id = ?
      `,
      [result.lastID]
    );

    req.session.user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    };

    res.status(201).json({
      message: "Usuario registrado correctamente",
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al registrar el usuario" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email y contraseña son obligatorios"
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await get(
      `
      SELECT id, name, email, password, role
      FROM users
      WHERE email = ?
      `,
      [cleanEmail]
    );

    if (!user) {
      return res.status(401).json({
        message: "Credenciales incorrectas"
      });
    }

    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        message: "Credenciales incorrectas"
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    res.json({
      message: "Sesión iniciada correctamente",
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.user) {
    return res.json({ user: null });
  }

  res.json({ user: req.session.user });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error al cerrar sesión" });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Sesión cerrada correctamente" });
  });
});

app.get("/api/my-reservations", requireAuth, async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT
        r.id,
        s.code AS site,
        s.name AS siteName,
        r.date,
        r.slot_start AS slotStart,
        r.slot_end AS slotEnd,
        r.status,
        r.notes
      FROM reservations r
      JOIN spaces s ON s.id = r.space_id
      WHERE r.user_id = ?
        AND r.status = 'active'
      ORDER BY r.date, r.slot_start
      `,
      [req.session.user.id]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener tus reservas" });
  }
});
//---------------------------//



app.use(express.json());
app.use(express.static(path.join(__dirname)));

const timeSlots = [
  { start: "08:30", end: "09:30", label: "08:30 - 09:30" },
  { start: "09:30", end: "10:30", label: "09:30 - 10:30" },
  { start: "10:30", end: "11:30", label: "10:30 - 11:30" },
  { start: "11:30", end: "12:00", label: "11:30 - 12:00 (Recreo)" },
  { start: "12:00", end: "13:00", label: "12:00 - 13:00" },
  { start: "13:00", end: "14:00", label: "13:00 - 14:00" },
  { start: "14:00", end: "15:00", label: "14:00 - 15:00" }
];

function isWeekend(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isValidSlot(slotStart) {
  return timeSlots.some(slot => slot.start === slotStart);
}

function getSlotEnd(slotStart) {
  const slot = timeSlots.find(s => s.start === slotStart);
  return slot ? slot.end : null;
}

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend funcionando correctamente" });
});

app.get("/api/spaces", async (req, res) => {
  try {
    const rows = await all(`
      SELECT id, code, name, description, active
      FROM spaces
      WHERE active = 1
      ORDER BY name
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener espacios" });
  }
});

app.get("/api/holidays", async (req, res) => {
  try {
    const rows = await all(`
      SELECT id, date, description
      FROM holidays
      ORDER BY date
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener festivos" });
  }
});

app.get("/api/time-slots", (req, res) => {
  res.json(timeSlots);
});

app.get("/api/reservations", async (req, res) => {
  const { site, month } = req.query;

  try {
    let sql = `
      SELECT
        r.id,
        s.code AS site,
        s.name AS siteName,
        r.date,
        r.slot_start AS slotStart,
        r.slot_end AS slotEnd,
        r.status,
        r.notes
      FROM reservations r
      JOIN spaces s ON s.id = r.space_id
      WHERE r.status = 'active'
    `;

    const params = [];

    if (site) {
      sql += ` AND s.code = ?`;
      params.push(site);
    }

    if (month) {
      sql += ` AND r.date LIKE ?`;
      params.push(`${month}%`);
    }

    sql += ` ORDER BY r.date, r.slot_start`;

    const rows = await all(sql, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener reservas" });
  }
});

app.post("/api/reservations", async (req, res) => {
  const { site, date, slotStart, notes = null } = req.body;

  try {
    if (!site || !date || !slotStart) {
      return res.status(400).json({
        message: "Faltan datos obligatorios: site, date, slotStart"
      });
    }

    if (!isValidSlot(slotStart)) {
      return res.status(400).json({
        message: "La franja horaria no es válida"
      });
    }

    if (isWeekend(date)) {
      return res.status(400).json({
        message: "No se puede reservar en fin de semana"
      });
    }

    const holiday = await get(
      `SELECT id FROM holidays WHERE date = ?`,
      [date]
    );

    if (holiday) {
      return res.status(400).json({
        message: "No se puede reservar en festivo"
      });
    }

    const space = await get(
      `SELECT id, code, name FROM spaces WHERE code = ? AND active = 1`,
      [site]
    );

    if (!space) {
      return res.status(400).json({
        message: "El espacio seleccionado no es válido"
      });
    }

    const existing = await get(
      `
      SELECT r.id
      FROM reservations r
      WHERE r.space_id = ?
        AND r.date = ?
        AND r.slot_start = ?
        AND r.status = 'active'
      `,
      [space.id, date, slotStart]
    );

    if (existing) {
      return res.status(409).json({
        message: "Esa franja ya está reservada"
      });
    }

    const slotEnd = getSlotEnd(slotStart);

    const result = await run(
      `
      INSERT INTO reservations (space_id, date, slot_start, slot_end, notes)
      VALUES (?, ?, ?, ?, ?)
      `,
      [req.session.user.id, space.id, date, slotStart, slotEnd, notes]
    );

    const newReservation = await get(
      `
      SELECT
        r.id,
        s.code AS site,
        s.name AS siteName,
        r.date,
        r.slot_start AS slotStart,
        r.slot_end AS slotEnd,
        r.status,
        r.notes
      FROM reservations r
      JOIN spaces s ON s.id = r.space_id
      WHERE r.id = ?
      `,
      [result.lastID]
    );

    res.status(201).json({
      message: "Reserva creada correctamente",
      reservation: newReservation
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear la reserva" });
  }
});

app.delete("/api/reservations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const reservation = await get(
      `SELECT id FROM reservations WHERE id = ?`,
      [id]
    );

    if (!reservation) {
      return res.status(404).json({
        message: "Reserva no encontrada"
      });
    }

    await run(
      `DELETE FROM reservations WHERE id = ?`,
      [id]
    );

    res.json({ message: "Reserva eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar la reserva" });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor iniciado en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error inicializando la base de datos:", error);
  });