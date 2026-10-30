'use strict';

/**
 * Cliente de Mercado Pago (Checkout Pro).
 *
 * Solo se usan dos llamadas a la API, ambas autenticadas con el Access Token
 * del comercio:
 *
 *   POST /checkout/preferences    crea la preferencia y devuelve init_point
 *   GET  /v1/payments/{id}        estado real del pago
 *   GET  /v1/payments/search      búsqueda por external_reference
 *
 * El comprador paga en el sitio de Mercado Pago: la app nunca ve ni almacena
 * datos de tarjeta. Los cupos se acreditan únicamente con el estado que
 * devuelve la API (`approved`), nunca por lo que diga la URL de vuelta o el
 * cuerpo de una notificación.
 */

const crypto = require('crypto');

const config = require('./config');

const TIMEOUT_MS = 15000;

class MercadoPagoError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message);
    this.name = 'MercadoPagoError';
    this.status = status;
    this.body = body;
  }
}

function isConfigured() {
  return Boolean(config.mercadopago.accessToken);
}

function token() {
  return config.mercadopago.accessToken;
}

async function request(path, { method = 'GET', body = null, accessToken = null } = {}) {
  const bearer = String(accessToken || token() || '').trim();
  if (!bearer) {
    throw new MercadoPagoError(
      'Mercado Pago no está configurado. Define MP_ACCESS_TOKEN en el entorno.'
    );
  }

  const url = `${config.mercadopago.baseUrl}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch (error) {
    // Un fallo de red es distinto de un token rechazado: el mensaje tiene que
    // decir cuál de los dos es, porque la solución es distinta.
    const detail = error.name === 'TimeoutError' ? 'el servidor no respondió a tiempo' : error.message;
    throw new MercadoPagoError(
      `no pudimos conectarnos con ${new URL(url).host} (${detail}). Revisa la salida a internet del servidor`,
      { status: 0 }
    );
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = { raw: text.slice(0, 400) };
  }

  if (!response.ok) {
    const detail =
      data?.message || data?.error || data?.cause?.[0]?.description || `HTTP ${response.status}`;
    throw new MercadoPagoError(`Mercado Pago respondió: ${detail}`, {
      status: response.status,
      body: data
    });
  }

  return data;
}

/**
 * Crea la preferencia de Checkout Pro.
 *
 * @param {object} params
 * @param {{id:string,name:string,amount:number,credits:number,description:string}} params.plan
 * @param {{name:string,email:string}} params.user
 * @param {string} params.reference  referencia interna (external_reference)
 * @param {{success:string,pending:string,failure:string}} params.backUrls
 * @param {string} params.notificationUrl
 */
async function createPreference({ plan, user, reference, backUrls, notificationUrl }) {
  const [firstName, ...rest] = String(user.name || '').trim().split(/\s+/);
  const payer = { email: user.email };
  if (firstName) payer.name = firstName;
  if (rest.length) payer.surname = rest.join(' ');

  const payload = {
    items: [
      {
        id: plan.id,
        title: `Jardín Memorial · ${plan.name}`,
        description: plan.description,
        quantity: 1,
        currency_id: 'CLP',
        unit_price: Number(plan.amount)
      }
    ],
    payer,
    external_reference: reference,
    statement_descriptor: 'JARDIN MEMORIAL',
    notification_url: notificationUrl,
    back_urls: backUrls,
    auto_return: 'approved',
    binary_mode: false
  };

  return request('/checkout/preferences', { method: 'POST', body: payload });
}

/** URL pública del checkout (sandbox usa `sandbox_init_point` cuando existe). */
function preferenceUrl(preference) {
  if (!preference) return '';
  if (config.mercadopago.env === 'sandbox' && preference.sandbox_init_point) {
    return preference.sandbox_init_point;
  }
  return preference.init_point || preference.sandbox_init_point || '';
}

async function getPayment(paymentId) {
  const id = String(paymentId || '').trim();
  if (!id) throw new MercadoPagoError('Falta el identificador del pago.');
  return request(`/v1/payments/${encodeURIComponent(id)}`);
}

/**
 * Comercio dueño del Access Token. Sirve para el botón "Probar conexión" del
 * panel: confirma que el token existe, que no expiró y a qué cuenta pertenece.
 * https://www.mercadopago.cl/developers → Users / me
 */
async function getAccount(accessToken = null) {
  const account = await request('/users/me', { accessToken });
  return {
    id: account?.id || null,
    nickname: account?.nickname || '',
    email: account?.email || '',
    country: account?.country_id || '',
    site: account?.site_id || '',
    test: /^TEST-/i.test(String(accessToken || token()))
  };
}

/**
 * Devuelve un pago (total o parcial) desde la API.
 *   POST /v1/payments/{id}/refunds
 * Sin `amount` la devolución es por el monto completo.
 */
async function refundPayment(paymentId, { amount = null } = {}) {
  const id = String(paymentId || '').trim();
  if (!id) throw new MercadoPagoError('Falta el identificador del pago a devolver.');
  const body = amount ? { amount: Number(amount) } : {};
  return request(`/v1/payments/${encodeURIComponent(id)}/refunds`, { method: 'POST', body });
}

/**
 * Busca pagos por la referencia interna. Devuelve la lista de resultados
 * (puede venir vacía si el comprador abandonó el checkout).
 */
async function searchPayments(reference) {
  const query = new URLSearchParams({
    external_reference: String(reference),
    sort: 'date_created',
    criteria: 'desc',
    limit: '20'
  });
  const data = await request(`/v1/payments/search?${query.toString()}`);
  return Array.isArray(data?.results) ? data.results : [];
}

/**
 * Traduce el estado de Mercado Pago a los estados internos.
 * https://www.mercadopago.cl/developers → Payments / status
 */
function normalizeStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
      return 'pagado';
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    case 'authorized':
      return 'pendiente';
    case 'rejected':
      return 'rechazado';
    case 'cancelled':
    case 'refunded':
    case 'charged_back':
      return 'anulado';
    default:
      return 'pendiente';
  }
}

/**
 * Valida el encabezado `x-signature` de un webhook.
 *
 *   manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 *   v1       = HMAC-SHA256(manifest, secreto) en hexadecimal
 *
 * Los pares sin valor se omiten y el `data.id` alfanumérico va en minúsculas.
 * Devuelve `null` cuando no hay secreto configurado (validación opcional) y
 * `true`/`false` cuando sí se puede comprobar.
 */
function verifyWebhookSignature({ signature, requestId, dataId, secret }) {
  if (!secret) return null;
  if (!signature || !dataId) return false;

  const parts = {};
  for (const chunk of String(signature).split(',')) {
    const index = chunk.indexOf('=');
    if (index > 0) parts[chunk.slice(0, index).trim()] = chunk.slice(index + 1).trim();
  }

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const id = String(dataId).toLowerCase();
  const manifest =
    (id ? `id:${id};` : '') +
    (requestId ? `request-id:${requestId};` : '') +
    `ts:${ts};`;

  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const received = Buffer.from(v1, 'utf8');
  const computed = Buffer.from(expected, 'utf8');
  if (received.length !== computed.length) return false;
  return crypto.timingSafeEqual(received, computed);
}

module.exports = {
  MercadoPagoError,
  isConfigured,
  createPreference,
  preferenceUrl,
  getPayment,
  getAccount,
  searchPayments,
  refundPayment,
  normalizeStatus,
  verifyWebhookSignature
};
