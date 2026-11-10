'use strict';

const express = require('express');
const { db, hashPassword, verifyPassword } = require('./db');
const { todayISO, addDaysISO, formatLongDate, nowHHMM, toMinutes } = require('./time');
const { createSession, destroySession, publicUser, requireAuth, requireAdmin } = require('./auth');
const booking = require('./booking');
const { deliverMessage, messageWithDelivery, composeWhatsAppText, KIND_LABELS, insertLog } = require('./notify');
const { normalizePhone, providerStatus, sendWhatsApp } = require('./whatsapp');
const { sendRemindersFor } = require('./reminders');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                         */
/* ------------------------------------------------------------------ */

const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);

function fail(res, message, code = 400) {
  return res.status(code).json({ error: message });
}

const APPOINTMENT_SELECT = `
  SELECT a.*, sv.name AS service_name, sv.duration AS service_duration, sv.price AS service_price,
         st.name AS staff_name, st.color AS staff_color,
         u.name AS user_name, u.phone AS user_phone, u.email AS user_email
  FROM appointments a
  JOIN services sv ON sv.id = a.service_id
  JOIN staff st ON st.id = a.staff_id
  JOIN users u ON u.id = a.user_id`;

function serializeAppointment(r) {
  return {
    id: r.id,
    date: r.date,
    time: r.time,
    status: r.status,
    statusLabel: STATUS_LABELS[r.status] || r.status,
    notes: r.notes,
    createdAt: r.created_at,
    dateLabel: formatLongDate(r.date),
    service: {
      id: r.service_id,
      name: r.service_name,
      duration: r.service_duration,
      price: r.service_price,
    },
    staff: { id: r.staff_id, name: r.staff_name, color: r.staff_color },
    user: { id: r.user_id, name: r.user_name, phone: r.user_phone, email: r.user_email },
  };
}

function getAppointment(id) {
  const row = db.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).get(Number(id));
  return row ? serializeAppointment(row) : null;
}

function appointmentVariables(appt) {
  return {
    nombre: appt.user.name.split(' ')[0],
    servicio: appt.service.name,
    fecha: appt.dateLabel,
    hora: appt.time,
    estilista: appt.staff.name,
    valor: '$' + appt.service.price.toLocaleString('es-CL'),
    duracion: `${appt.service.duration} min`,
  };
}

function render(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

function appointmentSummary(appt) {
  return `${appt.service.name} con ${appt.staff.name} el ${appt.dateLabel} a las ${appt.time} hrs.`;
}

function requireFields(res, fields) {
  for (const [name, value] of Object.entries(fields)) {
    if (!value) {
      fail(res, `El campo "${name}" es obligatorio.`);
      return false;
    }
  }
  return true;
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/* ------------------------------------------------------------------ */
/* Información pública                                                */
/* ------------------------------------------------------------------ */

router.get('/health', (_req, res) => res.json({ ok: true, date: todayISO() }));

router.get('/services', (req, res) => {
  const all = req.user?.role === 'admin' && req.query.all === '1';
  res.json({ services: booking.getServices({ includeInactive: all }) });
});

router.get('/staff', (req, res) => {
  const all = req.user?.role === 'admin' && req.query.all === '1';
  res.json({ staff: booking.getStaff({ includeInactive: all }) });
});

router.get('/availability', (req, res) => {
  const { date, serviceId } = req.query;
  if (!date || !serviceId) return fail(res, 'Indica fecha y servicio.');
  const data = booking.dayAvailability(String(date), Number(serviceId));
  res.json(data);
});

/* ------------------------------------------------------------------ */
/* Autenticación                                                      */
/* ------------------------------------------------------------------ */

router.post(
  '/auth/register',
  wrap(async (req, res) => {
    const name = str(req.body.name, 80);
    const email = str(req.body.email, 120).toLowerCase();
    const phoneRaw = str(req.body.phone, 30);
    const password = String(req.body.password || '');

    if (!requireFields(res, { nombre: name, email, teléfono: phoneRaw, contraseña: password })) return;
    if (!isEmail(email)) return fail(res, 'Ingresa un correo electrónico válido.');
    if (password.length < 6) return fail(res, 'La contraseña debe tener al menos 6 caracteres.');
    const phone = normalizePhone(phoneRaw);
    if (phone.replace(/\D/g, '').length < 8)
      return fail(res, 'Ingresa un número de WhatsApp válido, por ejemplo +56 9 8765 4321.');

    const exists = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
    if (exists) return fail(res, 'Ya existe una cuenta con ese correo. Inicia sesión.', 409);

    const info = db
      .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, phone, hashPassword(password), 'client');
    const userId = Number(info.lastInsertRowid);

    await deliverMessage({
      userId,
      kind: 'info',
      title: '¡Bienvenida a Amapola!',
      body: `Hola ${name.split(' ')[0]}, tu cuenta está lista. Aquí recibirás las confirmaciones, recordatorios y novedades de tus reservas. También te enviaremos una copia por WhatsApp al ${phone}.`,
      createdBy: null,
    });

    const token = createSession(userId);
    const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
    res.status(201).json({ token, user });
  })
);

router.post('/auth/login', (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return fail(res, 'Ingresa tu correo y contraseña.');
  const row = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email);
  if (!row || !verifyPassword(password, row.password_hash))
    return fail(res, 'Correo o contraseña incorrectos.', 401);
  const token = createSession(row.id);
  res.json({ token, user: publicUser(row) });
});

