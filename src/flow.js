'use strict';

/**
 * Cliente de pagos Flow (https://www.flow.cl).
 *
 * Implementa la API REST 3.x con firma HMAC-SHA256 de la SecretKey:
 * los parámetros se ordenan alfabéticamente, se concatenan como
 * `nombrevalor` y se firman con la llave secreta. El resultado viaja en `s`.
 *
 * Solo se usan dos servicios, los necesarios para una compra puntual:
 *   - payment/create     → crea la orden y devuelve url + token
 *   - payment/getStatus  → confirma el estado real de la orden
 *
 * Nada de esto se ejecuta si faltan las credenciales: `isConfigured()` lo
 * comprueba antes y el sitio sigue funcionando en modo demostración.
 */

const crypto = require('crypto');
const config = require('./config');

class FlowError extends Error {
  constructor(message, { status = 0, code = '', body = null } = {}) {
    super(message);
    this.name = 'FlowError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

function isConfigured() {
  return Boolean(config.flow.apiKey && config.flow.secretKey);
}

/** Firma de Flow: params ordenados, `key + value`, HMAC-SHA256 hexadecimal. */
function sign(params, secretKey) {
  const keys = Object.keys(params)
    .filter((key) => key !== 's' && params[key] !== undefined && params[key] !== null)
    .sort();
  const payload = keys.map((key) => `${key}${params[key]}`).join('');
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
}

function clean(params) {
  const result = {};
  Object.keys(params || {}).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') result[key] = value;
  });
  return result;
}

const REQUEST_TIMEOUT_MS = 15000;

/**
 * Llama a un servicio de Flow. `method` puede ser GET (parámetros en la URL)
 * o POST (formulario). Devuelve el JSON de respuesta o lanza FlowError.
 */
async function call(service, params, { method = 'POST' } = {}) {
  if (!isConfigured()) {
    throw new FlowError('Flow no está configurado: faltan FLOW_API_KEY y FLOW_SECRET_KEY.');
  }

  const payload = clean({ ...params, apiKey: config.flow.apiKey });
  payload.s = sign(payload, config.flow.secretKey);

  const base = config.flow.baseUrl.replace(/\/+$/, '');
  const url = `${base}${service}`;
  const options = {
    method,
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  };
  let target = url;

  if (method === 'GET') {
    target = `${url}?${new URLSearchParams(payload).toString()}`;
  } else {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = new URLSearchParams(payload).toString();
  }

  let response;
  try {
    response = await fetch(target, options);
  } catch (error) {
    throw new FlowError(`No pudimos conectar con Flow (${error.message}).`);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const detail =
      (data && (data.message || data.error || data.comment)) ||
      `Flow respondió ${response.status}.`;
    throw new FlowError(String(detail), {
      status: response.status,
      code: data && data.code ? String(data.code) : String(response.status),
      body: data
    });
  }

  if (!data) throw new FlowError('Flow devolvió una respuesta vacía.');
  return data;
}

/**
 * Crea una orden de pago. Devuelve { url, token, flowOrder }.
 * `url` + `?token=` es la página de pago a la que se redirige al comprador.
 */
async function createPayment({
  commerceOrder,
  subject,
  amount,
  email,
  urlConfirmation,
  urlReturn,
  optional,
  timeout = 3600
}) {
  return call('/payment/create', {
    commerceOrder,
    subject,
    currency: 'CLP',
    amount: Math.round(amount),
    email,
    paymentMethod: 9, // todos los medios contratados
    urlConfirmation,
    urlReturn,
    optional: optional ? JSON.stringify(optional) : undefined,
    timeout
  });
}

/** Estado real de una orden. status: 1 pendiente · 2 pagada · 3 rechazada · 4 anulada. */
async function getStatus(token) {
  if (!token) throw new FlowError('Falta el token de la orden.');
  return call('/payment/getStatus', { token }, { method: 'GET' });
}

/** URL de pago. Flow entrega una base y el token por separado. */
function paymentUrl(url, token) {
  const base = String(url || config.flow.payUrl || '').replace(/\?+$/, '');
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

/** Traduce el estado numérico de Flow a los estados internos de la compra. */
function normalizeStatus(status) {
  const value = Number(status);
  if (value === 2) return 'pagado';
  if (value === 3) return 'rechazado';
  if (value === 4) return 'anulado';
  return 'pendiente';
}

module.exports = {
  FlowError,
  isConfigured,
  sign,
  createPayment,
  getStatus,
  paymentUrl,
  normalizeStatus
};
