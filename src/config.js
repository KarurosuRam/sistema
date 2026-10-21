'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..');

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

const publicUrl = String(
  process.env.SITE_URL ||
    process.env.PUBLIC_URL ||
    process.env.BASE_URL ||
    'https://www.jardinmemorial.cl'
)
  .trim()
  .replace(/\/+$/, '');

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
  // Pagos: con llaves de Flow se cobra de verdad (PAYMENTS_MODE=flow, valor
  // por omisión cuando hay credenciales). PAYMENTS_MODE=demo fuerza el modo
  // simulado, útil para la vista previa y para las pruebas locales.
  flow,
  publicUrl,
  paymentsMode:
    String(process.env.PAYMENTS_MODE || '').toLowerCase() === 'demo'
      ? 'demo'
      : flow.configured
        ? 'flow'
        : 'demo',
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
