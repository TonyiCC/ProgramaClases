const express = require("express");
const path = require("path");
const { all, get, run, initDatabase } = require("./db");

const app = express();
const PORT = 3000;

app.use(express.json());

app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(express.static(path.join(__dirname, "html")));

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

async function ensureAdminUser() {
  const existingAdmin = await get(
    `SELECT id FROM users WHERE LOWER(name) = 'admin' OR LOWER(email) = 'admin@local'`
  );

  if (existingAdmin) return;

  const hashedPassword = await hashPassword("admin");

  await run(
    `
    INSERT INTO users (name, email, password, role)
    VALUES (?, ?, ?, ?)
    `,
    ["admin", "admin@local", hashedPassword, "admin"]
  );

  console.log("Usuario admin creado: usuario 'admin' / contraseña 'admin'");
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Debes iniciar sesión" });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Debes iniciar sesión" });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({ message: "No tienes permisos de administrador" });
  }

  next();
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    const cleanName = (name || "").trim();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPassword = password || "";

    if (!cleanName) {
      return res.status(400).json({
        field: "name",
        message: "Introduce un usuario"
      });
    }

    if (cleanName.length < 2) {
      return res.status(400).json({
        field: "name",
        message: "El usuario debe tener al menos 2 caracteres"
      });
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(cleanName)) {
      return res.status(400).json({
        field: "name",
        message: "El usuario solo puede contener letras, números, punto, guion y guion bajo"
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        field: "email",
        message: "Introduce un correo"
      });
    }

    if (!cleanPassword) {
      return res.status(400).json({
        field: "password",
        message: "Introduce una contraseña"
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        field: "password",
        message: "La contraseña debe tener al menos 6 caracteres"
      });
    }

    if (/\s/.test(cleanPassword)) {
      return res.status(400).json({
        field: "password",
        message: "La contraseña no puede contener espacios"
      });
    }

    if (!/^[a-zA-Z0-9!@#$%^&*._-]+$/.test(cleanPassword)) {
      return res.status(400).json({
        field: "password",
        message: "La contraseña contiene caracteres no permitidos"
      });
    }

    const existingUserByName = await get(
      `SELECT id FROM users WHERE LOWER(name) = LOWER(?)`,
      [cleanName]
    );

    if (existingUserByName) {
      return res.status(409).json({
        field: "name",
        message: "Ese usuario ya existe"
      });
    }

    const existingUserByEmail = await get(
      `SELECT id FROM users WHERE email = ?`,
      [cleanEmail]
    );

    if (existingUserByEmail) {
      return res.status(409).json({
        field: "email",
        message: "Ese correo ya existe"
      });
    }

    const hashedPassword = await hashPassword(cleanPassword);

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
    const { identifier, email, password } = req.body || {};

    const loginValue = (identifier || email || "").trim().toLowerCase();
    const cleanPassword = password || "";

    if (!loginValue) {
      return res.status(400).json({
        field: "form",
        message: "Introduce tu usuario o correo"
      });
    }

    if (!cleanPassword) {
      return res.status(400).json({
        field: "password",
        message: "Introduce tu contraseña"
      });
    }

    const user = await get(
      `
      SELECT id, name, email, password, role
      FROM users
      WHERE LOWER(email) = ? OR LOWER(name) = ?
      `,
      [loginValue, loginValue]
    );

    if (!user) {
      return res.status(401).json({
        field: "form",
        message: "Ese usuario o correo no existe"
      });
    }

    const isValidPassword = await verifyPassword(cleanPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        field: "password",
        message: "La contraseña es incorrecta"
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

app.get("/api/admin/spaces", requireAdmin, async (req, res) => {
  try {
    const rows = await all(`
      SELECT
        id,
        code,
        name,
        description,
        active,
        created_at AS createdAt
      FROM spaces
      ORDER BY id
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los espacios" });
  }
});

app.post("/api/admin/spaces", requireAdmin, async (req, res) => {
  try {
    const { name } = req.body || {};
    const cleanName = (name || "").trim();

    if (!cleanName) {
      return res.status(400).json({
        field: "name",
        message: "Introduce un nombre para el espacio"
      });
    }

    if (cleanName.length < 2) {
      return res.status(400).json({
        field: "name",
        message: "El nombre debe tener al menos 2 caracteres"
      });
    }

    const existingByName = await get(
      `SELECT id FROM spaces WHERE LOWER(name) = LOWER(?)`,
      [cleanName]
    );

    if (existingByName) {
      return res.status(409).json({
        field: "name",
        message: "Ese espacio ya existe"
      });
    }

    let baseCode = cleanName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!baseCode) {
      baseCode = "espacio";
    }

    let finalCode = baseCode;
    let counter = 2;

    while (true) {
      const existingByCode = await get(
        `SELECT id FROM spaces WHERE code = ?`,
        [finalCode]
      );

      if (!existingByCode) break;

      finalCode = `${baseCode}-${counter}`;
      counter++;
    }

    const result = await run(
      `
      INSERT INTO spaces (code, name, description, active)
      VALUES (?, ?, ?, 1)
      `,
      [finalCode, cleanName, null]
    );

    const newSpace = await get(
      `
      SELECT id, code, name, description, active, created_at AS createdAt
      FROM spaces
      WHERE id = ?
      `,
      [result.lastID]
    );

    res.status(201).json({
      message: "Espacio creado correctamente",
      space: newSpace
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el espacio" });
  }
});

app.delete("/api/admin/spaces/:id", requireAdmin, async (req, res) => {
  try {
    const spaceId = Number(req.params.id);

    if (!spaceId) {
      return res.status(400).json({
        message: "ID de espacio no válido"
      });
    }

    const space = await get(
      `
      SELECT id, name
      FROM spaces
      WHERE id = ?
      `,
      [spaceId]
    );

    if (!space) {
      return res.status(404).json({
        message: "Espacio no encontrado"
      });
    }

    const linkedReservations = await get(
      `SELECT COUNT(*) AS total FROM reservations WHERE space_id = ?`,
      [spaceId]
    );

    if (linkedReservations.total > 0) {
      return res.status(400).json({
        message: "No se puede eliminar un espacio que tiene reservas asociadas"
      });
    }

    await run(`DELETE FROM spaces WHERE id = ?`, [spaceId]);

    res.json({
      message: "Espacio eliminado correctamente",
      space
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el espacio" });
  }
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

app.get("/api/users", requireAdmin, async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT
        id,
        name,
        email,
        role,
        created_at AS createdAt
      FROM users
      ORDER BY LOWER(name)
      `
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener usuarios" });
  }
});

app.put("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { name, email, password } = req.body || {};

    const cleanName = (name || "").trim();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPassword = password || "";

    if (!userId) {
      return res.status(400).json({
        field: "form",
        message: "ID de usuario no válido"
      });
    }

    if (!cleanName) {
      return res.status(400).json({
        field: "name",
        message: "Introduce un usuario"
      });
    }

    if (cleanName.length < 2) {
      return res.status(400).json({
        field: "name",
        message: "El usuario debe tener al menos 2 caracteres"
      });
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(cleanName)) {
      return res.status(400).json({
        field: "name",
        message: "El usuario solo puede contener letras, números, punto, guion y guion bajo"
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        field: "email",
        message: "Introduce un correo"
      });
    }

    const existingUser = await get(
      `SELECT id, role FROM users WHERE id = ?`,
      [userId]
    );

    if (!existingUser) {
      return res.status(404).json({
        field: "form",
        message: "Usuario no encontrado"
      });
    }

    const existingUserByName = await get(
      `SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND id != ?`,
      [cleanName, userId]
    );

    if (existingUserByName) {
      return res.status(409).json({
        field: "name",
        message: "Ese usuario ya existe"
      });
    }

    const existingUserByEmail = await get(
      `SELECT id FROM users WHERE email = ? AND id != ?`,
      [cleanEmail, userId]
    );

    if (existingUserByEmail) {
      return res.status(409).json({
        field: "email",
        message: "Ese correo ya existe"
      });
    }

    if (cleanPassword) {
      if (cleanPassword.length < 6) {
        return res.status(400).json({
          field: "password",
          message: "La contraseña debe tener al menos 6 caracteres"
        });
      }

      if (/\s/.test(cleanPassword)) {
        return res.status(400).json({
          field: "password",
          message: "La contraseña no puede contener espacios"
        });
      }

      if (!/^[a-zA-Z0-9!@#$%^&*._-]+$/.test(cleanPassword)) {
        return res.status(400).json({
          field: "password",
          message: "La contraseña contiene caracteres no permitidos"
        });
      }

      const hashedPassword = await hashPassword(cleanPassword);

      await run(
        `
        UPDATE users
        SET name = ?, email = ?, password = ?
        WHERE id = ?
        `,
        [cleanName, cleanEmail, hashedPassword, userId]
      );
    } else {
      await run(
        `
        UPDATE users
        SET name = ?, email = ?
        WHERE id = ?
        `,
        [cleanName, cleanEmail, userId]
      );
    }

    const updatedUser = await get(
      `
      SELECT id, name, email, role, created_at AS createdAt
      FROM users
      WHERE id = ?
      `,
      [userId]
    );

    res.json({
      message: "Usuario actualizado correctamente",
      user: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar el usuario" });
  }
});

app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!userId) {
      return res.status(400).json({
        message: "ID de usuario no válido"
      });
    }

    const targetUser = await get(
      `
      SELECT id, name, email, role
      FROM users
      WHERE id = ?
      `,
      [userId]
    );

    if (!targetUser) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    if (targetUser.id === req.session.user.id) {
      return res.status(400).json({
        message: "No puedes eliminar tu propio usuario"
      });
    }

    if (targetUser.role === "admin") {
      const adminCountRow = await get(
        `SELECT COUNT(*) AS total FROM users WHERE role = 'admin'`
      );

      if (adminCountRow.total <= 1) {
        return res.status(400).json({
          message: "No puedes eliminar el último administrador"
        });
      }
    }

    await run(`DELETE FROM users WHERE id = ?`, [userId]);

    res.json({
      message: "Usuario eliminado correctamente",
      user: targetUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el usuario" });
  }
});
//---------------------------//





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
        r.user_id AS userId,
        u.name AS reservedByName,
        s.code AS site,
        s.name AS siteName,
        r.date,
        r.slot_start AS slotStart,
        r.slot_end AS slotEnd,
        r.status,
        r.notes
      FROM reservations r
      JOIN spaces s ON s.id = r.space_id
      LEFT JOIN users u ON u.id = r.user_id
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

app.post("/api/reservations", requireAuth, async (req, res) => {
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
      INSERT INTO reservations (user_id, space_id, date, slot_start, slot_end, notes)
      VALUES (?, ?, ?, ?, ?, ?)
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

app.delete("/api/reservations/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const reservation = await get(
      `
      SELECT
        r.id,
        r.user_id AS userId,
        s.code AS site,
        s.name AS siteName,
        r.date,
        r.slot_start AS slotStart
      FROM reservations r
      JOIN spaces s ON s.id = r.space_id
      WHERE r.id = ?
      `,
      [id]
    );

    if (!reservation) {
      return res.status(404).json({
        message: "Reserva no encontrada"
      });
    }

    const isOwner = reservation.userId === req.session.user.id;
    const isAdmin = req.session.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "No tienes permisos para eliminar esta reserva"
      });
    }

    await run(`DELETE FROM reservations WHERE id = ?`, [id]);

    res.json({
      message: "Reserva eliminada correctamente",
      reservation
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar la reserva" });
  }
});

initDatabase()
  .then(async () => {
    await ensureAdminUser();

    app.listen(PORT, () => {
      console.log(`Servidor iniciado en http://localhost:3000`);
    });
  })
  .catch((error) => {
    console.error("Error inicializando la base de datos:", error);
  });
  