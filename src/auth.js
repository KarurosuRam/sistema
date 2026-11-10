'use strict';

const crypto = require('crypto');
const { db } = require('./db');

const SESSION_DAYS = 30;

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expires.toISOString()
  );
  return token;
}

function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at,
  };
}

function userFromToken(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return row;
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.headers['x-session-token']) return String(req.headers['x-session-token']);
  return null;
}

function attachUser(req, _res, next) {
  const token = extractToken(req);
  req.sessionToken = token;
  const row = userFromToken(token);
  req.user = row ? publicUser(row) : null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Solo el equipo de administración puede hacer esto.' });
  next();
}

module.exports = {
  createSession,
  destroySession,
  publicUser,
  attachUser,
  requireAuth,
  requireAdmin,
};
