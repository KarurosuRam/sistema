'use strict';

const { db } = require('./db');
const { todayISO, addDaysISO, formatLongDate } = require('./time');
const { deliverMessage } = require('./notify');

/**
 * Envía los recordatorios de las reservas de una fecha (por defecto mañana).
 * Es idempotente: no repite el recordatorio si ya existe uno para esa reserva.
 */
async function sendRemindersFor(date = addDaysISO(todayISO(), 1), { createdBy = null } = {}) {
  const rows = db
    .prepare(
      `SELECT a.*, sv.name AS service_name, sv.duration, st.name AS staff_name,
              u.id AS uid, u.name AS user_name, u.phone
       FROM appointments a
       JOIN services sv ON sv.id = a.service_id
       JOIN staff st ON st.id = a.staff_id
       JOIN users u ON u.id = a.user_id
       WHERE a.date = ? AND a.status IN ('pending','confirmed')
       ORDER BY a.time ASC`
    )
    .all(date);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const appt of rows) {
    const existing = db
      .prepare("SELECT id FROM messages WHERE appointment_id = ? AND kind = 'reminder'")
      .get(appt.id);
    if (existing) {
      skipped++;
      continue;
    }
    const firstName = String(appt.user_name).split(' ')[0];
    const dateLabel = formatLongDate(date);
    try {
      const delivered = await deliverMessage({
        userId: appt.uid,
        appointmentId: appt.id,
        kind: 'reminder',
        title: 'Recordatorio de tu reserva',
        body:
          `Hola ${firstName}, te recordamos tu ${appt.service_name.toLowerCase()} con ${appt.staff_name} ` +
          `mañana ${dateLabel} a las ${appt.time} hrs. Si no puedes asistir, avísanos por aquí.`,
        createdBy,
      });
      if (delivered.whatsapp?.ok) sent++;
      else failed++;
    } catch (err) {
      console.error('Recordatorio fallido:', err.message);
      failed++;
    }
  }

  return { date, total: rows.length, sent, failed, skipped };
}

/**
 * Programador opcional: si AUTO_REMINDERS=1, envía los recordatorios del día
 * siguiente cada mañana a partir de REMINDERS_HOUR (por defecto 10:00).
 */
function startReminderScheduler({ timezone = 'America/Santiago' } = {}) {
  if (String(process.env.AUTO_REMINDERS || '0') !== '1') return null;
  const hour = Number(process.env.REMINDERS_HOUR || 10);
  const key = 'last-auto-reminder';

  const run = async () => {
    try {
      const nowHour = Number(
        new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date())
      );
      if (nowHour < hour) return;
      const today = todayISO();
      const last = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      if (last?.value === today) return;
      const res = await sendRemindersFor(addDaysISO(today, 1));
      db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).run(key, today);
      if (res.total) console.log(`  ✉  Recordatorios automáticos: ${res.sent} enviados, ${res.skipped} ya existían.`);
    } catch (err) {
      console.error('Programador de recordatorios:', err.message);
    }
  };

  setTimeout(run, 45 * 1000);
  return setInterval(run, 30 * 60 * 1000);
}

module.exports = { sendRemindersFor, startReminderScheduler };
