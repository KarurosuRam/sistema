'use strict';

/**
 * Envío de correo.
 *
 * Sirve para la recuperación de contraseña (y para cualquier aviso que se
 * agregue después). Se configura con SMTP: en el entorno (`MAIL_HOST`, …) o
 * desde el panel (`/panel/admin/correo`), que es lo normal cuando el dueño del
 * sitio no tiene acceso al servidor.
 *
 * Sin SMTP configurado la app no falla: `send()` devuelve `{ sent: false }` y
 * quien llama decide qué hacer. En la recuperación eso significa que el enlace
 * queda disponible en el panel para enviarlo a mano.
 *
 * `MAIL_TRANSPORT=json` existe solo para pruebas automatizadas: nodemailer
 * escribe el mensaje en el registro en vez de conectarse a un servidor.
 */

const config = require('./config');

let cachedTransporter = null;
let cachedKey = '';

function isConfigured() {
  return Boolean(config.mail.host && config.mail.from);
}

function transportKey() {
  const mail = config.mail;
  return [mail.host, mail.port, mail.secure, mail.user, mail.pass, mail.transport].join('|');
}

function transporter() {
  const key = transportKey();
  if (cachedTransporter && cachedKey === key) return cachedTransporter;

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (error) {
    throw new Error(
      'nodemailer no está instalado. Ejecuta `npm install` para habilitar el envío de correo.'
    );
  }

  const mail = config.mail;
  if (mail.transport === 'json') {
    cachedTransporter = nodemailer.createTransport({ jsonTransport: true });
  } else {
    cachedTransporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
      // Un servidor lento no debe dejar la petición del usuario colgada.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }
  cachedKey = key;
  return cachedTransporter;
}

function resetTransport() {
  cachedTransporter = null;
  cachedKey = '';
}

/**
 * Envía un mensaje. Nunca lanza: devuelve `{ sent, skipped, error }` para que
 * la ruta decida el mensaje que ve el usuario.
 */
async function send({ to, subject, text, html, replyTo }) {
  if (!to) return { sent: false, skipped: true, error: 'Falta el destinatario.' };
  if (!isConfigured()) {
    return { sent: false, skipped: true, error: 'El correo no está configurado.' };
  }

  try {
    const info = await transporter().sendMail({
      from: config.mail.from,
      to,
      subject,
      text,
      html,
      replyTo: replyTo || config.contactEmail
    });
    if (config.mail.transport === 'json') {
      console.log(`[correo] (prueba) mensaje para ${to}: ${subject}`);
    }
    return { sent: true, id: info.messageId || null };
  } catch (error) {
    console.warn(`[correo] No pudimos enviar a ${to}: ${error.message}`);
    return { sent: false, error: error.message };
  }
}

/** Comprueba credenciales y conexión. Es el botón «probar» del panel. */
async function verify() {
  if (!isConfigured()) {
    return { ok: false, error: 'Falta el servidor SMTP o el remitente.' };
  }
  if (config.mail.transport === 'json') {
    return { ok: true, detail: 'Transporte de prueba: los mensajes se escriben en el registro.' };
  }
  try {
    await transporter().verify();
    return { ok: true, detail: `Conexión correcta con ${config.mail.host}:${config.mail.port}.` };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Correo de recuperación de contraseña. */
async function sendPasswordReset({ user, link, minutes }) {
  const name = String(user.name || '').split(/\s+/)[0] || 'Hola';
  const sitio = config.siteName;
  const horas = Math.round((minutes / 60) * 10) / 10;

  const text = [
    `${name}, recibimos una solicitud para cambiar la contraseña de tu cuenta en ${sitio}.`,
    '',
    'Abre este enlace para elegir una nueva contraseña:',
    link,
    '',
    `El enlace sirve una sola vez y vence en ${horas} ${horas === 1 ? 'hora' : 'horas'}.`,
    'Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.',
    '',
    `— ${sitio}`
  ].join('\n');

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0a0a0a;line-height:1.6">
      <h2 style="font-family:Georgia,serif;font-weight:500;margin:0 0 12px">Cambiar tu contraseña</h2>
      <p>${escapeHtml(name)}, recibimos una solicitud para cambiar la contraseña de tu cuenta en ${escapeHtml(sitio)}.</p>
      <p style="margin:26px 0">
        <a href="${escapeHtml(link)}"
           style="background:#0e9184;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:8px;display:inline-block">
          Elegir una nueva contraseña
        </a>
      </p>
      <p style="font-size:13px;color:#333">El enlace sirve una sola vez y vence en ${horas} ${horas === 1 ? 'hora' : 'horas'}.</p>
      <p style="font-size:13px;color:#333">Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.</p>
      <p style="font-size:12px;color:#666;border-top:1px solid #f1dfce;padding-top:14px">
        Si el botón no funciona, copia este enlace en tu navegador:<br>
        <span style="word-break:break-all">${escapeHtml(link)}</span>
      </p>
    </div>
  `;

  return send({
    to: user.email,
    subject: `Cambiar tu contraseña · ${sitio}`,
    text,
    html
  });
}

module.exports = {
  isConfigured,
  send,
  verify,
  sendPasswordReset,
  resetTransport
};
