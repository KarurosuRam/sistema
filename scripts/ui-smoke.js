/* Prueba de humo del frontend: renderiza cada vista en jsdom contra el servidor local. */
'use strict';

const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, password) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

async function renderRoute(hash, token) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (/fonts\.googleapis|fonts\.gstatic/.test(e.message)) return;
    errors.push('jsdomError: ' + e.message);
  });
  virtualConsole.on('error', (...args) => errors.push('console.error: ' + args.join(' ')));

  const dom = await JSDOM.fromURL(BASE + '/' + hash, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.fetch = (url, opts) => fetch(new URL(url, BASE), opts);
  window.scrollTo = () => {};
  if (token) window.localStorage.setItem('amapola.token', token);

  // re-disparar el arranque ahora que fetch/localStorage están listos
  await sleep(120);
  window.dispatchEvent(new window.Event('DOMContentLoaded'));
  await sleep(900);

  const main = window.document.querySelector('#main');
  const text = (main?.textContent || '').replace(/\s+/g, ' ').trim();
  return { window, main, text, errors };
}

(async () => {
  const results = [];
  const check = (label, ok, detail) => {
    results.push({ label, ok, detail });
    console.log(`${ok ? '✔' : '✖'} ${label}${ok ? '' : ' — ' + detail}`);
  };

  const guest = await renderRoute('#/', null);
  check('Inicio renderiza hero', guest.text.includes('Tu próximo'), guest.text.slice(0, 160));
  check('Inicio lista servicios', guest.text.includes('Corte de pelo'), guest.text.slice(0, 200));
  check('Inicio muestra equipo', guest.text.includes('Valentina'));
  check('Sin errores JS en inicio', guest.errors.length === 0, guest.errors.join(' | '));
  guest.window.close();

  const booking = await renderRoute('#/reservar', null);
  check('Reserva muestra pasos', booking.text.includes('¿Qué te vas a hacer?'), booking.text.slice(0, 200));
  check('Reserva muestra calendario deshabilitado', booking.text.includes('Primero elige a tu estilista'), booking.text.slice(0, 200));
  check('Sin errores JS en reserva', booking.errors.length === 0, booking.errors.join(' | '));
  booking.window.close();

  const clientAuth = await login('cliente@demo.cl', 'cliente123');
  const client = await renderRoute('#/mis-reservas', clientAuth.token);
  check('Mis reservas carga', client.text.includes('Mis reservas'), client.text.slice(0, 200));
  check('Mis reservas lista próximas', client.text.includes('Corte'), client.text.slice(0, 300));
  check('Sin errores JS en mis reservas', client.errors.length === 0, client.errors.join(' | '));
  client.window.close();

  const inbox = await renderRoute('#/mensajes', clientAuth.token);
  check('Bandeja carga mensajes', inbox.text.includes('Bienvenida') || inbox.text.includes('aniversario'), inbox.text.slice(0, 300));
  check('Bandeja muestra estado WhatsApp', /WhatsApp|simulada/i.test(inbox.text), inbox.text.slice(0, 300));
  check('Sin errores JS en bandeja', inbox.errors.length === 0, inbox.errors.join(' | '));
  inbox.window.close();

  const adminAuth = await login('admin@amapola.cl', 'admin123');
  const dash = await renderRoute('#/admin', adminAuth.token);
  check('Panel carga métricas', dash.text.includes('Resumen del salón'), dash.text.slice(0, 200));
  check('Panel muestra WhatsApp', /Simulador|WhatsApp/i.test(dash.text), dash.text.slice(0, 300));
  check('Sin errores JS en panel', dash.errors.length === 0, dash.errors.join(' | '));
  dash.window.close();

  const msgPage = await renderRoute('#/admin/mensajes', adminAuth.token);
  check('Compositor de mensajes', msgPage.text.includes('Nuevo mensaje'), msgPage.text.slice(0, 200));
  check('Compositor con vista previa', msgPage.text.includes('Vista previa en WhatsApp'), msgPage.text.slice(0, 300));
  check('Sin errores JS en compositor', msgPage.errors.length === 0, msgPage.errors.join(' | '));
  msgPage.window.close();

  const agenda = await renderRoute('#/admin/agenda', adminAuth.token);
  check('Agenda carga', agenda.text.includes('Agenda'), agenda.text.slice(0, 200));
  check('Sin errores JS en agenda', agenda.errors.length === 0, agenda.errors.join(' | '));
  agenda.window.close();

  const outbox = await renderRoute('#/admin/envios', adminAuth.token);
  check('Buzón WhatsApp carga', outbox.text.includes('Envíos de WhatsApp'), outbox.text.slice(0, 200));
  check('Buzón lista envíos', /simulad/i.test(outbox.text), outbox.text.slice(0, 400));
  check('Sin errores JS en buzón', outbox.errors.length === 0, outbox.errors.join(' | '));
  outbox.window.close();

  /* ------- flujo de reserva completo (clienta) ------- */
  const bookingFlow = await renderRoute('#/reservar', clientAuth.token);
  const bw = bookingFlow.window;
  await sleep(400);
  const click = (sel) => {
    const el = bw.document.querySelector(sel);
    if (!el) throw new Error('No se encontró ' + sel);
    el.click();
  };
  click('[data-service="1"]');
  await sleep(350);
  click('[data-staff="1"]');
  await sleep(350);
  const dayBtn = Array.from(bw.document.querySelectorAll('[data-date]')).find((b) => !b.disabled);
  if (!dayBtn) throw new Error('No hay días disponibles en el calendario');
  dayBtn.click();
  await sleep(700);
  const slot = bw.document.querySelector('[data-time]');
  if (!slot) throw new Error('No aparecieron horarios disponibles');
  slot.click();
  await sleep(500);
  const summaryText = bw.document.querySelector('#booking-side').textContent.replace(/\s+/g, ' ');
  check('Reserva completa el resumen', /Corte de pelo/.test(summaryText) && /hrs/.test(summaryText), summaryText.slice(0, 200));
  const confirmBtn = bw.document.querySelector('#confirm-booking');
  check('Botón de confirmación habilitado', confirmBtn && !confirmBtn.disabled, 'no está disponible');
  confirmBtn.click();
  await sleep(1400);
  const afterBook = bw.document.querySelector('#main').textContent.replace(/\s+/g, ' ');
  check('Reserva confirmada muestra éxito', afterBook.includes('¡Reserva confirmada!'), afterBook.slice(0, 200));
  check('Aviso de copia a WhatsApp', /WhatsApp/i.test(afterBook), afterBook.slice(0, 300));
  check('Sin errores JS al reservar', bookingFlow.errors.length === 0, bookingFlow.errors.join(' | '));
  bw.close();

  /* ------- envío de mensaje desde el panel ------- */
  const composer = await renderRoute('#/admin/mensajes', adminAuth.token);
  const cw = composer.window;
  await sleep(600);
  cw.document.querySelector('#msg-title').value = 'Prueba automatizada';
  cw.document.querySelector('#msg-title').dispatchEvent(new cw.Event('input'));
  cw.document.querySelector('#msg-body').value = 'Hola {nombre}, este es un mensaje de prueba con copia a WhatsApp.';
  cw.document.querySelector('#msg-body').dispatchEvent(new cw.Event('input'));
  const previewText = cw.document.querySelector('#wa-bubble-body').textContent;
  check('Vista previa refleja el texto', previewText.includes('mensaje de prueba'), previewText);
  cw.document.querySelector('#send-msg').click();
  await sleep(1200);
  const toastText = cw.document.querySelector('#toast-root').textContent.replace(/\s+/g, ' ');
  check('Envío confirma copia a WhatsApp', /copiado a WhatsApp|WhatsApp/i.test(toastText), toastText || 'sin toast');
  cw.close();

  const outboxAfter = await renderRoute('#/admin/envios', adminAuth.token);
  const outText = outboxAfter.window.document.querySelector('#main').textContent.replace(/\s+/g, ' ');
  check('El envío aparece en la bitácora', outText.includes('Prueba automatizada'), outText.slice(0, 300));
  outboxAfter.window.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificaciones OK`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
