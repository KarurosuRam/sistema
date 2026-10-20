'use strict';

const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

/**
 * En un iframe de otro origen (vista previa) las cookies SameSite=Lax no se
 * envían, así que se usa SameSite=None; Secure. Fuera de ese contexto se
 * mantiene Lax, que es la opción segura por defecto.
 */
function cookieOptions(req, extra = {}) {
  const config = require('./config');
  const host = String(req.hostname || '').toLowerCase();
  // El proxy de la vista previa no siempre declara X-Forwarded-Proto, pero el
  // navegador entra por HTTPS. Solo se asume HTTPS en los hosts declarados en
  // EMBED_ORIGINS, para no forzar cookies Secure en una red local por HTTP.
  const isEmbedHost = config.embedOrigins.some((origin) => {
    const match = /^https:\/\/(\*\.)?(.+)$/.exec(origin);
    if (!match) return false;
    const [, wildcard, domain] = match;
    return wildcard ? host === domain || host.endsWith(`.${domain}`) : host === domain;
  });
  const https = req.secure || (config.embedMode && isEmbedHost);
  const embedded = config.embedMode && https;
  return {
    sameSite: embedded ? 'none' : 'lax',
    secure: https,
    ...extra
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  try {
    const expected = Buffer.from(hash, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_) {
    return false;
  }
}

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function csrfCreate(req, res, next) {
  if (!req.cookies.jm_csrf) {
    const token = newToken();
    res.cookie('jm_csrf', token, cookieOptions(req, {
      httpOnly: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: '/'
    }));
    req.cookies.jm_csrf = token;
  }
  next();
}

/**
 * CSRF de doble envío: el token del formulario debe coincidir con la cookie.
 * En rutas multipart el middleware se aplica después de multer.
 */
function csrfProtect(req, res, next) {
  if (req.method !== 'POST') return next();
  const cookieToken = req.cookies?.jm_csrf;
  const submitted = req.body?._csrf || req.get('x-csrf-token');
  if (cookieToken && submitted && constantTimeEqual(String(cookieToken), String(submitted))) {
    return next();
  }
  const error = new Error('La sesión del formulario expiró. Recarga la página e inténtalo otra vez.');
  error.status = 403;
  error.csrf = true;
  return next(error);
}

function createRateLimiter({ windowMs, max, message, keyPrefix = '' }) {
  const hits = new Map();
  const keyFor = (req) => `${keyPrefix}:${req.ip}`;
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = keyFor(req);
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      if (hits.size > 5000) {
        for (const [k, v] of hits) {
          if (now - v.start > windowMs) hits.delete(k);
        }
      }
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const remaining = Math.ceil((windowMs - (now - entry.start)) / 1000);
      res.set('Retry-After', String(remaining));
      const error = new Error(message || 'Demasiados intentos. Inténtalo nuevamente en unos minutos.');
      error.status = 429;
      return next(error);
    }
    return next();
  };
}

module.exports = {
  cookieOptions,
  hashPassword,
  verifyPassword,
  newToken,
  constantTimeEqual,
  csrfCreate,
  csrfProtect,
  createRateLimiter
};
