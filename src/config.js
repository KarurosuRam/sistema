'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Carga `.env` si existe (Node 20.12+). Es lo que hace que `cp .env.example .env`
// funcione tal cual con `npm start`, sin exportar variables a mano. Las
// variables ya definidas en el entorno tienen prioridad (en Docker o systemd
// se pasan por ahí, no por el archivo).
try {
  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) {
    const { parseEnv } = require('util');
    const values = parseEnv(fs.readFileSync(envFile, 'utf8'));
    // Lo que ya viene del entorno (Docker, systemd, la shell) manda sobre el
    // archivo: así un .env viejo no pisa la configuración de producción.
    for (const [name, value] of Object.entries(values)) {
      if (process.env[name] === undefined) process.env[name] = value;
    }
  }
} catch (error) {
  console.warn(`[config] No pudimos leer .env: ${error.message}`);
}

// --- Flow (pagos reales) ----------------------------------------------------
// Sandbox por defecto: con FLOW_ENV=production se apunta al ambiente real.
// Las llaves se obtienen en https://www.flow.cl/app/web/misDatos.php (o en
// https://sandbox.flow.cl/app/web/misDatos.php para pruebas).
const flowEnv = process.env.FLOW_ENV === 'production' ? 'production' : 'sandbox';
const flow = {
  env: flowEnv,
  apiKey: String(process.env.FLOW_API_KEY || '').trim(),
  secretKey: String(process.env.FLOW_SECRET_KEY || '').trim(),
  // FLOW_API_URL / FLOW_PAY_URL existen solo para pruebas automatizadas con un
  // Flow simulado; en instalaciones reales se dejan sin definir.
  baseUrl:
    String(process.env.FLOW_API_URL || '').trim() ||
    (flowEnv === 'production' ? 'https://www.flow.cl/api' : 'https://sandbox.flow.cl/api'),
  payUrl:
    String(process.env.FLOW_PAY_URL || '').trim() ||
    (flowEnv === 'production'
      ? 'https://www.flow.cl/app/web/pay.php'
      : 'https://sandbox.flow.cl/app/web/pay.php')
};
flow.configured = Boolean(flow.apiKey && flow.secretKey);

// --- Mercado Pago (Checkout Pro) -------------------------------------------
// Access Token del comercio. Uno de prueba (empieza con TEST-) cobra en el
// ambiente de pruebas; uno de producción (APP_USR-) cobra de verdad.
//   https://www.mercadopago.cl/developers/panel/app → Credenciales
const mpEnv = process.env.MP_ENV === 'production' ? 'production' : 'sandbox';
const mercadopago = {
  env: mpEnv,
  accessToken: String(process.env.MP_ACCESS_TOKEN || '').trim(),
  webhookSecret: String(process.env.MP_WEBHOOK_SECRET || '').trim(),
  // MP_API_URL existe solo para pruebas automatizadas con un Mercado Pago
  // simulado; en instalaciones reales se deja sin definir.
  baseUrl: String(process.env.MP_API_URL || '').trim() || 'https://api.mercadopago.com'
};
mercadopago.configured = Boolean(mercadopago.accessToken);

const publicUrl = String(
  process.env.SITE_URL ||
    process.env.PUBLIC_URL ||
    process.env.BASE_URL ||
    'https://www.jardinmemorial.cl'
)
  .trim()
  .replace(/\/+$/, '');

// Pasarela activa: PAYMENTS_MODE manda; si no, se detecta por credenciales.
const requestedPaymentMode = String(process.env.PAYMENTS_MODE || '').trim().toLowerCase();

const paymentProvider = (() => {
  if (requestedPaymentMode === 'demo') return 'demo';
  if (requestedPaymentMode === 'flow') return flow.configured ? 'flow' : 'demo';
  if (['mercadopago', 'mp', 'meli'].includes(requestedPaymentMode)) {
    return mercadopago.configured ? 'mercadopago' : 'demo';
  }
  if (requestedPaymentMode && requestedPaymentMode !== 'auto') {
    console.warn(
      `[pagos] PAYMENTS_MODE="${requestedPaymentMode}" no existe; se usa la detección automática.`
    );
  }
  if (mercadopago.configured) return 'mercadopago';
  if (flow.configured) return 'flow';
  return 'demo';
})();

/**
 * Aviso para el administrador cuando se pidió una pasarela real pero faltan
 * sus credenciales. La app sigue funcionando en modo demostración; el aviso
 * se ve en el panel y en /pago/estado.
 */
const paymentWarning = (() => {
  if (requestedPaymentMode === 'mercadopago' && !mercadopago.configured) {
    return 'PAYMENTS_MODE=mercadopago pero falta MP_ACCESS_TOKEN: las compras se registran en modo demostración.';
  }
  if (requestedPaymentMode === 'flow' && !flow.configured) {
    return 'PAYMENTS_MODE=flow pero faltan FLOW_API_KEY/FLOW_SECRET_KEY: las compras se registran en modo demostración.';
  }
  return null;
})();

