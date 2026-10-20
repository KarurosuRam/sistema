'use strict';

/**
 * Sesión sin cookies para la vista previa embebida.
 *
 * Algunos navegadores bloquean todas las cookies de terceros dentro del iframe
 * de la vista previa. En ese caso el ingreso, el panel y la creación de
 * memoriales no pueden depender de `jm_session` ni de `jm_csrf`: la sesión
 * viaja como un parámetro `s` en los enlaces y formularios internos.
 *
 * El modo se activa únicamente cuando el sitio se sirve para incrustarse
 * (`EMBED_MODE`) y el navegador no envió ninguna cookie de sesión. Los enlaces
 * externos nunca reciben el parámetro y las páginas con token se marcan como
 * `no-store` y sin referente para que el token no se propague fuera del sitio.
 */

const config = require('./config');

const TOKEN_PARAM = 's';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,120}$/;
const SESSION_COOKIE = 'jm_session';
const CSRF_COOKIE = 'jm_csrf';

/** Cabecera cruda: `req.cookies` no sirve porque csrfCreate la rellena. */
function rawCookie(req, name) {
  const header = req.get('cookie') || '';
  return header.split(';').some((part) => part.trim().startsWith(`${name}=`));
}

/**
 * true cuando el navegador no devolvió ninguna cookie nuestra. Se miran las
 * dos cookies (sesión y CSRF) porque ambas se emiten con los mismos atributos:
 * si el navegador guarda una, también guardará la otra. Cuando no llega
 * ninguna, el ingreso debe entregar el token por la URL.
 */
function isCookieless(req) {
  return config.embedMode && !rawCookie(req, SESSION_COOKIE) && !rawCookie(req, CSRF_COOKIE);
}

/** Token de sesión enviado en la URL o en un campo oculto del formulario. */
function tokenFromRequest(req) {
  const candidates = [req.query?.[TOKEN_PARAM], req.body?.[TOKEN_PARAM]];
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    const token = String(value || '').trim();
    if (TOKEN_PATTERN.test(token)) return token;
  }
  return '';
}

const STATIC_PREFIXES = ['/css/', '/js/', '/img/', '/fonts/', '/audio/', '/uploads/'];

/** Quita un `s` anterior de una URL interna, conservando el resto. */
function stripToken(url) {
  if (!url || typeof url !== 'string') return url;
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  let base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  if (!new RegExp(`[?&]${TOKEN_PARAM}=`).test(base)) return url;
  base = base
    .replace(new RegExp(`([?&])${TOKEN_PARAM}=[^&]*`, 'g'), '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/g, '?');
  return base + hash;
}

/**
 * Agrega `s` a una URL interna. Se saltan los archivos estáticos para no
 * ensuciar la caché ni los registros del servidor. Si la URL ya traía un token
 * (por ejemplo, el `next` de una sesión vencida), se reemplaza por el actual.
 */
function withToken(url, token) {
  if (!url || typeof url !== 'string' || !token) return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  if (STATIC_PREFIXES.some((prefix) => url.startsWith(prefix))) return url;

  const base = stripToken(url);
  const hashIndex = base.indexOf('#');
  const hash = hashIndex >= 0 ? base.slice(hashIndex) : '';
  const path = hashIndex >= 0 ? base.slice(0, hashIndex) : base;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${TOKEN_PARAM}=${encodeURIComponent(token)}${hash}`;
}

/**
 * Reescribe el HTML ya renderizado: enlaces y acciones internas reciben `s`, y
 * cada formulario POST recibe un campo oculto equivalente. Así la sesión sigue
 * viajando aunque el navegador descarte las cookies.
 */
function propagateToken(html, token, basePath = '/') {
  const hidden = `<input type="hidden" name="${TOKEN_PARAM}" value="${token}">`;

  const withLinks = html.replace(
    /(href|action|src|data-src)="([^"]*)"/g,
    (match, attribute, url) => {
      if (url.startsWith('?')) {
        return `${attribute}="${withToken(`${basePath}${url}`, token)}"`;
      }
      if (!url.startsWith('/') || url.startsWith('//')) return match;
      return `${attribute}="${withToken(url, token)}"`;
    }
  );

  return withLinks.replace(/<form\b[^>]*>/gi, (tag) => {
    if (!/method="post"/i.test(tag)) return tag;
    return tag + hidden;
  });
}

/** Envuelve las respuestas para que el token acompañe enlaces y redirecciones. */
function install(app) {
  app.use((req, res, next) => {
    const send = res.send.bind(res);
    res.send = function sendWithToken(body) {
      if (req.sessionToken && !req.sessionEnded && typeof body === 'string' && /<!DOCTYPE html>/i.test(body)) {
        body = propagateToken(body, req.sessionToken, req.path);
      }
      return send(body);
    };

    const redirect = res.redirect.bind(res);
    res.redirect = function redirectWithToken(status, url) {
      if (typeof status !== 'number') {
        url = status;
        status = 302;
      }
      if (req.sessionToken && !req.sessionEnded && typeof url === 'string') {
        url = withToken(url, req.sessionToken);
      }
      return redirect(status, url);
    };

    next();
  });
}

module.exports = {
  TOKEN_PARAM,
  isCookieless,
  tokenFromRequest,
  stripToken,
  withToken,
  propagateToken,
  install
};
