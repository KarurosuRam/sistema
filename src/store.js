'use strict';

const { run, get, all, transaction } = require('./db');
const { nowIso, slugify, randomCode, certificateCode } = require('./util');

/* ------------------------------------------------------------------ users */

function createUser({ name, email, passwordHash }) {
  const now = nowIso();
  const result = run(
    'INSERT INTO users (name, email, password_hash, credits, created_at) VALUES (?, ?, ?, 0, ?)',
    name,
    email.toLowerCase(),
    passwordHash,
    now
  );
  return findUserById(result.lastInsertRowid);
}

function findUserByEmail(email) {
  return get('SELECT * FROM users WHERE email = ? COLLATE NOCASE', String(email || '').trim());
}

function findUserById(id) {
  return get('SELECT * FROM users WHERE id = ?', id);
}

function updateUserProfile(id, { name }) {
  run('UPDATE users SET name = ? WHERE id = ?', name, id);
  return findUserById(id);
}

function updateUserPassword(id, passwordHash) {
  run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, id);
}

function addCredits(userId, credits) {
  run('UPDATE users SET credits = credits + ? WHERE id = ?', credits, userId);
  return findUserById(userId);
}

function consumeCredit(userId) {
  const result = run('UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0', userId);
  return result.changes === 1;
}

/* -------------------------------------------------------------- purchases */

function createPurchase({ userId, plan, planName, amount, credits, reference, mode }) {
  const now = nowIso();
  run(
    `INSERT INTO purchases (user_id, plan, plan_name, amount, credits, reference, status, mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pagado', ?, ?)`,
    userId,
    plan,
    planName,
    amount,
    credits,
    reference,
    mode || 'demo',
    now
  );
  return get('SELECT * FROM purchases WHERE reference = ?', reference);
}

function completePurchase({ userId, plan, planName, amount, credits, reference, mode }) {
  return transaction(() => {
    createPurchase({ userId, plan, planName, amount, credits, reference, mode });
    run('UPDATE users SET credits = credits + ? WHERE id = ?', credits, userId);
    return { purchase: findPurchaseByReference(reference), user: findUserById(userId) };
  });
}

function listPurchases(userId, limit = 20) {
  return all('SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', userId, limit);
}

function findPurchaseByReference(reference) {
  return get('SELECT * FROM purchases WHERE reference = ?', reference);
}

/* -------------------------------------------------------------- memorials */

function uniqueSlug(base) {
  const root = slugify(base) || 'memorial';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${randomCode(4).toLowerCase()}`;
    const candidate = `${root}${suffix}`.slice(0, 80);
    if (!get('SELECT 1 AS x FROM memorials WHERE slug = ?', candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function uniqueCertificateCode() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = certificateCode();
    if (!get('SELECT 1 AS x FROM memorials WHERE certificate_code = ?', candidate)) return candidate;
  }
  return `JM-${Date.now().toString(36).toUpperCase()}`;
}

function createMemorial(userId, data) {
  return transaction(() => {
    const now = nowIso();
    const slug = uniqueSlug(data.full_name);
    const code = uniqueCertificateCode();
    const result = run(
      `INSERT INTO memorials
        (user_id, slug, certificate_code, kind, full_name, relationship, birth_date, death_date,
         epitaph, biography, theme, is_public, allow_guestbook, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      slug,
      code,
      data.kind === 'mascota' ? 'mascota' : 'persona',
      data.full_name,
      data.relationship || null,
      data.birth_date || null,
      data.death_date || null,
      data.epitaph || null,
      data.biography || null,
      data.theme || 'jardin',
      data.is_public === false ? 0 : 1,
      data.allow_guestbook === false ? 0 : 1,
      now,
      now
    );
    return findMemorialById(result.lastInsertRowid);
  });
}

function findMemorialById(id) {
  return get('SELECT * FROM memorials WHERE id = ?', id);
}

function findMemorialBySlug(slug) {
  return get('SELECT * FROM memorials WHERE slug = ?', slug);
}

function findMemorialByCertificate(code) {
  return get('SELECT * FROM memorials WHERE certificate_code = ?', code);
}

function listMemorialsByUser(userId) {
  return all(
    `SELECT m.*,
            (SELECT COUNT(*) FROM photos p WHERE p.memorial_id = m.id) AS photo_count,
            (SELECT COUNT(*) FROM guestbook g WHERE g.memorial_id = m.id AND g.hidden = 0) AS message_count,
            (SELECT COUNT(*) FROM candles c WHERE c.memorial_id = m.id) AS candle_count
       FROM memorials m
      WHERE m.user_id = ?
      ORDER BY m.created_at DESC`,
    userId
  );
}

