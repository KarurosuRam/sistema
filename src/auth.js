'use strict';

const crypto = require('crypto');
const config = require('./config');
const store = require('./store');
const { nowIso, safeNextPath } = require('./util');

const COOKIE = 'jm_session';

function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  store.createSession({ token, userId, expiresAt: expires.toISOString() });
  const previous = req.cookies[COOKIE];
  if (previous) store.deleteSession(previous);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    expires,
    path: '/'
  });
}

function endSession(req, res) {
  const token = req.cookies[COOKIE];
  if (token) store.deleteSession(token);
  res.clearCookie(COOKIE, { path: '/' });
}

function sessionLoader(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  const session = store.findSession(token);
  if (!session) {
    res.clearCookie(COOKIE, { path: '/' });
    return next();
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    store.deleteSession(token);
    res.clearCookie(COOKIE, { path: '/' });
    return next();
  }
  const user = store.findUserById(session.user_id);
  if (user) {
    req.user = user;
    res.locals.user = user;
  }
  return next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  const nextPath = safeNextPath(req.originalUrl) || '/panel';
  if (req.method === 'GET') {
    return res.redirect(`/ingresar?next=${encodeURIComponent(nextPath)}`);
  }
  req.flash('error', 'Tu sesión expiró. Ingresa nuevamente.');
  return res.redirect(`/ingresar?next=${encodeURIComponent(nextPath)}`);
}

function requireGuest(req, res, next) {
  if (req.user) return res.redirect('/panel');
  return next();
}

function loadMemorialOwned(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Memorial no encontrado');
    error.status = 404;
    return next(error);
  }
  const memorial = store.findMemorialById(id);
  if (!memorial) {
    const error = new Error('Memorial no encontrado');
    error.status = 404;
    return next(error);
  }
  if (memorial.user_id !== req.user.id) {
    const error = new Error('No tienes acceso a este memorial.');
    error.status = 403;
    return next(error);
  }
  req.memorial = memorial;
  res.locals.memorial = memorial;
  return next();
}

function loadPublicMemorial(req, res, next) {
  const memorial = store.findMemorialBySlug(req.params.slug);
  if (!memorial) {
    const error = new Error('Memorial no encontrado');
    error.status = 404;
    return next(error);
  }
  const isOwner = req.user && req.user.id === memorial.user_id;
  if (!memorial.is_public && !isOwner) {
    const error = new Error('Este memorial es privado.');
    error.status = 404;
    error.public = true;
    return next(error);
  }
  req.memorial = memorial;
  req.isOwner = !!isOwner;
  res.locals.memorial = memorial;
  res.locals.isOwner = !!isOwner;
  return next();
}

function flashMiddleware(req, res, next) {
  res.locals.flash = null;
  const raw = req.cookies?.jm_flash;
  if (raw) {
    try {
      res.locals.flash = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    } catch (_) {
      res.locals.flash = { type: 'info', message: decodeURIComponent(raw) };
    }
    res.clearCookie('jm_flash', { path: '/' });
  }
  req.flash = (type, message) => {
    const payload = Buffer.from(JSON.stringify({ type, message, at: nowIso() }), 'utf8').toString('base64url');
    res.cookie('jm_flash', payload, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: 120000,
      path: '/'
    });
    res.locals.flash = { type, message };
  };
  next();
}

module.exports = {
  COOKIE,
  startSession,
  endSession,
  sessionLoader,
  requireAuth,
  requireGuest,
  loadMemorialOwned,
  loadPublicMemorial,
  flashMiddleware
};
