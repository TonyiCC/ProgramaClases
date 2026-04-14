const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "reservas.db");
const schemaPath = path.join(__dirname, "schema.sql");
const seedPath = path.join(__dirname, "seed.sql");

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function ensureSpacesColumns() {
  const columns = await all(`PRAGMA table_info(spaces)`);
  const names = columns.map((column) => column.name);

  if (!names.includes("image_url")) {
    await run(`ALTER TABLE spaces ADD COLUMN image_url TEXT`);
  }
}

async function initDatabase() {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await exec(schemaSql);
  await ensureSpacesColumns();

  const spacesTable = await get(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'spaces'
  `);

  if (!spacesTable) {
    throw new Error("No se ha creado la tabla spaces");
  }

  const countRow = await get("SELECT COUNT(*) AS total FROM spaces");

  if (countRow.total === 0) {
    const seedSql = fs.readFileSync(seedPath, "utf8");
    await exec(seedSql);
    console.log("Seed aplicado");
  } else {
    console.log("Seed omitido: la base ya tiene datos");
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  exec,
  initDatabase
};
