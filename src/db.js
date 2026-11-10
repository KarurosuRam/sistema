'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { todayISO, addDaysISO } = require('./time');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'amapola.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/* ------------------------------------------------------------------ */
/* Schema                                                             */
/* ------------------------------------------------------------------ */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'client',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration    INTEGER NOT NULL,
  price       INTEGER NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS staff (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  color     TEXT NOT NULL DEFAULT '#b76e5d',
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS appointments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id),
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  date       TEXT NOT NULL,
  time       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(date, staff_id);

CREATE TABLE IF NOT EXISTS messages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL DEFAULT 'info',
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  read_at        TEXT,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whatsapp_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id  INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  phone       TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL,
  provider    TEXT NOT NULL,
  external_id TEXT,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
`);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/* ------------------------------------------------------------------ */
/* Seed (only on a fresh database)                                    */
/* ------------------------------------------------------------------ */

function seed() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  );
  const adminId = Number(
    insertUser.run(
      'Valentina Rojas',
      'admin@amapola.cl',
      '+56911112222',
      hashPassword('admin123'),
      'admin'
    ).lastInsertRowid
  );
  const clientId = Number(
    insertUser.run(
      'María González',
      'cliente@demo.cl',
      '+56987654321',
      hashPassword('cliente123'),
      'client'
    ).lastInsertRowid
  );
  insertUser.run('Camila Pérez', 'camila@demo.cl', '+56955554444', hashPassword('cliente123'), 'client');
  insertUser.run('José Fuentes', 'jose@demo.cl', '+56944443333', hashPassword('cliente123'), 'client');

  const insertService = db.prepare(
    'INSERT INTO services (name, description, duration, price) VALUES (?, ?, ?, ?)'
  );
  const services = [
    ['Corte de pelo', 'Corte personalizado con lavado y peinado final.', 45, 18000],
    ['Corte y secado', 'Corte, lavado y secado con brushing.', 60, 23000],
    ['Color completo', 'Coloración profesional con tratamiento de nutrición.', 120, 42000],
    ['Mechas / Highlights', 'Iluminación a mano con papel aluminio y matizador.', 150, 52000],
    ['Peinado de fiesta', 'Ondas, recogidos o trenzas para ocasiones especiales.', 60, 25000],
    ['Tratamiento capilar', 'Hidratación profunda con masaje de cuero cabelludo.', 45, 20000],
    ['Corte de hombre', 'Corte clásico con máquina y tijera, perfilado de barba.', 30, 14000],
    ['Corte de niña / niño', 'Corte para los más pequeños de la casa.', 30, 12000],
  ];
  const serviceIds = services.map((s) => Number(insertService.run(...s).lastInsertRowid));

  const insertStaff = db.prepare('INSERT INTO staff (name, specialty, color) VALUES (?, ?, ?)');
  const staffIds = [
    ['Valentina', 'Color y mechas', '#b76e5d'],
    ['Fernanda', 'Cortes y peinados', '#7c8a6a'],
    ['Tomás', 'Cortes masculinos', '#8a6c9e'],
  ].map((s) => Number(insertStaff.run(...s).lastInsertRowid));

  const insertAppt = db.prepare(
    'INSERT INTO appointments (user_id, service_id, staff_id, date, time, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const yesterday = addDaysISO(today, -1);

  insertAppt.run(clientId, serviceIds[2], staffIds[0], yesterday, '11:00', 'completed', '');
  insertAppt.run(clientId, serviceIds[0], staffIds[1], tomorrow, '16:00', 'confirmed', 'Prefiero tijera, sin máquina.');
  insertAppt.run(clientId, serviceIds[5], staffIds[2], addDaysISO(today, 4), '12:30', 'pending', '');

  const insertMessage = db.prepare(
    'INSERT INTO messages (user_id, appointment_id, kind, title, body, read_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertLog = db.prepare(
    'INSERT INTO whatsapp_log (message_id, phone, body, status, provider, external_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const welcome = Number(
    insertMessage.run(
      clientId,
      null,
      'info',
      '¡Bienvenida a Amapola!',
      'Hola María, gracias por sumarte. En tu cuenta verás cada confirmación y recordatorio de tus reservas. Cualquier cosa nos escribes por aquí.',
      null,
      adminId
    ).lastInsertRowid
  );
  insertLog.run(
    welcome,
    '+56987654321',
    '¡Bienvenida a Amapola! Hola María, gracias por sumarte. En tu cuenta verás cada confirmación y recordatorio de tus reservas.',
    'simulated',
    'simulador',
    'sim_seed_welcome'
  );

  const reminder = Number(
    insertMessage.run(
      clientId,
      null,
      'promotion',
      '20% en tratamientos capilares',
      'Este mes celebramos nuestro aniversario: 20% de descuento en todos los tratamientos capilares. Válido hasta fin de mes, reserva en tu cuenta.',
      null,
      adminId
    ).lastInsertRowid
  );
  insertLog.run(
    reminder,
    '+56987654321',
    'Amapola · 20% en tratamientos capilares. Este mes celebramos nuestro aniversario: 20% de descuento en todos los tratamientos capilares. Válido hasta fin de mes.',
    'simulated',
    'simulador',
    'sim_seed_promo'
  );

  console.log('✔ Base de datos inicializada con datos de demostración.');
}

seed();

module.exports = { db, hashPassword, verifyPassword, DATA_DIR };
