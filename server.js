'use strict';

// .env opcional (sin dependencias): carga variables si el archivo existe.
const fs = require('fs');
const path = require('path');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

const express = require('express');
const { attachUser } = require('./src/auth');
const { providerStatus } = require('./src/whatsapp');
const api = require('./src/routes');
const { startReminderScheduler } = require('./src/reminders');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// Registro breve de peticiones relevantes (ayuda a diagnosticar el preview).
app.use((req, res, next) => {
  if (!/\.(jpg|jpeg|png|svg|ico|woff2?)$/i.test(req.path)) {
    const started = Date.now();
    res.on('finish', () => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.log(`${res.statusCode} ${req.method} ${req.originalUrl} · ${Date.now() - started}ms · ${ip}`);
    });
  }
  next();
});

// CORS abierto para la API (útil si se integra con la app móvil o el preview).
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api', attachUser, api);

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('✖', err.message);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos inválidos.' });
  res.status(500).json({ error: 'Ocurrió un error inesperado. Intenta nuevamente.' });
});

app.listen(PORT, '0.0.0.0', () => {
  const provider = providerStatus();
  console.log('');
  console.log('  💇  Amapola · Sistema de reservas');
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → WhatsApp: ${provider.label}${provider.live ? '' : ' (modo demostración)'}`);
  if (String(process.env.AUTO_REMINDERS || '0') === '1') console.log('  → Recordatorios automáticos: activados');
  console.log('');
});

startReminderScheduler({ timezone: process.env.TIMEZONE || 'America/Santiago' });