router.post('/auth/logout', (req, res) => {
  destroySession(req.sessionToken);
  res.json({ ok: true });
});

router.get('/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const unread = db
    .prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND read_at IS NULL')
    .get(req.user.id).n;
  res.json({ user: req.user, unreadMessages: unread, provider: providerStatus() });
});

router.patch(
  '/auth/me',
  requireAuth,
  wrap(async (req, res) => {
    const name = req.body.name !== undefined ? str(req.body.name, 80) : req.user.name;
    const phoneRaw = req.body.phone !== undefined ? str(req.body.phone, 30) : req.user.phone;
    const password = req.body.password ? String(req.body.password) : null;
    if (!name) return fail(res, 'El nombre no puede quedar vacío.');
    const phone = normalizePhone(phoneRaw);
    if (phone.replace(/\D/g, '').length < 8) return fail(res, 'El número de WhatsApp no es válido.');
    if (password && password.length < 6) return fail(res, 'La contraseña debe tener al menos 6 caracteres.');

    if (password) {
      db.prepare('UPDATE users SET name = ?, phone = ?, password_hash = ? WHERE id = ?').run(
        name,
        phone,
        hashPassword(password),
        req.user.id
      );
    } else {
      db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, req.user.id);
    }
    const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
    res.json({ user });
  })
);

/* ------------------------------------------------------------------ */
/* Reservas                                                           */
/* ------------------------------------------------------------------ */

router.get('/appointments', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const where = [];
  const params = [];

  if (!isAdmin) {
    where.push('a.user_id = ?');
    params.push(req.user.id);
  } else {
    if (req.query.userId) {
      where.push('a.user_id = ?');
      params.push(Number(req.query.userId));
    }
    if (req.query.date) {
      where.push('a.date = ?');
      params.push(String(req.query.date));
    }
    if (req.query.from) {
      where.push('a.date >= ?');
      params.push(String(req.query.from));
    }
    if (req.query.to) {
      where.push('a.date <= ?');
      params.push(String(req.query.to));
    }
  }
  if (req.query.status && req.query.status !== 'all') {
    where.push('a.status = ?');
    params.push(String(req.query.status));
  }
  const sql = `${APPOINTMENT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY a.date ASC, a.time ASC LIMIT 500`;
  const appointments = db
    .prepare(sql)
    .all(...params)
    .map(serializeAppointment);
  res.json({ appointments });
});