// --- Administración ---------------------------------------------------------
// Correos con acceso a la página de estado de pagos (/panel/admin/pagos).
// Se define con ADMIN_EMAILS separado por comas. Sin esta variable no hay
// administradores y la página responde 404: nunca se abre por accidente.
const adminEmails = String(process.env.ADMIN_EMAILS || '')
  .split(/[,;\s]+/)
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const config = {
  root: ROOT,
  port: Number(process.env.PORT) || 3000,
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  publicDir: path.join(ROOT, 'public'),
  viewsDir: path.join(ROOT, 'views'),
  siteName: 'Jardín Memorial',
  domain: 'www.jardinmemorial.cl',
  defaultSiteUrl: 'https://www.jardinmemorial.cl',
  contactEmail: 'hola@jardinmemorial.cl',
  instagram: 'https://www.instagram.com/jardinmemorial',
  whatsapp: '56900000000',
  prices: {
    single: {
      id: 'single',
      name: 'Un memorial',
      credits: 1,
      amount: 6990,
      description: 'Un memorial digital para una persona o mascota.',
      badge: null
    },
    pack4: {
      id: 'pack4',
      name: 'Pack familia',
      credits: 4,
      amount: 11990,
      description: 'Cuatro memoriales digitales para quienes quieras recordar.',
      badge: 'Más elegido'
    }
  },
  // Pagos: PAYMENTS_MODE elige la pasarela. Sin definir, se usa Mercado Pago
  // cuando hay credenciales, luego Flow, y si no hay ninguna queda la demo.
  //   mercadopago | flow | demo
  flow,
  mercadopago,
  publicUrl,
  paymentProvider,
  adminEmails,
  isAdminEmail(email) {
    return Boolean(email) && adminEmails.includes(String(email).trim().toLowerCase());
  },
  requestedPaymentMode: requestedPaymentMode || 'auto',
  paymentWarning,
  // Alias histórico: las vistas y el código anteriores comparan con
  // `paymentsMode` (demo · flow · mercadopago).
  paymentsMode: paymentProvider,
  sessionDays: 30,
  // Dominio opcional para compartir la cookie de sesión entre subdominios
  // (por ejemplo .jardinmemorial.cl cuando el sitio vive en WordPress y la
  // app en memoriales.jardinmemorial.cl). Vacío = solo el host actual.
  cookieDomain: String(process.env.COOKIE_DOMAIN || '').trim() || undefined,
  // Oculta siempre el encabezado y el pie propios (instalaciones donde el
  // encabezado del tema de WordPress ya está visible). El plugin usa
  // `?chrome=0` por página cuando se necesita lo mismo sin tocar el entorno.
  hideSiteChrome: process.env.EMBED_CHROME === '1',
  // En la vista previa (demostración) el sitio se muestra dentro de un iframe
  // en otro origen. EMBED_MODE habilita los orígenes permitidos y las cookies
  // SameSite=None que ese contexto necesita. En producción queda desactivado
  // salvo que se declare EMBED_ORIGINS explícitamente.
  embedOrigins: (() => {
    const raw = (process.env.EMBED_ORIGINS || '').trim();
    if (raw) return raw.split(/[\s,]+/).filter(Boolean);
    if (process.env.NODE_ENV === 'production') return [];
    return ['https://*.e2b.app', 'https://*.arena.ai', 'https://arena.ai'];
  })(),
  demoAccount: {
    name: 'María José Contreras',
    email: 'demo@jardinmemorial.cl',
    password: 'jardin2026'
  },
  maxPhotos: 10,
  maxImageMB: 15,
  maxAudioMB: 20,
  maxVideoMB: 120,
  maxVideoSeconds: 60,
  defaultMusic: '/audio/jardin-ambiente.mp3',
  themes: {
    jardin: { name: 'Jardín', accent: '#4fd1b8' },
    amanecer: { name: 'Amanecer', accent: '#ff8a5b' },
    cielo: { name: 'Cielo sereno', accent: '#6fc5e8' },
    noche: { name: 'Noche serena', accent: '#a99bf5' }
  }
};

config.embedMode = config.embedOrigins.length > 0;
// Acceso de prueba de un clic: solo existe mientras los pagos sean simulados.
// Se puede apagar con DEMO_ACCESS=off incluso en modo demo.
config.demoAccess = config.paymentsMode === 'demo' && process.env.DEMO_ACCESS !== 'off';
config.uploadsDir = path.join(config.dataDir, 'uploads');
config.tmpDir = path.join(config.dataDir, 'tmp');

module.exports = config;
