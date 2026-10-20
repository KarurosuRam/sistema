'use strict';

const crypto = require('crypto');

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '') || 'memorial';
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 6) {
  const bytes = crypto.randomBytes(length * 2);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function certificateCode(date = new Date()) {
  return `JM-${date.getUTCFullYear()}-${randomCode(5)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parseDateOnly(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function formatDateLong(value, options = {}) {
  const parts = parseDateOnly(value);
  if (!parts) return '';
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
    ...options
  }).format(date);
}

function formatDateShort(value) {
  const parts = parseDateOnly(value);
  if (!parts) return '';
  return `${pad(parts.day)}.${pad(parts.month)}.${parts.year}`;
}

function formatDateParts(value) {
  const parts = parseDateOnly(value);
  if (!parts) return null;
  return {
    ...parts,
    long: formatDateLong(value),
    short: formatDateShort(value),
    label: `${parts.day} de ${MONTHS[parts.month - 1]} de ${parts.year}`,
    monthName: MONTHS[parts.month - 1]
  };
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santiago'
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago'
  }).format(date);
}

function timeAgo(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (abs < 60) return 'hace un momento';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(seconds / (86400 * 30)), 'month');
  return rtf.format(Math.round(seconds / (86400 * 365)), 'year');
}

function formatCLP(amount) {
  const number = Number(amount) || 0;
  return `$${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(number)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-CL').format(Number(value) || 0);
}

function yearsLabel(memorial) {
  const birth = parseDateOnly(memorial.birth_date);
  const death = parseDateOnly(memorial.death_date);
  if (birth && death) return `${birth.year} — ${death.year}`;
  if (birth) return `Desde ${birth.year}`;
  if (death) return `Hasta ${death.year}`;
  return '';
}

function lifeSpan(birthDate, deathDate) {
  const birth = parseDateOnly(birthDate);
  const death = parseDateOnly(deathDate);
  if (!birth || !death) return null;
  let years = death.year - birth.year;
  if (death.month < birth.month || (death.month === birth.month && death.day < birth.day)) years -= 1;
  if (years < 0 || years > 150) return null;
  return years;
}

function truncate(value, max = 160) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function excerptParagraphs(text, limit = 3) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function safeNextPath(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.length > 300) return null;
  return value;
}

function baseUrl(req) {
  const configured = (process.env.BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (req) {
    const proto = req.protocol || 'http';
    const host = req.get('host');
    if (host) return `${proto}://${host}`;
  }
  return 'https://www.jardinmemorial.cl';
}

function displaySiteUrl(req) {
  const url = baseUrl(req);
  return url.replace(/^https?:\/\//, '');
}

function ipHash(req) {
  const raw = req.ip || req.socket?.remoteAddress || 'desconocida';
  return crypto.createHash('sha256').update(`jardin::${raw}`).digest('hex').slice(0, 24);
}

module.exports = {
  MONTHS,
  slugify,
  randomCode,
  certificateCode,
  nowIso,
  parseDateOnly,
  formatDateLong,
  formatDateShort,
  formatDateParts,
  formatTimestamp,
  formatDateTime,
  timeAgo,
  formatCLP,
  formatNumber,
  yearsLabel,
  lifeSpan,
  truncate,
  initials,
  excerptParagraphs,
  safeNextPath,
  baseUrl,
  displaySiteUrl,
  ipHash
};
