'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..');

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
  // Demo: los pagos se simulan. Para producción se integra una pasarela
  // (Webpay Plus / Mercado Pago) y se define PAYMENTS_MODE=live.
  paymentsMode: process.env.PAYMENTS_MODE === 'live' ? 'live' : 'demo',
  sessionDays: 30,
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
