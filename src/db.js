'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (error) {
  console.error(
    '\n[Jardín Memorial] Este proyecto usa node:sqlite (Node 22.5+).\n' +
      'Inicia con:  npm start   (incluye el flag --experimental-sqlite)\n' +
      'o bien:      node --experimental-sqlite server.js\n'
  );
  process.exit(1);
}

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(path.join(config.uploadsDir, 'img'), { recursive: true });
fs.mkdirSync(path.join(config.uploadsDir, 'audio'), { recursive: true });
fs.mkdirSync(path.join(config.uploadsDir, 'video'), { recursive: true });
fs.mkdirSync(config.tmpDir, { recursive: true });

const dbPath = path.join(config.dataDir, 'jardin.sqlite');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    credits INTEGER NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pagado',
    mode TEXT NOT NULL DEFAULT 'demo',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS memorials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    certificate_code TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'persona',
    full_name TEXT NOT NULL,
    relationship TEXT,
    birth_date TEXT,
    death_date TEXT,
    epitaph TEXT,
    biography TEXT,
    main_photo TEXT,
    main_thumb TEXT,
    video_path TEXT,
    video_duration REAL,
    music_path TEXT,
    theme TEXT NOT NULL DEFAULT 'jardin',
    is_public INTEGER NOT NULL DEFAULT 1,
    allow_guestbook INTEGER NOT NULL DEFAULT 1,
    views INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_memorials_user ON memorials(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_memorials_public ON memorials(is_public, created_at DESC);

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memorial_id INTEGER NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    thumb TEXT NOT NULL,
    caption TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_photos_memorial ON photos(memorial_id, position);

  CREATE TABLE IF NOT EXISTS guestbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memorial_id INTEGER NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT,
    message TEXT NOT NULL,
    candle INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_guestbook_memorial ON guestbook(memorial_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS candles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memorial_id INTEGER NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    name TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_candles_memorial ON candles(memorial_id, created_at DESC);
`);

function run(sql, ...params) {
  const result = db.prepare(sql).run(...params);
  return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
}

function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {
      /* noop */
    }
    throw error;
  }
}

module.exports = { db, run, get, all, transaction, dbPath };
