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

function createPurchase({
  userId,
  plan,
  planName,
  amount,
  credits,
  reference,
  mode,
  provider = 'demo',
  status = 'pagado'
}) {
  const now = nowIso();
  run(
    `INSERT INTO purchases
       (user_id, plan, plan_name, amount, credits, reference, status, mode, provider, created_at, paid_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userId,
    plan,
    planName,
    amount,
    credits,
    reference,
    status,
    mode || provider,
    provider,
    now,
    status === 'pagado' ? now : null,
    now
  );
  return get('SELECT * FROM purchases WHERE reference = ?', reference);
}

/** Compra inmediata (modo demostración): se acredita en el acto. */
function completePurchase({ userId, plan, planName, amount, credits, reference, mode }) {
  return transaction(() => {
    createPurchase({ userId, plan, planName, amount, credits, reference, mode, provider: mode || 'demo' });
    run('UPDATE users SET credits = credits + ? WHERE id = ?', credits, userId);
    return { purchase: findPurchaseByReference(reference), user: findUserById(userId) };
  });
}

/** Compra real: nace pendiente hasta que la pasarela confirme el pago. */
function createPendingPurchase({ userId, plan, planName, amount, credits, reference, provider = 'flow' }) {
  return createPurchase({
    userId,
    plan,
    planName,
    amount,
    credits,
    reference,
    mode: provider,
    provider,
    status: 'pendiente'
  });
}

/** Guarda el token de la orden y el número de orden de Flow. */
function attachPaymentToken(reference, { token, providerOrder }) {
  run(
    `UPDATE purchases
        SET provider_token = ?, provider_order = COALESCE(?, provider_order), updated_at = ?
      WHERE reference = ?`,
    token,
    providerOrder ? String(providerOrder) : null,
    nowIso(),
    reference
  );
  return findPurchaseByReference(reference);
}

function findPurchaseByProviderToken(token) {
  if (!token) return null;
  return get('SELECT * FROM purchases WHERE provider_token = ?', String(token));
}

/**
 * Acredita una compra pendiente una sola vez. La condición `status != 'pagado'`
 * dentro de la transacción es la que evita duplicar cupos cuando Flow reintenta
 * la notificación o el comprador recarga la página de retorno.
 */
function completePendingPurchase(reference, { providerOrder, payerEmail } = {}) {
  return transaction(() => {
    const purchase = findPurchaseByReference(reference);
    if (!purchase) return null;
    if (purchase.status === 'pagado') return { purchase, credited: false, alreadyPaid: true };

    const now = nowIso();
    const result = run(
      `UPDATE purchases
          SET status = 'pagado',
              provider_order = COALESCE(?, provider_order),
              payer_email = COALESCE(?, payer_email),
              paid_at = ?,
              updated_at = ?
        WHERE reference = ? AND status != 'pagado'`,
      providerOrder ? String(providerOrder) : null,
      payerEmail ? String(payerEmail) : null,
      now,
      now,
      reference
    );

    if (result.changes !== 1) {
      return { purchase: findPurchaseByReference(reference), credited: false, alreadyPaid: true };
    }

    run('UPDATE users SET credits = credits + ? WHERE id = ?', purchase.credits, purchase.user_id);
    return { purchase: findPurchaseByReference(reference), credited: true, alreadyPaid: false };
  });
}

/**
 * Marca una compra como reembolsada y devuelve a la cuenta los cupos que
 * todavía no se habían usado. Nunca deja el saldo en negativo: si la persona
 * ya creó memoriales con esos cupos, solo se descuenta lo que queda.
 *
 * Es idempotente: dos notificaciones del mismo reembolso descuentan una vez.
 */
function markPurchaseRefunded(reference, { refundId = null, reason = null } = {}) {
  return transaction(() => {
    const purchase = findPurchaseByReference(reference);
    if (!purchase) return { purchase: null, creditsRemoved: 0, already: false };
    if (purchase.status === 'reembolsado') {
      return { purchase, creditsRemoved: 0, already: true };
    }

    const now = nowIso();
    const updated = run(
      `UPDATE purchases
          SET status = 'reembolsado',
              refund_id = COALESCE(?, refund_id),
              paid_at = COALESCE(paid_at, ?),
              updated_at = ?
        WHERE reference = ? AND status = 'pagado'`,
      refundId ? String(refundId) : null,
      now,
      now,
      reference
    );

    if (updated.changes !== 1) {
      // No estaba pagada: no hay cupos que devolver, pero se deja constancia.
      run(
        `UPDATE purchases
            SET status = 'reembolsado', refund_id = COALESCE(?, refund_id), updated_at = ?
          WHERE reference = ?`,
        refundId ? String(refundId) : null,
        now,
        reference
      );
      return { purchase: findPurchaseByReference(reference), creditsRemoved: 0, already: false };
    }

    const user = findUserById(purchase.user_id);
    const removed = Math.max(0, Math.min(Number(user?.credits || 0), Number(purchase.credits || 0)));
    if (removed > 0) {
      run('UPDATE users SET credits = credits - ? WHERE id = ?', removed, purchase.user_id);
    }

    if (reason) {
      console.log(`[pagos] Reembolso de ${reference}: ${reason}`);
    }

    return { purchase: findPurchaseByReference(reference), creditsRemoved: removed, already: false };
  });
}

/** Estados que no acreditan cupos: pendiente, rechazado o anulado. */
function updatePurchaseStatus(reference, status, { providerOrder, payerEmail } = {}) {
  if (!['pendiente', 'rechazado', 'anulado'].includes(status)) return findPurchaseByReference(reference);
  run(
    `UPDATE purchases
        SET status = ?,
            provider_order = COALESCE(?, provider_order),
            payer_email = COALESCE(?, payer_email),
            updated_at = ?
      WHERE reference = ? AND status != 'pagado'`,
    status,
    providerOrder ? String(providerOrder) : null,
    payerEmail ? String(payerEmail) : null,
    nowIso(),
    reference
  );
  return findPurchaseByReference(reference);
}

function listPurchases(userId, limit = 20) {
  return all('SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', userId, limit);
}

function findPurchaseByReference(reference) {
  return get('SELECT * FROM purchases WHERE reference = ?', reference);
}

/* --------------------------------------------------------- administración */
// Consultas globales de la página /panel/admin/pagos. No filtran por usuario:
// sólo las usa un administrador (ADMIN_EMAILS).

function listRecentPurchases(limit = 25) {
  return all(
    `SELECT p.*, u.name AS user_name, u.email AS user_email
       FROM purchases p
       JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT ?`,
    limit
  );
}

function purchaseTotals() {
  return get(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'pagado' THEN amount ELSE 0 END), 0) AS amount_paid,
       COALESCE(SUM(CASE WHEN status = 'pagado' THEN credits ELSE 0 END), 0) AS credits_sold,
       COALESCE(SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN status = 'reembolsado' THEN 1 ELSE 0 END), 0) AS refunded,
       COALESCE(SUM(CASE WHEN status = 'reembolsado' THEN amount ELSE 0 END), 0) AS amount_refunded
     FROM purchases`
  );
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

function searchPublicMemorials({ query, limit = 12, offset = 0, kind = null } = {}) {
  const term = `%${String(query || '').replace(/[%_]/g, '')}%`;
  const params = [term, term, term];
  let sql = `SELECT m.*, (SELECT COUNT(*) FROM photos p WHERE p.memorial_id = m.id) AS photo_count
       FROM memorials m
      WHERE m.is_public = 1
        AND (m.full_name LIKE ? COLLATE NOCASE
             OR m.relationship LIKE ? COLLATE NOCASE
             OR m.epitaph LIKE ? COLLATE NOCASE)`;
  if (kind) {
    sql += ' AND m.kind = ?';
    params.push(kind);
  }
  sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return all(sql, ...params);
}

function countSearchPublicMemorials({ query, kind = null } = {}) {
  const term = `%${String(query || '').replace(/[%_]/g, '')}%`;
  const params = [term, term, term];
  let sql = `SELECT COUNT(*) AS total FROM memorials m
      WHERE m.is_public = 1
        AND (m.full_name LIKE ? COLLATE NOCASE
             OR m.relationship LIKE ? COLLATE NOCASE
             OR m.epitaph LIKE ? COLLATE NOCASE)`;
  if (kind) {
    sql += ' AND m.kind = ?';
    params.push(kind);
  }
  return get(sql, ...params).total;
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

function exportMemorialData(memorialId) {
  const memorial = findMemorialById(memorialId);
  if (!memorial) return null;
  return {
    memorial,
    photos: listPhotos(memorialId),
    guestbook: all('SELECT * FROM guestbook WHERE memorial_id = ? ORDER BY created_at ASC', memorialId),
    candles: all('SELECT * FROM candles WHERE memorial_id = ? ORDER BY created_at ASC', memorialId)
  };
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

function listGuestbookForUser(userId, { limit = 60, includeHidden = true } = {}) {
  return all(
    `SELECT g.*, m.full_name, m.slug, m.id AS memorial_id
       FROM guestbook g
       JOIN memorials m ON m.id = g.memorial_id
      WHERE m.user_id = ?
        ${includeHidden ? '' : 'AND g.hidden = 0'}
      ORDER BY g.created_at DESC
      LIMIT ?`,
    userId,
    limit
  );
}

function countGuestbookForUser(userId) {
  return get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN g.hidden = 1 THEN 1 ELSE 0 END) AS hidden
       FROM guestbook g
       JOIN memorials m ON m.id = g.memorial_id
      WHERE m.user_id = ?`,
    userId
  );
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
  createPendingPurchase,
  attachPaymentToken,
  findPurchaseByProviderToken,
  completePendingPurchase,
  updatePurchaseStatus,
  listPurchases,
  markPurchaseRefunded,
  findPurchaseByReference,
  listRecentPurchases,
  purchaseTotals,
  createMemorial,
  findMemorialById,
  findMemorialBySlug,
  findMemorialByCertificate,
  listMemorialsByUser,
  listPublicMemorials,
  countPublicMemorials,
  searchPublicMemorials,
  countSearchPublicMemorials,
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
  listGuestbookForUser,
  countGuestbookForUser,
  exportMemorialData,
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
