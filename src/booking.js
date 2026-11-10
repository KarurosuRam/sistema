'use strict';

const { db } = require('./db');
const { todayISO, nowHHMM, addDaysISO, weekdayOf, toMinutes, toHHMM, formatLongDate } = require('./time');

/** Horario de atención del salón (0 = domingo). */
const HOURS = {
  0: null,
  1: null,
  2: { open: '10:00', close: '19:00' },
  3: { open: '10:00', close: '19:00' },
  4: { open: '10:00', close: '20:00' },
  5: { open: '10:00', close: '20:00' },
  6: { open: '10:00', close: '17:00' },
};

const SLOT_STEP = Number(process.env.SLOT_STEP_MINUTES || 30);
const LEAD_MINUTES = Number(process.env.BOOKING_LEAD_MINUTES || 60);
const MAX_DAYS_AHEAD = Number(process.env.BOOKING_MAX_DAYS || 60);
const BLOCKING_STATUSES = ['pending', 'confirmed', 'completed'];

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function getServices({ includeInactive = false } = {}) {
  return db
    .prepare(
      `SELECT * FROM services ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY active DESC, id`
    )
    .all()
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration: s.duration,
      price: s.price,
      active: !!s.active,
    }));
}

function getStaff({ includeInactive = false } = {}) {
  return db
    .prepare(`SELECT * FROM staff ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY active DESC, id`)
    .all()
    .map((s) => ({
      id: s.id,
      name: s.name,
      specialty: s.specialty,
      color: s.color,
      active: !!s.active,
    }));
}

function serviceById(id) {
  const s = db.prepare('SELECT * FROM services WHERE id = ?').get(Number(id));
  return s ? { ...s, active: !!s.active } : null;
}

function staffById(id) {
  const s = db.prepare('SELECT * FROM staff WHERE id = ?').get(Number(id));
  return s ? { ...s, active: !!s.active } : null;
}

function appointmentsForDay(date) {
  return db
    .prepare(
      `SELECT a.id, a.time, a.staff_id, a.status, s.duration
       FROM appointments a JOIN services s ON s.id = a.service_id
       WHERE a.date = ? AND a.status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})`
    )
    .all(date, ...BLOCKING_STATUSES);
}

function reasonForClosed(date) {
  const wd = weekdayOf(date);
  if (!HOURS[wd]) {
    return `Los ${WEEKDAY_NAMES[wd]} no atendemos. Nuestro horario es de martes a sábado.`;
  }
  if (date < todayISO()) return 'Esa fecha ya pasó.';
  if (date > addDaysISO(todayISO(), MAX_DAYS_AHEAD))
    return `Solo puedes reservar hasta ${MAX_DAYS_AHEAD} días de anticipación.`;
  return null;
}

/**
 * Disponibilidad de un día para un servicio.
 * @returns {{date:string, weekday:number, closed:boolean, reason:string|null, staff:Array}}
 */
function dayAvailability(date, serviceId, { ignoreAppointmentId = null } = {}) {
  const service = serviceById(serviceId);
  const result = {
    date,
    weekday: weekdayOf(date),
    closed: false,
    reason: null,
    service: service
      ? { id: service.id, name: service.name, duration: service.duration, price: service.price }
      : null,
    staff: [],
  };
  if (!service) {
    result.closed = true;
    result.reason = 'Servicio no encontrado.';
    return result;
  }
  const reason = reasonForClosed(date);
  if (reason) {
    result.closed = true;
    result.reason = reason;
    return result;
  }

  const hours = HOURS[weekdayOf(date)];
  const now = nowHHMM();
  const isToday = date === todayISO();
  const busy = appointmentsForDay(date).filter((a) => a.id !== ignoreAppointmentId);
  const staff = getStaff().filter((s) => s.active);

  for (const member of staff) {
    const taken = busy
      .filter((a) => a.staff_id === member.id)
      .map((a) => ({ start: toMinutes(a.time), end: toMinutes(a.time) + a.duration }));
    const slots = [];
    for (let t = toMinutes(hours.open); t + service.duration <= toMinutes(hours.close); t += SLOT_STEP) {
      if (isToday && t < toMinutes(now) + LEAD_MINUTES) continue;
      const end = t + service.duration;
      const overlaps = taken.some((b) => t < b.end && end > b.start);
      if (!overlaps) slots.push(toHHMM(t));
    }
    result.staff.push({
      id: member.id,
      name: member.name,
      specialty: member.specialty,
      color: member.color,
      slots,
    });
  }
  return result;
}

/** Valida una reserva concreta. Devuelve {ok, error, conflict}. */
function validateBooking({ date, time, serviceId, staffId }) {
  const service = serviceById(serviceId);
  if (!service || !service.active) return { ok: false, error: 'El servicio seleccionado no está disponible.' };
  const member = staffById(staffId);
  if (!member || !member.active) return { ok: false, error: 'La estilista seleccionada no está disponible.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, error: 'La fecha no es válida.' };
  if (!/^\d{2}:\d{2}$/.test(String(time))) return { ok: false, error: 'La hora no es válida.' };

  const reason = reasonForClosed(date);
  if (reason) return { ok: false, error: reason };

  const hours = HOURS[weekdayOf(date)];
  const start = toMinutes(time);
  const end = start + service.duration;
  if (start < toMinutes(hours.open) || end > toMinutes(hours.close))
    return {
      ok: false,
      error: `Ese horario queda fuera de nuestra atención (${hours.open} a ${hours.close}).`,
    };
  if (date === todayISO() && start < toMinutes(nowHHMM()) + LEAD_MINUTES)
    return { ok: false, error: 'Necesitamos al menos una hora de anticipación para agendar.' };

  const conflict = db
    .prepare(
      `SELECT a.id, a.time, s.duration FROM appointments a
       JOIN services s ON s.id = a.service_id
       WHERE a.date = ? AND a.staff_id = ? AND a.status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})`
    )
    .all(date, staffId, ...BLOCKING_STATUSES)
    .find((a) => {
      const bStart = toMinutes(a.time);
      const bEnd = bStart + a.duration;
      return start < bEnd && end > bStart;
    });
  if (conflict)
    return {
      ok: false,
      error: `${member.name} ya tiene una reserva a las ${conflict.time}. Elige otro horario.`,
    };

  return { ok: true, service, staff: member };
}

module.exports = {
  HOURS,
  WEEKDAY_NAMES,
  SLOT_STEP,
  MAX_DAYS_AHEAD,
  getServices,
  getStaff,
  serviceById,
  staffById,
  dayAvailability,
  validateBooking,
  formatLongDate,
};
