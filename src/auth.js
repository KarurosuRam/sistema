'use strict';

const crypto = require('crypto');
const config = require('./config');
const store = require('./store');
const { nowIso, safeNextPath } = require('./util');
const { cookieOptions } = require('./security');
const { isCookieless, tokenFromRequest, stripToken, withToken } = require('./embed-session');

const COOKIE = 'jm_session';

function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  store.createSession({ token, userId, expiresAt: expires.toISOString() });
  // Al renovar la sesión se retira tanto la anterior por cookie como la que
  // pudo llegar por el enlace de la vista previa.
  const previous = [req.cookies?.[COOKIE], req.sessionToken].filter(Boolean);
  previous.forEach((old) => store.deleteSession(old));
  res.cookie(COOKIE, token, cookieOptions(req, {
    httpOnly: true,
    expires,
    path: '/'
  }));
  return token;
}

function endSession(req, res) {
  const tokens = [req.cookies?.[COOKIE], req.sessionToken].filter(Boolean);
  tokens.forEach((token) => store.deleteSession(token));
  req.sessionEnded = true;
  req.sessionToken = null;
  res.locals.sessionToken = null;
  res.clearCookie(COOKIE, cookieOptions(req, { path: '/' }));
}

/** Sesión válida o null; de paso elimina las vencidas. */
function findValidSession(token) {
  if (!token) return null;
  const session = store.findSession(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    store.deleteSession(token);
    return null;
  }
  return session;
}

function sessionLoader(req, res, next) {
  const cookieToken = req.cookies?.[COOKIE];
  let token = cookieToken;
  let session = findValidSession(cookieToken);
  let viaUrl = false;

  // En la vista previa embebida las cookies pueden estar bloqueadas por
  // completo. En ese caso la sesión llega como `?s=` o como campo oculto.
  if (!session && config.embedMode) {
    const candidate = tokenFromRequest(req);
    if (candidate) {
      session = findValidSession(candidate);
      if (session) {
        token = candidate;
        viaUrl = true;
      }
    }
  }

  if (!session) {
    if (cookieToken) res.clearCookie(COOKIE, cookieOptions(req, { path: '/' }));
    return next();
  }

  const user = store.findUserById(session.user_id);
  if (!user) {
    store.deleteSession(token);
    if (cookieToken) res.clearCookie(COOKIE, cookieOptions(req, { path: '/' }));
    return next();
  }

  req.user = user;
  res.locals.user = user;

  if (viaUrl) {
    // Una cookie vieja no debe seguir intentando imponerse sobre el token.
    if (cookieToken) res.clearCookie(COOKIE, cookieOptions(req, { path: '/' }));
    // El token no debe quedar en cachés ni viajar como referente a otros sitios.
    req.sessionToken = token;
    res.locals.sessionToken = token;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Robots-Tag', 'noindex');
  }

  return next();
}

/**
 * Redirige después de ingresar. Si el navegador no acepta cookies, el token
 * de la sesión recién creada encabeza la URL para que el panel siga abierto.
 */
function afterLogin(req, res, token, location) {
  if (isCookieless(req)) return res.redirect(withToken(location, token));
  return res.redirect(location);
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  // El token de la vista previa no debe viajar al formulario de ingreso.
  const nextPath = safeNextPath(stripToken(req.originalUrl)) || '/panel';
  if (req.method === 'GET') {
    return res.redirect(`/ingresar?next=${encodeURIComponent(nextPath)}`);
  }
  req.flash('error', 'Tu sesión expiró. Ingresa nuevamente.');
  return res.redirect(`/ingresar?next=${encodeURIComponent(nextPath)}`);
}

/**
 * Si ya hay una sesión abierta no tiene sentido volver a mostrar el ingreso:
 * se devuelve a la persona a la página principal (donde ve su cuenta activa)
 * en vez de mandarla al panel, que era lo que resultaba desconcertante.
 */
function requireGuest(req, res, next) {
  if (req.user) {
    req.flash(
      'info',
      `Ya iniciaste sesión como ${req.user.name.split(' ')[0]}. Si quieres entrar con otra cuenta, cierra sesión primero.`
    );
    return res.redirect('/');
  }
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
    res.clearCookie('jm_flash', cookieOptions(req, { path: '/' }));
  }
  req.flash = (type, message) => {
    const payload = Buffer.from(JSON.stringify({ type, message, at: nowIso() }), 'utf8').toString('base64url');
    res.cookie('jm_flash', payload, cookieOptions(req, {
      httpOnly: true,
      maxAge: 120000,
      path: '/'
    }));
    res.locals.flash = { type, message };
  };
  next();
}

module.exports = {
  COOKIE,
  startSession,
  endSession,
  sessionLoader,
  afterLogin,
  requireAuth,
  requireGuest,
  loadMemorialOwned,
  loadPublicMemorial,
  flashMiddleware
};