router.post(
  '/appointments',
  requireAuth,
  wrap(async (req, res) => {
    const serviceId = Number(req.body.serviceId);
    const staffId = Number(req.body.staffId);
    const date = str(req.body.date, 10);
    const time = str(req.body.time, 5);
    const notes = str(req.body.notes, 400);
    const isAdmin = req.user.role === 'admin';
    const userId = isAdmin && req.body.userId ? Number(req.body.userId) : req.user.id;

    if (!requireFields(res, { servicio: serviceId, estilista: staffId, fecha: date, hora: time })) return;
    if (isAdmin && !db.prepare("SELECT id FROM users WHERE id = ? AND role = 'client'").get(userId))
      return fail(res, 'La clienta seleccionada no existe.');

    const check = booking.validateBooking({ date, time, serviceId, staffId });
    if (!check.ok) return fail(res, check.error, 409);

    const info = db
      .prepare(
        'INSERT INTO appointments (user_id, service_id, staff_id, date, time, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(userId, serviceId, staffId, date, time, 'pending', notes);
    const appointmentId = Number(info.lastInsertRowid);
    const appt = getAppointment(appointmentId);

    await deliverMessage({
      userId,
      appointmentId,
      kind: 'confirmation',
      title: 'Reserva recibida',
      body:
        `Hola ${appt.user.name.split(' ')[0]}, recibimos tu reserva de ${appointmentSummary(appt)} ` +
        `Valor referencial: $${appt.service.price.toLocaleString('es-CL')}. Te avisaremos por aquí cuando la confirmemos.`,
      createdBy: req.user.id,
    });

    res.status(201).json({ appointment: appt });
  })
);

router.patch(
  '/appointments/:id',
  requireAuth,
  wrap(async (req, res) => {
    const appt = getAppointment(req.params.id);
    if (!appt) return fail(res, 'Reserva no encontrada.', 404);
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && appt.user.id !== req.user.id) return fail(res, 'No autorizado.', 403);

    const status = str(req.body.status, 20);
    if (!Object.keys(STATUS_LABELS).includes(status)) return fail(res, 'Estado no válido.');
    if (!isAdmin && status !== 'cancelled') return fail(res, 'Solo puedes cancelar tus reservas.', 403);
    if (appt.status === status) return res.json({ appointment: appt });
    if (!isAdmin) {
      const today = todayISO();
      const minutes = appt.date === today ? toMinutes(appt.time) - toMinutes(nowHHMM()) : Infinity;
      if (minutes < 120) return fail(res, 'Solo puedes cancelar hasta 2 horas antes de tu hora.', 409);
    }

    const notes = req.body.notes !== undefined ? str(req.body.notes, 400) : appt.notes;
    db.prepare('UPDATE appointments SET status = ?, notes = ? WHERE id = ?').run(status, notes, appt.id);
    const updated = getAppointment(appt.id);

    if (isAdmin && req.body.notify !== false && status !== 'pending') {
      const titles = {
        confirmed: 'Reserva confirmada',
        cancelled: 'Reserva cancelada',
        completed: '¡Gracias por tu visita!',
      };
      const bodies = {
        confirmed: `Hola ${updated.user.name.split(' ')[0]}, tu reserva de ${appointmentSummary(updated)} quedó confirmada. ¡Te esperamos!`,
        cancelled: `Hola ${updated.user.name.split(' ')[0]}, cancelamos tu reserva de ${appointmentSummary(updated)}. Si quieres reagendar, puedes hacerlo desde tu cuenta.`,
        completed: `Hola ${updated.user.name.split(' ')[0]}, esperamos que hayas quedado feliz con tu ${updated.service.name.toLowerCase()}. ¡Gracias por visitarnos!`,
      };
      await deliverMessage({
        userId: updated.user.id,
        appointmentId: updated.id,
        kind: status === 'cancelled' ? 'cancellation' : 'confirmation',
        title: titles[status],
        body: bodies[status],
        createdBy: req.user.id,
      });
    } else if (!isAdmin && status === 'cancelled') {
      await deliverMessage({
        userId: updated.user.id,
        appointmentId: updated.id,
        kind: 'cancellation',
        title: 'Reserva cancelada',
        body: `Cancelaste tu reserva de ${appointmentSummary(updated)}. No se envió copia a WhatsApp porque la cancelación la hiciste tú. Si fue un error, agenda de nuevo cuando quieras.`,
        createdBy: req.user.id,
        silent: true,
      });
    }

    res.json({ appointment: updated });
  })
);

/* ------------------------------------------------------------------ */
/* Mensajes del usuario                                               */
/* ------------------------------------------------------------------ */

router.get('/messages', requireAuth, (req, res) => {
  const userId = req.user.role === 'admin' && req.query.userId ? Number(req.query.userId) : req.user.id;
  const rows = db
    .prepare(
      `SELECT m.*, u.name AS user_name, u.phone AS user_phone
       FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 200`
    )
    .all(userId);
  const unread = rows.filter((r) => !r.read_at).length;
  res.json({ messages: rows.map(messageWithDelivery), unread });
});

