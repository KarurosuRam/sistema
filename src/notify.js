'use strict';

const { db } = require('./db');
const { sendWhatsApp, BUSINESS_NAME } = require('./whatsapp');

const KIND_LABELS = {
  info: 'Información',
  reminder: 'Recordatorio',
  confirmation: 'Confirmación',
  promotion: 'Promoción',
  cancellation: 'Cancelación',
};

function insertLog(messageId, phone, body, result) {
  db.prepare(
    `INSERT INTO whatsapp_log (message_id, phone, body, status, provider, external_id, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    messageId,
    phone,
    body,
    result.ok ? (result.simulated ? 'simulated' : 'sent') : 'failed',
    result.provider,
    result.externalId || null,
    result.error || null
  );
}

function composeWhatsAppText(title, body) {
  return `*${title}*\n\n${body}\n\n— ${BUSINESS_NAME}`;
}

/**
 * Crea un mensaje en la cuenta del usuario y envía una copia por WhatsApp.
 * Siempre guarda el mensaje, aunque el envío falle (queda registrado en la bitácora).
 */
async function deliverMessage({
  userId,
  kind = 'info',
  title,
  body,
  appointmentId = null,
  createdBy = null,
  silent = false,
}) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId));
  if (!user) throw new Error('Usuario no encontrado');

  const cleanTitle = String(title).trim().slice(0, 160);
  const cleanBody = String(body).trim().slice(0, 2000);
  if (!cleanTitle || !cleanBody) throw new Error('El mensaje necesita título y contenido');

  const info = db
    .prepare(
      `INSERT INTO messages (user_id, appointment_id, kind, title, body, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(user.id, appointmentId, kind, cleanTitle, cleanBody, createdBy);
  const messageId = Number(info.lastInsertRowid);

  let whatsapp = null;
  if (!silent && user.phone) {
    const text = composeWhatsAppText(cleanTitle, cleanBody);
    const result = await sendWhatsApp({ to: user.phone, body: text });
    insertLog(messageId, user.phone, text, result);
    whatsapp = {
      ok: result.ok,
      status: result.ok ? (result.simulated ? 'simulated' : 'sent') : 'failed',
      provider: result.provider,
      error: result.error || null,
    };
  }

  return {
    message: db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId),
    whatsapp,
  };
}

function messageWithDelivery(row) {
  const log = db
    .prepare('SELECT * FROM whatsapp_log WHERE message_id = ? ORDER BY id DESC LIMIT 1')
    .get(row.id);
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || null,
    userPhone: row.user_phone || null,
    appointmentId: row.appointment_id,
    kind: row.kind,
    kindLabel: KIND_LABELS[row.kind] || row.kind,
    title: row.title,
    body: row.body,
    read: !!row.read_at,
    readAt: row.read_at,
    createdAt: row.created_at,
    whatsapp: log
      ? {
          status: log.status,
          provider: log.provider,
          phone: log.phone,
          error: log.error,
          sentAt: log.created_at,
          externalId: log.external_id,
        }
      : null,
  };
}

module.exports = { deliverMessage, messageWithDelivery, composeWhatsAppText, KIND_LABELS, insertLog };
