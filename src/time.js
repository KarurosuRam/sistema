'use strict';

/** Utilidades de fecha/hora en la zona horaria del salón. */

const TIMEZONE = process.env.TIMEZONE || 'America/Santiago';

function partsInTz(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return out;
}

function todayISO(date = new Date()) {
  const p = partsInTz(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function nowHHMM(date = new Date()) {
  const p = partsInTz(date);
  return `${p.hour}:${p.minute}`;
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** 0=domingo … 6=sábado */
function weekdayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function formatLongDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

module.exports = { TIMEZONE, todayISO, nowHHMM, addDaysISO, weekdayOf, toMinutes, toHHMM, formatLongDate };
