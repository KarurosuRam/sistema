'use strict';

/**
 * Configuración de pagos editable desde el panel.
 *
 * El dueño del sitio puede pegar aquí sus credenciales sin tocar el servidor:
 * se guardan en la tabla `settings` de la base y se aplican al instante. Los
 * secretos se cifran con AES-256-GCM usando una clave local que se crea sola
 * en `${DATA_DIR}/.settings-key` (permisos 600).
 *
 * Reglas de precedencia:
 *   1. Lo que define el entorno (Docker, systemd, `.env`) siempre gana.
 *   2. Si la variable no existe, se usa el valor guardado desde el panel.
 * Así una instalación automatizada no puede quedar pisada por un valor viejo
 * en la base, y una instalación sin acceso al servidor puede configurarse
 * igual desde el navegador.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { run, get, all } = require('./db');

const KEY_FILE = path.join(config.dataDir, '.settings-key');

const SECRET_KEYS = new Set([
  'mp.accessToken',
  'mp.webhookSecret',
  'flow.apiKey',
  'flow.secretKey',
  'mail.pass'
]);

const VALID_MODES = new Set(['auto', 'mercadopago', 'flow', 'demo']);

/* ------------------------------------------------------------- cifrado */

let cachedKey = null;

function encryptionKey() {
  if (cachedKey) return cachedKey;
  try {
    const stored = fs.readFileSync(KEY_FILE, 'utf8').trim();
    const buffer = Buffer.from(stored, 'base64');
    if (buffer.length === 32) {
      cachedKey = buffer;
      return cachedKey;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[config] No pudimos leer ${KEY_FILE}: ${error.message}`);
    }
  }
  const buffer = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, buffer.toString('base64'), { mode: 0o600 });
  try {
    fs.chmodSync(KEY_FILE, 0o600);
  } catch (_) {
    /* sistemas de archivos sin permisos POSIX */
  }
  cachedKey = buffer;
  return cachedKey;
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${data.toString('base64url')}`;
}

function decrypt(value) {
  const text = String(value || '');
  if (!text.startsWith('v1:')) return text; // valor antiguo sin cifrar
  const [, ivPart, tagPart, dataPart] = text.split(':');
  if (!ivPart || !tagPart || !dataPart) return '';
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivPart, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch (error) {
    console.warn(`[config] Un secreto guardado no se pudo descifrar: ${error.message}`);
    return '';
  }
}

/* ------------------------------------------------------------ almacén */

function readValue(name) {
  const row = get('SELECT value FROM settings WHERE key = ?', name);
  if (!row) return null;
  return SECRET_KEYS.has(name) ? decrypt(row.value) : String(row.value);
}

function writeValue(name, value) {
  const stored = SECRET_KEYS.has(name) ? encrypt(value) : String(value);
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    name,
    stored,
    new Date().toISOString()
  );
}

function removeValue(name) {
  run('DELETE FROM settings WHERE key = ?', name);
}

/** Valor efectivo: el entorno manda; si no, lo guardado en el panel. */
function effective(name, envName) {
  if (envName && process.env[envName] !== undefined && String(process.env[envName]).trim() !== '') {
    return { value: String(process.env[envName]).trim(), source: 'env' };
  }
  const stored = readValue(name);
  if (stored) return { value: stored, source: 'panel' };
  return { value: '', source: null };
}

/* ------------------------------------------------------------ aplicar */

/**
 * Copia a `config` los valores efectivos (entorno primero, panel después).
 * Se llama al arrancar y después de cada cambio desde el panel.
 */
function apply() {
  const mp = config.mercadopago;
  const flow = config.flow;

  mp.accessToken = effective('mp.accessToken', 'MP_ACCESS_TOKEN').value;
  mp.webhookSecret = effective('mp.webhookSecret', 'MP_WEBHOOK_SECRET').value;
  mp.env =
    effective('mp.env', 'MP_ENV').value === 'production' ? 'production' : 'sandbox';

  flow.apiKey = effective('flow.apiKey', 'FLOW_API_KEY').value;
  flow.secretKey = effective('flow.secretKey', 'FLOW_SECRET_KEY').value;
  flow.env =
    effective('flow.env', 'FLOW_ENV').value === 'production' ? 'production' : 'sandbox';

  const mode = effective('payments.mode', 'PAYMENTS_MODE').value;
  config.setModeOverride(VALID_MODES.has(mode) && mode !== 'auto' ? mode : null);

  // Correo: mismas reglas (entorno primero, panel después).
  const mail = config.mail;
  mail.host = effective('mail.host', 'MAIL_HOST').value;
  mail.port = Number(effective('mail.port', 'MAIL_PORT').value) || 587;
  const secure = effective('mail.secure', 'MAIL_SECURE').value;
  mail.secure = ['true', '1', 'yes'].includes(String(secure).toLowerCase()) || mail.port === 465;
  mail.user = effective('mail.user', 'MAIL_USER').value;
  mail.pass = effective('mail.pass', 'MAIL_PASS').value;
  mail.from =
    effective('mail.from', 'MAIL_FROM').value || 'Jardín Memorial <no-responder@jardinmemorial.cl>';
  mail.transport = effective('mail.transport', 'MAIL_TRANSPORT').value.toLowerCase();
  config.refreshMail();

  // El transporte SMTP se arma con la configuración vigente: si cambió, se
  // descarta el anterior para que las credenciales nuevas se usen de inmediato.
  try {
    require('./mailer').resetTransport();
  } catch (_) {
    /* el correo es opcional */
  }

  config.refreshPayments();
  return config.paymentProvider;
}

/* ------------------------------------------------------------- resumen */

/**
 * Datos para la página de administración. Nunca incluye un secreto completo:
 * sólo si existe, de dónde viene y una pista para reconocerlo.
 */
function summary() {
  function describe(name, envName) {
    const { value, source } = effective(name, envName);
    return { set: Boolean(value), source, hint: value ? mask(value) : '' };
  }
  const mode = effective('payments.mode', 'PAYMENTS_MODE');
  return {
    mode: VALID_MODES.has(mode.value) ? mode.value : 'auto',
    modeSource: mode.source,
    mp: {
      token: describe('mp.accessToken', 'MP_ACCESS_TOKEN'),
      webhookSecret: describe('mp.webhookSecret', 'MP_WEBHOOK_SECRET'),
      env: effective('mp.env', 'MP_ENV')
    },
    flow: {
      apiKey: describe('flow.apiKey', 'FLOW_API_KEY'),
      secretKey: describe('flow.secretKey', 'FLOW_SECRET_KEY'),
      env: effective('flow.env', 'FLOW_ENV')
    },
    mail: {
      host: effective('mail.host', 'MAIL_HOST'),
      port: effective('mail.port', 'MAIL_PORT'),
      secure: effective('mail.secure', 'MAIL_SECURE'),
      user: effective('mail.user', 'MAIL_USER'),
      pass: describe('mail.pass', 'MAIL_PASS'),
      from: effective('mail.from', 'MAIL_FROM'),
      transport: effective('mail.transport', 'MAIL_TRANSPORT')
    },
    keyFile: KEY_FILE
  };
}

function mask(value) {
  const text = String(value || '');
  if (text.length <= 10) return `${text.slice(0, 1)}••••`;
  return `${text.slice(0, 6)}••••${text.slice(-4)}`;
}

/* -------------------------------------------------------------- guardar */

/**
 * Guarda lo que llega del formulario. Un campo secreto vacío conserva el valor
 * anterior (así «guardar» no borra una credencial por accidente). Un campo
 * definido en el entorno se ignora y se informa.
 */
function save(input = {}) {
  const ignored = [];
  const changes = [];

  if (input.mode && VALID_MODES.has(input.mode)) {
    const mode = effective('payments.mode', 'PAYMENTS_MODE');
    if (mode.source === 'env') ignored.push('PAYMENTS_MODE');
    else {
      if (input.mode === 'auto') removeValue('payments.mode');
      else writeValue('payments.mode', input.mode);
      changes.push('modo de pago');
    }
  }

  const mpEnv = effective('mp.env', 'MP_ENV');
  if (input.mpEnv === 'sandbox' || input.mpEnv === 'production') {
    if (mpEnv.source === 'env') ignored.push('MP_ENV');
    else if (input.mpEnv !== mpEnv.value) {
      writeValue('mp.env', input.mpEnv);
      changes.push('ambiente de Mercado Pago');
    }
  }

  if (String(input.mpToken || '').trim()) {
    if (effective('mp.accessToken', 'MP_ACCESS_TOKEN').source === 'env') ignored.push('MP_ACCESS_TOKEN');
    else {
      writeValue('mp.accessToken', String(input.mpToken).trim());
      changes.push('Access Token de Mercado Pago');
    }
  }

  if (String(input.mpWebhookSecret || '').trim()) {
    if (effective('mp.webhookSecret', 'MP_WEBHOOK_SECRET').source === 'env') ignored.push('MP_WEBHOOK_SECRET');
    else {
      writeValue('mp.webhookSecret', String(input.mpWebhookSecret).trim());
      changes.push('secreto del webhook');
    }
  }

  const flowEnv = effective('flow.env', 'FLOW_ENV');
  if (input.flowEnv === 'sandbox' || input.flowEnv === 'production') {
    if (flowEnv.source === 'env') ignored.push('FLOW_ENV');
    else if (input.flowEnv !== flowEnv.value) {
      writeValue('flow.env', input.flowEnv);
      changes.push('ambiente de Flow');
    }
  }

  if (String(input.flowApiKey || '').trim()) {
    if (effective('flow.apiKey', 'FLOW_API_KEY').source === 'env') ignored.push('FLOW_API_KEY');
    else {
      writeValue('flow.apiKey', String(input.flowApiKey).trim());
      changes.push('API Key de Flow');
    }
  }

  if (String(input.flowSecretKey || '').trim()) {
    if (effective('flow.secretKey', 'FLOW_SECRET_KEY').source === 'env') ignored.push('FLOW_SECRET_KEY');
    else {
      writeValue('flow.secretKey', String(input.flowSecretKey).trim());
      changes.push('Secret Key de Flow');
    }
  }

  const provider = saveMail(input, changes, ignored);
  return { provider, changes, ignored };
}

/**
 * Guarda la configuración SMTP del panel. Un campo vacío no borra lo anterior
 * (igual que con las credenciales de pago): para quitar algo hay que usar el
 * botón de borrar, que existe aparte.
 */
function saveMail(input, changes, ignored) {
  const campos = [
    ['mailHost', 'mail.host', 'MAIL_HOST', 'servidor SMTP'],
    ['mailPort', 'mail.port', 'MAIL_PORT', 'puerto SMTP'],
    ['mailUser', 'mail.user', 'MAIL_USER', 'usuario SMTP'],
    ['mailFrom', 'mail.from', 'MAIL_FROM', 'remitente del correo']
  ];

  for (const [field, name, envName, label] of campos) {
    const value = String(input[field] || '').trim();
    if (!value) continue;
    if (effective(name, envName).source === 'env') {
      ignored.push(envName);
      continue;
    }
    if (value !== effective(name, envName).value) {
      writeValue(name, value);
      changes.push(label);
    }
  }

  if (input.mailSecure !== undefined) {
    const value = input.mailSecure === 'on' || input.mailSecure === 'true' ? 'true' : 'false';
    if (effective('mail.secure', 'MAIL_SECURE').source === 'env') ignored.push('MAIL_SECURE');
    else if (value !== effective('mail.secure', 'MAIL_SECURE').value) {
      writeValue('mail.secure', value);
      changes.push('conexión segura');
    }
  }

  if (String(input.mailPass || '').trim()) {
    if (effective('mail.pass', 'MAIL_PASS').source === 'env') ignored.push('MAIL_PASS');
    else {
      writeValue('mail.pass', String(input.mailPass).trim());
      changes.push('contraseña SMTP');
    }
  }

  return apply();
}

/** Borra las credenciales guardadas; las del entorno no se tocan. */
function clear(provider) {
  const names = [];
  if (provider === 'mercadopago' || provider === 'all') {
    names.push('mp.accessToken', 'mp.webhookSecret', 'mp.env');
  }
  if (provider === 'flow' || provider === 'all') {
    names.push('flow.apiKey', 'flow.secretKey', 'flow.env');
  }
  const removed = [];
  for (const name of names) {
    if (readValue(name)) {
      removeValue(name);
      removed.push(name);
    }
  }
  return { removed, provider: apply() };
}

module.exports = {
  apply,
  save,
  clear,
  summary,
  VALID_MODES,
  KEY_FILE
};
