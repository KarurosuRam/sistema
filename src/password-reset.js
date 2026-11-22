'use strict';

/**
 * Recuperación de contraseña.
 *
 * Flujo: el usuario pide el enlace con su correo, se crea un token de un solo
 * uso (60 minutos) y se le entrega por correo. En la base se guarda solo el
 * hash SHA-256 del token: si alguien leyera la tabla no podría reconstruir el
 * enlace. Al usarlo se marca como gastado y se cierran todas las sesiones de
 * esa cuenta.
 *
 * Si el sitio todavía no tiene correo configurado, el dueño puede generar un
 * enlace nuevo desde el panel (`/panel/admin/correo`) y enviarlo a mano. Ese
 * enlace es igual de válido y sigue siendo de un solo uso.
 */

const crypto = require('crypto');

const { run, get, all } = require('./db');
const { nowIso } = require('./util');

const TOKEN_BYTES = 32;
const TTL_MINUTES = 60;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function expiresAtFromNow(minutes = TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/**
 * Crea un token nuevo para la cuenta. Los anteriores que seguían sin usar
 * quedan invalidados: solo puede haber un enlace activo por persona.
 */
function createToken(userId, { ip = null, minutes = TTL_MINUTES } = {}) {
  const token = newToken();
  const now = nowIso();
  const expiresAt = expiresAtFromNow(minutes);

  run(
    `UPDATE password_resets SET used_at = ?
      WHERE user_id = ? AND used_at IS NULL`,
    now,
    userId
  );

  run(
    `INSERT INTO password_resets (user_id, token_hash, expires_at, created_at, requested_ip)
     VALUES (?, ?, ?, ?, ?)`,
    userId,
    hashToken(token),
    expiresAt,
    now,
    ip
  );

  return { token, expiresAt, minutes };
}

/**
 * Busca el token sin gastarlo. Devuelve la fila con los datos del usuario o
 * null si no existe, ya se usó o expiró.
 */
function findToken(token) {
  const value = String(token || '').trim();
  if (!value) return null;

  const row = get(
    `SELECT r.*, u.email, u.name
       FROM password_resets r
       JOIN users u ON u.id = r.user_id
      WHERE r.token_hash = ?`,
    hashToken(value)
  );
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

/** Marca el token como usado. La condición evita reutilizarlo dos veces. */
function consumeToken(id) {
  const now = nowIso();
  const result = run(
    'UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL',
    now,
    id
  );
  return result.changes === 1;
}

/**
 * Solicitudes pendientes para el panel: la última de cada cuenta que todavía
 * se puede usar. No incluye enlaces (solo se guarda el hash); el panel genera
 * uno nuevo cuando el dueño necesita enviarlo.
 */
function pendingRequests({ limit = 40 } = {}) {
  return all(
    `SELECT r.id, r.created_at, r.expires_at, r.requested_ip, u.email, u.name, u.id AS user_id
       FROM password_resets r
       JOIN users u ON u.id = r.user_id
      WHERE r.used_at IS NULL AND r.expires_at > ?
      ORDER BY r.created_at DESC
      LIMIT ?`,
    nowIso(),
    limit
  );
}

/** Un pedido concreto (para generar su enlace desde el panel). */
function findRequest(id) {
  const row = get(
    `SELECT r.*, u.email, u.name
       FROM password_resets r
       JOIN users u ON u.id = r.user_id
      WHERE r.id = ?`,
    Number(id)
  );
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

function countPending() {
  const row = get(
    'SELECT COUNT(*) AS total FROM password_resets WHERE used_at IS NULL AND expires_at > ?',
    nowIso()
  );
  return row ? Number(row.total) : 0;
}

/** Invalida todos los enlaces de una cuenta (por ejemplo, al cambiar la clave). */
function invalidateUser(userId) {
  run(
    'UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
    nowIso(),
    userId
  );
}

/** Limpieza: borra los tokens usados o vencidos hace más de una semana. */
function purgeOld() {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  run('DELETE FROM password_resets WHERE created_at < ? OR used_at IS NOT NULL', cutoff);
}

function discard(id) {
  run('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL', nowIso(), id);
}

module.exports = {
  TTL_MINUTES,
  createToken,
  findToken,
  consumeToken,
  pendingRequests,
  findRequest,
  countPending,
  invalidateUser,
  purgeOld,
  discard
};