router.post('/messages/read-all', requireAuth, (req, res) => {
  db.prepare("UPDATE messages SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(
    req.user.id
  );
  res.json({ ok: true });
});

router.post('/messages/:id/read', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(req.params.id));
  if (!row) return fail(res, 'Mensaje no encontrado.', 404);
  if (row.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, 'No autorizado.', 403);
  db.prepare("UPDATE messages SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ?").run(row.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Administración                                                     */
/* ------------------------------------------------------------------ */

router.get('/admin/stats', requireAdmin, (req, res) => {
  const today = todayISO();
  const weekEnd = addDaysISO(today, 6);
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const active = "a.status IN ('pending','confirmed','completed')";

  const todayCount = one(`SELECT COUNT(*) AS n FROM appointments a WHERE a.date = ? AND ${active}`, today).n;
  const weekCount = one(
    `SELECT COUNT(*) AS n FROM appointments a WHERE a.date BETWEEN ? AND ? AND ${active}`,
    today,
    weekEnd
  ).n;
  const pending = one("SELECT COUNT(*) AS n FROM appointments WHERE status = 'pending'").n;
  const clients = one("SELECT COUNT(*) AS n FROM users WHERE role = 'client'").n;
  const unread = one('SELECT COUNT(*) AS n FROM messages WHERE read_at IS NULL').n;
  const waToday = one(
    "SELECT COUNT(*) AS n FROM whatsapp_log WHERE date(created_at) = date('now','localtime')"
  ).n;
  const waFailed = one("SELECT COUNT(*) AS n FROM whatsapp_log WHERE status = 'failed'").n;
  const revenue = one(
    `SELECT COALESCE(SUM(s.price), 0) AS n FROM appointments a JOIN services s ON s.id = a.service_id
     WHERE a.status = 'completed' AND strftime('%Y-%m', a.date) = strftime('%Y-%m', ?)`,
    today
  ).n;

  const week = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(today, i);
    const row = one(`SELECT COUNT(*) AS n FROM appointments a WHERE a.date = ? AND ${active}`, date);
    week.push({ date, label: formatLongDate(date), short: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(date + 'T12:00:00Z').getUTCDay()], count: row.n });
  }

  const upcoming = db
    .prepare(
      `${APPOINTMENT_SELECT} WHERE a.date >= ? AND a.status IN ('pending','confirmed')
       ORDER BY a.date ASC, a.time ASC LIMIT 6`
    )
    .all(today)
    .map(serializeAppointment);

  res.json({
    today,
    stats: { todayCount, weekCount, pending, clients, unread, waToday, waFailed, revenue },
    week,
    upcoming,
    provider: providerStatus(),
  });
});

