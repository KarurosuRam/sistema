'use strict';

/**
 * Envío de mensajes por WhatsApp.
 *
 * El sistema funciona con tres proveedores, en este orden de prioridad:
 *   1. Meta WhatsApp Cloud API  (META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID)
 *   2. Twilio WhatsApp          (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM)
 *   3. Simulador local          (sin credenciales: registra el mensaje en el
 *                                buzón de salida y en data/whatsapp-outbox.log)
 *
 * El simulador permite probar todo el flujo sin cuenta de WhatsApp Business.
 * Al configurar las credenciales en .env, los mismos mensajes salen reales
 * sin tocar una línea de código.
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./db');

const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Amapola Peluquería';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '56';
const OUTBOX_FILE = path.join(DATA_DIR, 'whatsapp-outbox.log');

function cleanPhone(raw) {
  return String(raw || '').replace(/[^\d+]/g, '');
}

/** Deja el teléfono en formato E.164 (+56987654321). */
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (String(raw).trim().startsWith('+')) return '+' + digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith(COUNTRY_CODE) && digits.length >= 10) return '+' + digits;
  // números locales chilenos: 9 dígitos comenzando en 9, o 8 dígitos fijos
  if (digits.length === 9 || digits.length === 8) return '+' + COUNTRY_CODE + digits;
  return '+' + digits;
}

function formatPhoneForDisplay(phone) {
  const p = normalizePhone(phone);
  // +56 9 8765 4321
  if (p.startsWith('+' + COUNTRY_CODE) && p.length === 12) {
    return `${p.slice(0, 3)} ${p.slice(3, 4)} ${p.slice(4, 8)} ${p.slice(8)}`;
  }
  return p;
}

function providerName() {
  if (process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID) return 'meta';
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM)
    return 'twilio';
  return 'simulator';
}

function providerLabel() {
  return { meta: 'WhatsApp Cloud API', twilio: 'Twilio WhatsApp', simulator: 'Simulador local' }[
    providerName()
  ];
}

function providerStatus() {
  const name = providerName();
  return {
    provider: name,
    label: providerLabel(),
    live: name !== 'simulator',
    countryCode: COUNTRY_CODE,
    businessName: BUSINESS_NAME,
    hint:
      name === 'simulator'
        ? 'Modo demostración: los mensajes se guardan en el buzón de salida y en data/whatsapp-outbox.log. Configura META_WHATSAPP_TOKEN o Twilio en .env para enviarlos de verdad.'
        : 'Los mensajes se envían por WhatsApp real.',
  };
}

async function sendViaMeta(to, body) {
  const url = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'text',
      text: { preview_url: false, body },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Meta API respondió ${res.status}`);
  return { externalId: data?.messages?.[0]?.id || null };
}

async function sendViaTwilio(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const params = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    Body: body,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Twilio respondió ${res.status}`);
  return { externalId: data?.sid || null };
}

/**
 * Envía (o simula) un WhatsApp.
 * @returns {Promise<{ok:boolean, provider:string, externalId:string|null, simulated:boolean, error:string|null}>}
 */
async function sendWhatsApp({ to, body }) {
  const phone = normalizePhone(to);
  if (!phone || phone.length < 8) {
    return {
      ok: false,
      provider: providerName(),
      externalId: null,
      simulated: false,
      error: 'El usuario no tiene un número de WhatsApp válido.',
    };
  }

  const name = providerName();
  try {
    if (name === 'meta') {
      const r = await sendViaMeta(phone, body);
      return { ok: true, provider: 'meta', externalId: r.externalId, simulated: false, error: null };
    }
    if (name === 'twilio') {
      const r = await sendViaTwilio(phone, body);
      return { ok: true, provider: 'twilio', externalId: r.externalId, simulated: false, error: null };
    }

    const externalId = 'sim_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const line = `[${new Date().toISOString()}] -> ${phone} (${externalId})\n${body}\n---\n`;
    fs.appendFileSync(OUTBOX_FILE, line, 'utf8');
    return { ok: true, provider: 'simulator', externalId, simulated: true, error: null };
  } catch (err) {
    return {
      ok: false,
      provider: name,
      externalId: null,
      simulated: name === 'simulator',
      error: err.message || 'Error desconocido al enviar el WhatsApp',
    };
  }
}

/** Rellena {nombre}, {servicio}, {fecha}, {hora}, {negocio}, {telefono}. */
function renderTemplate(text, vars = {}) {
  const dict = { negocio: BUSINESS_NAME, ...vars };
  return String(text).replace(/\{(\w+)\}/g, (m, key) =>
    dict[key] !== undefined && dict[key] !== null ? String(dict[key]) : m
  );
}

module.exports = {
  sendWhatsApp,
  normalizePhone,
  formatPhoneForDisplay,
  providerStatus,
  providerLabel,
  renderTemplate,
  BUSINESS_NAME,
};