function listPublicMemorials({ limit = 12, offset = 0, kind = null } = {}) {
  if (kind) {
    return all(
      `SELECT m.*, (SELECT COUNT(*) FROM photos p WHERE p.memorial_id = m.id) AS photo_count
         FROM memorials m
        WHERE m.is_public = 1 AND m.kind = ?
        ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      kind,
      limit,
      offset
    );
  }
  return all(
    `SELECT m.*, (SELECT COUNT(*) FROM photos p WHERE p.memorial_id = m.id) AS photo_count
       FROM memorials m
      WHERE m.is_public = 1
      ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
    limit,
    offset
  );
}

function countPublicMemorials() {
  return get('SELECT COUNT(*) AS total FROM memorials WHERE is_public = 1').total;
}

function countAllMemorials() {
  return get('SELECT COUNT(*) AS total FROM memorials').total;
}

function updateMemorial(id, data) {
  run(
    `UPDATE memorials SET
        full_name = ?, kind = ?, relationship = ?, birth_date = ?, death_date = ?,
        epitaph = ?, biography = ?, theme = ?, is_public = ?, allow_guestbook = ?, updated_at = ?
      WHERE id = ?`,
    data.full_name,
    data.kind === 'mascota' ? 'mascota' : 'persona',
    data.relationship || null,
    data.birth_date || null,
    data.death_date || null,
    data.epitaph || null,
    data.biography || null,
    data.theme || 'jardin',
    data.is_public ? 1 : 0,
    data.allow_guestbook ? 1 : 0,
    nowIso(),
    id
  );
  return findMemorialById(id);
}

function setMemorialMainPhoto(id, filename, thumb) {
  run('UPDATE memorials SET main_photo = ?, main_thumb = ?, updated_at = ? WHERE id = ?', filename, thumb, nowIso(), id);
}

function setMemorialVideo(id, filename, duration) {
  run(
    'UPDATE memorials SET video_path = ?, video_duration = ?, updated_at = ? WHERE id = ?',
    filename,
    duration || null,
    nowIso(),
    id
  );
}

function clearMemorialVideo(id) {
  run('UPDATE memorials SET video_path = NULL, video_duration = NULL, updated_at = ? WHERE id = ?', nowIso(), id);
}

function setMemorialMusic(id, filename) {
  run('UPDATE memorials SET music_path = ?, updated_at = ? WHERE id = ?', filename || null, nowIso(), id);
}

function registerView(id) {
  run('UPDATE memorials SET views = views + 1 WHERE id = ?', id);
}

function deleteMemorial(id) {
  run('DELETE FROM memorials WHERE id = ?', id);
}

function isSlugTaken(slug, excludeId = 0) {
  return !!get('SELECT 1 AS x FROM memorials WHERE slug = ? AND id <> ?', slug, excludeId);
}

function changeSlug(id, slug) {
  run('UPDATE memorials SET slug = ?, updated_at = ? WHERE id = ?', slug, nowIso(), id);
}

function siteStats() {
  return {
    memorials: countAllMemorials(),
    publicMemorials: countPublicMemorials(),
    messages: get('SELECT COUNT(*) AS total FROM guestbook WHERE hidden = 0').total,
    candles: get('SELECT COUNT(*) AS total FROM candles').total,
    photos: get('SELECT COUNT(*) AS total FROM photos').total
  };
}

function userStats(userId) {
  const row = get(
    `SELECT
        COUNT(*) AS memorials,
        COALESCE(SUM(m.views), 0) AS views
       FROM memorials m WHERE m.user_id = ?`,
    userId
  );
  const extras = get(
    `SELECT
        (SELECT COUNT(*) FROM photos p JOIN memorials m ON m.id = p.memorial_id WHERE m.user_id = ?) AS photos,
        (SELECT COUNT(*) FROM guestbook g JOIN memorials m ON m.id = g.memorial_id WHERE m.user_id = ? AND g.hidden = 0) AS messages,
        (SELECT COUNT(*) FROM candles c JOIN memorials m ON m.id = c.memorial_id WHERE m.user_id = ?) AS candles`,
    userId,
    userId,
    userId
  );
  return { ...row, ...extras };
}

function listRecentGuestbookForUser(userId, limit = 8) {
  return all(
    `SELECT g.*, m.full_name, m.slug, m.id AS memorial_id
       FROM guestbook g
       JOIN memorials m ON m.id = g.memorial_id
      WHERE m.user_id = ?
      ORDER BY g.created_at DESC LIMIT ?`,
    userId,
    limit
  );
}

/* ----------------------------------------------------------------- photos */

function listPhotos(memorialId) {
  return all('SELECT * FROM photos WHERE memorial_id = ? ORDER BY position, id', memorialId);
}

function countPhotos(memorialId) {
  return get('SELECT COUNT(*) AS total FROM photos WHERE memorial_id = ?', memorialId).total;
}

function addPhoto(memorialId, { filename, thumb, caption }) {
  const position = get('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM photos WHERE memorial_id = ?', memorialId).next;
  return run(
    'INSERT INTO photos (memorial_id, filename, thumb, caption, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    memorialId,
    filename,
    thumb,
    caption || null,
    position,
    nowIso()
  ).lastInsertRowid;
}

function findPhoto(id) {
  return get('SELECT * FROM photos WHERE id = ?', id);
}

function deletePhoto(id) {
  run('DELETE FROM photos WHERE id = ?', id);
}

function updatePhotoCaption(id, caption) {
  run('UPDATE photos SET caption = ? WHERE id = ?', caption || null, id);
}

function reorderPhotos(memorialId, orderedIds) {
  transaction(() => {
    orderedIds.forEach((photoId, index) => {
      run('UPDATE photos SET position = ? WHERE id = ? AND memorial_id = ?', index, photoId, memorialId);
    });
  });
}

/* -------------------------------------------------------------- guestbook */

function listGuestbook(memorialId, { limit = 30, includeHidden = false } = {}) {
  if (includeHidden) {
    return all('SELECT * FROM guestbook WHERE memorial_id = ? ORDER BY created_at DESC LIMIT ?', memorialId, limit);
  }
  return all(
    'SELECT * FROM guestbook WHERE memorial_id = ? AND hidden = 0 ORDER BY created_at DESC LIMIT ?',
    memorialId,
    limit
  );
}

function countGuestbook(memorialId) {
  return get('SELECT COUNT(*) AS total FROM guestbook WHERE memorial_id = ? AND hidden = 0', memorialId).total;
}

function addGuestbookEntry(memorialId, { name, city, message, candle }) {
  return run(
    'INSERT INTO guestbook (memorial_id, name, city, message, candle, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    memorialId,
    name,
    city || null,
    message,
    candle ? 1 : 0,
    nowIso()
  ).lastInsertRowid;
}

function findGuestbookEntry(id) {
  return get('SELECT * FROM guestbook WHERE id = ?', id);
}

function setGuestbookHidden(id, hidden) {
  run('UPDATE guestbook SET hidden = ? WHERE id = ?', hidden ? 1 : 0, id);
}

function deleteGuestbookEntry(id) {
  run('DELETE FROM guestbook WHERE id = ?', id);
}

/* ---------------------------------------------------------------- candles */

function addCandle(memorialId, name) {
  run('INSERT INTO candles (memorial_id, name, created_at) VALUES (?, ?, ?)', memorialId, name || null, nowIso());
}

function countCandles(memorialId) {
  return get('SELECT COUNT(*) AS total FROM candles WHERE memorial_id = ?', memorialId).total;
}

/* --------------------------------------------------------------- sessions */

function createSession({ token, userId, expiresAt }) {
  run('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', token, userId, expiresAt, nowIso());
}

function findSession(token) {
  return get('SELECT * FROM sessions WHERE token = ?', token);
}

function deleteSession(token) {
  run('DELETE FROM sessions WHERE token = ?', token);
}

function deleteExpiredSessions() {
  run('DELETE FROM sessions WHERE expires_at < ?', nowIso());
}

function deleteUserSessions(userId) {
  run('DELETE FROM sessions WHERE user_id = ?', userId);
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserProfile,
  updateUserPassword,
  addCredits,
  consumeCredit,
  createPurchase,
  completePurchase,
  listPurchases,
  findPurchaseByReference,
  createMemorial,
  findMemorialById,
  findMemorialBySlug,
  findMemorialByCertificate,
  listMemorialsByUser,
  listPublicMemorials,
  countPublicMemorials,
  countAllMemorials,
  updateMemorial,
  setMemorialMainPhoto,
  setMemorialVideo,
  clearMemorialVideo,
  setMemorialMusic,
  registerView,
  deleteMemorial,
  isSlugTaken,
  changeSlug,
  listPhotos,
  countPhotos,
  addPhoto,
  findPhoto,
  deletePhoto,
  updatePhotoCaption,
  reorderPhotos,
  listGuestbook,
  countGuestbook,
  addGuestbookEntry,
  findGuestbookEntry,
  setGuestbookHidden,
  deleteGuestbookEntry,
  addCandle,
  countCandles,
  siteStats,
  userStats,
  listRecentGuestbookForUser,
  createSession,
  findSession,
  deleteSession,
  deleteExpiredSessions,
  deleteUserSessions
};