router.get('/admin/clients', requireAdmin, (req, res) => {
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const q = str(req.query.q, 80);
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              (SELECT COUNT(*) FROM appointments a WHERE a.user_id = u.id AND a.status != 'cancelled') AS total_appointments,
              (SELECT MAX(a.date) FROM appointments a WHERE a.user_id = u.id AND a.date <= ? AND a.status IN ('confirmed','completed')) AS last_visit,
              (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id AND m.read_at IS NULL) AS unread,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.user_id = u.id) AS last_message
       FROM users u
       WHERE u.role = 'client' AND (? = '' OR lower(u.name) LIKE ? OR lower(u.email) LIKE ? OR u.phone LIKE ?)
       ORDER BY last_message DESC NULLS LAST, u.name ASC
       LIMIT ? OFFSET ?`
    )
    .all(todayISO(), q, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, `%${q}%`, limit, skip)
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      createdAt: r.created_at,
      totalAppointments: r.total_appointments,
      lastVisit: r.last_visit,
      unread: r.unread,
      lastMessage: r.last_message,
    }));
  res.json({ clients: rows });
});

router.get('/admin/messages', requireAdmin, (req, res) => {
  const where = [];
  const params = [];
  if (req.query.userId) {
    where.push('m.user_id = ?');
    params.push(Number(req.query.userId));
  }
  if (req.query.kind && req.query.kind !== 'all') {
    where.push('m.kind = ?');
    params.push(String(req.query.kind));
  }
  const rows = db
    .prepare(
      `SELECT m.*, u.name AS user_name, u.phone AS user_phone
       FROM messages m JOIN users u ON u.id = m.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY m.created_at DESC, m.id DESC LIMIT 200`
    )
    .all(...params);
  res.json({ messages: rows.map(messageWithDelivery), kinds: KIND_LABELS });
});

router.post(
  '/admin/messages',
  requireAdmin,
  wrap(async (req, res) => {
    const kind = KIND_LABELS[req.body.kind] ? String(req.body.kind) : 'info';
    const title = str(req.body.title, 160);
    const body = str(req.body.body, 2000);
    if (!requireFields(res, { título: title, mensaje: body })) return;

    const audience = String(req.body.audience || 'user');
    const appointmentId = req.body.appointmentId ? Number(req.body.appointmentId) : null;

    let recipients = [];
    if (audience === 'all') {
      recipients = db.prepare("SELECT id, name, phone FROM users WHERE role = 'client' ORDER BY id").all();
    } else {
      const user = db
        .prepare("SELECT id, name, phone FROM users WHERE id = ? AND role = 'client'")
        .get(Number(req.body.userId));
      if (!user) return fail(res, 'Selecciona una clienta válida.');
      recipients = [user];
    }
    if (!recipients.length) return fail(res, 'No hay clientas registradas para enviar el mensaje.');

    const results = [];
    for (const user of recipients) {
      let finalTitle = title;
      let finalBody = body;
      let appt = null;
      if (appointmentId) {
        appt = getAppointment(appointmentId);
        if (appt && appt.user.id === user.id) {
          const vars = appointmentVariables(appt);
          finalTitle = render(title, vars);
          finalBody = render(body, vars);
        }
      } else {
        finalBody = render(body, { nombre: user.name.split(' ')[0] });
        finalTitle = render(title, { nombre: user.name.split(' ')[0] });
      }
      const delivered = await deliverMessage({
        userId: user.id,
        kind,
        title: finalTitle,
        body: finalBody,
        appointmentId: appt ? appt.id : null,
        createdBy: req.user.id,
      });
      results.push({
        userId: user.id,
        userName: user.name,
        whatsapp: delivered.whatsapp,
        text: composeWhatsAppText(finalTitle, finalBody),
      });
    }

    const sent = results.filter((r) => r.whatsapp?.ok).length;
    res.status(201).json({
      delivered: results.length,
      whatsappOk: sent,
      whatsappFailed: results.length - sent,
      results,
    });
  })
);

router.get('/admin/outbox', requireAdmin, (req, res) => {
  const where = [];
  const params = [];
  if (req.query.status && req.query.status !== 'all') {
    where.push('w.status = ?');
    params.push(String(req.query.status));
  }
  if (req.query.q) {
    where.push('(lower(u.name) LIKE ? OR w.phone LIKE ? OR lower(m.title) LIKE ?)');
    const q = `%${String(req.query.q).toLowerCase()}%`;
    params.push(q, `%${req.query.q}%`, q);
  }
  const rows = db
    .prepare(
      `SELECT w.*, u.name AS user_name, m.title AS message_title, m.kind AS kind
       FROM whatsapp_log w
       LEFT JOIN messages m ON m.id = w.message_id
       LEFT JOIN users u ON u.id = m.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY w.id DESC LIMIT 200`
    )
    .all(...params);
  const counts = db
    .prepare('SELECT status, COUNT(*) AS n FROM whatsapp_log GROUP BY status')
    .all()
    .reduce((acc, r) => ({ ...acc, [r.status]: r.n }), {});
  res.json({
    outbox: rows.map((r) => ({
      id: r.id,
      messageId: r.message_id,
      userName: r.user_name,
      title: r.message_title,
      kind: r.kind,
      phone: r.phone,
      body: r.body,
      status: r.status,
      provider: r.provider,
      error: r.error,
      createdAt: r.created_at,
    })),
    counts,
    provider: providerStatus(),
  });
});

router.post(
  '/admin/whatsapp/test',
  requireAdmin,
  wrap(async (req, res) => {
    const phone = normalizePhone(str(req.body.phone, 30));
    if (phone.replace(/\D/g, '').length < 8) return fail(res, 'Ingresa un número válido.');
    const body = str(req.body.body, 500) || 'Prueba de conexión desde el panel de Amapola. ¡Todo funcionando!';
    const text = composeWhatsAppText('Prueba de WhatsApp', body);
    const result = await sendWhatsApp({ to: phone, body: text });
    insertLog(null, phone, text, result);
    res.json({ ok: result.ok, provider: result.provider, simulated: result.simulated, error: result.error });
  })
);

router.post(
  '/admin/reminders/tomorrow',
  requireAdmin,
  wrap(async (req, res) => {
    const result = await sendRemindersFor(addDaysISO(todayISO(), 1), { createdBy: req.user.id });
    res.json(result);
  })
);

/* Servicios ------------------------------------------------------- */

router.post('/admin/services', requireAdmin, (req, res) => {
  const name = str(req.body.name, 80);
  const description = str(req.body.description, 300);
  const duration = Number(req.body.duration);
  const price = Number(req.body.price);
  if (!name) return fail(res, 'El nombre del servicio es obligatorio.');
  if (!Number.isFinite(duration) || duration < 15 || duration > 480)
    return fail(res, 'La duración debe estar entre 15 y 480 minutos.');
  if (!Number.isFinite(price) || price < 0) return fail(res, 'El precio no es válido.');
  const info = db
    .prepare('INSERT INTO services (name, description, duration, price, active) VALUES (?, ?, ?, ?, 1)')
    .run(name, description, Math.round(duration), Math.round(price));
  res.status(201).json({ service: booking.serviceById(Number(info.lastInsertRowid)) });
});

router.patch('/admin/services/:id', requireAdmin, (req, res) => {
  const current = booking.serviceById(req.params.id);
  if (!current) return fail(res, 'Servicio no encontrado.', 404);
  const name = req.body.name !== undefined ? str(req.body.name, 80) : current.name;
  const description = req.body.description !== undefined ? str(req.body.description, 300) : current.description;
  const duration = req.body.duration !== undefined ? Number(req.body.duration) : current.duration;
  const price = req.body.price !== undefined ? Number(req.body.price) : current.price;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : current.active ? 1 : 0;
  if (!name) return fail(res, 'El nombre del servicio es obligatorio.');
  if (!Number.isFinite(duration) || duration < 15 || duration > 480)
    return fail(res, 'La duración debe estar entre 15 y 480 minutos.');
  if (!Number.isFinite(price) || price < 0) return fail(res, 'El precio no es válido.');
  db.prepare('UPDATE services SET name = ?, description = ?, duration = ?, price = ?, active = ? WHERE id = ?').run(
    name,
    description,
    Math.round(duration),
    Math.round(price),
    active,
    current.id
  );
  res.json({ service: booking.serviceById(current.id) });
});

/* Estilistas ------------------------------------------------------ */

router.post('/admin/staff', requireAdmin, (req, res) => {
  const name = str(req.body.name, 60);
  const specialty = str(req.body.specialty, 80);
  const color = /^#[0-9a-fA-F]{6}$/.test(String(req.body.color || '')) ? String(req.body.color) : '#b76e5d';
  if (!name) return fail(res, 'El nombre es obligatorio.');
  const info = db
    .prepare('INSERT INTO staff (name, specialty, color, active) VALUES (?, ?, ?, 1)')
    .run(name, specialty, color);
  res.status(201).json({ staff: booking.staffById(Number(info.lastInsertRowid)) });
});

router.patch('/admin/staff/:id', requireAdmin, (req, res) => {
  const current = booking.staffById(req.params.id);
  if (!current) return fail(res, 'Estilista no encontrada.', 404);
  const name = req.body.name !== undefined ? str(req.body.name, 60) : current.name;
  const specialty = req.body.specialty !== undefined ? str(req.body.specialty, 80) : current.specialty;
  const color = /^#[0-9a-fA-F]{6}$/.test(String(req.body.color || '')) ? String(req.body.color) : current.color;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : current.active ? 1 : 0;
  if (!name) return fail(res, 'El nombre es obligatorio.');
  db.prepare('UPDATE staff SET name = ?, specialty = ?, color = ?, active = ? WHERE id = ?').run(
    name,
    specialty,
    color,
    active,
    current.id
  );
  res.json({ staff: booking.staffById(current.id) });
});

module.exports = router;
