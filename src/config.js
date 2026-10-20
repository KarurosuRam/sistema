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
    jardin: { name: 'Jardín', accent: '#8ba184' },
    amanecer: { name: 'Amanecer', accent: '#c48a63' },
    cielo: { name: 'Cielo sereno', accent: '#8ca3b4' },
    noche: { name: 'Noche serena', accent: '#9d8fb0' }
  }
};

config.uploadsDir = path.join(config.dataDir, 'uploads');
config.tmpDir = path.join(config.dataDir, 'tmp');

module.exports = config;
