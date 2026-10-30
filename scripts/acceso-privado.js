'use strict';

/**
 * Puerta de acceso para una vista previa expuesta en internet.
 *
 * Se pone delante de la aplicación y exige usuario y contraseña (HTTP Basic)
 * antes de dejar pasar cualquier petición. Sirve para publicar una instancia
 * temporal de Jardín Memorial con un túnel (por ejemplo, Cloudflare Tunnel)
 * sin que quede abierta a cualquiera que encuentre la dirección.
 *
 *   GATE_PASSWORD=algo node scripts/acceso-privado.js
 *
 * Variables:
 *   PORT          puerto donde escucha esta puerta (8080)
 *   APP_PORT      puerto de la aplicación detrás (3000)
 *   GATE_USER     usuario permitido (demo)
 *   GATE_PASSWORD contraseña obligatoria; sin ella la puerta no arranca
 *
 * No sustituye a la sesión de la aplicación: es una capa extra por delante.
 * Toda la lógica de cuentas, permisos y pagos sigue viviendo en la app.
 */

const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');

const PORT = Number(process.env.PORT || 8080);
const APP_PORT = Number(process.env.APP_PORT || 3000);
const USER = process.env.GATE_USER || 'demo';
const PASSWORD = process.env.GATE_PASSWORD || '';

/** Comparación en tiempo constante (evita filtrar la clave por el tiempo). */
function sameSecret(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  return sameSecret(decoded.slice(0, separator), USER) && sameSecret(decoded.slice(separator + 1), PASSWORD);
}

const server = http.createServer((req, res) => {
  if (!isAuthorized(req)) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Jardin Memorial", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end('Esta vista previa es privada. Escribe el usuario y la contraseña para entrar.');
    return;
  }

  // La app va detrás de un túnel HTTPS: se le dice que la petición original
  // llegó cifrada para que arme enlaces absolutos (QR, certificados) correctos.
  const headers = {
    ...req.headers,
    'x-forwarded-proto': 'https',
    'x-forwarded-for': req.socket.remoteAddress || '',
    'x-forwarded-host': req.headers.host || ''
  };

  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: APP_PORT,
      method: req.method,
      path: req.url,
      headers
    },
    (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    }
  );

  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('La aplicación no está respondiendo en este momento.');
  });

  req.pipe(upstream);
});

if (!PASSWORD) {
  console.error('Falta GATE_PASSWORD: la puerta no arranca sin contraseña.');
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Acceso privado escuchando en http://127.0.0.1:${PORT} → app :${APP_PORT}`);
});
