'use strict';

/**
 * Vuelta del comprador y notificaciones de las pasarelas.
 *
 * Flow
 * - `POST /pago/confirmacion`: notificación servidor a servidor con `token`.
 * - `GET /pago/retorno`: vuelta del navegador con `token`.
 *
 * Mercado Pago (Checkout Pro)
 * - `POST /pago/mp/webhook`: notificación con `data.id` del pago. Se valida la
 *   firma `x-signature` cuando hay secreto configurado y siempre se consulta el
 *   pago real a la API antes de acreditar.
 * - `GET /pago/mp/retorno`: vuelta del navegador con `payment_id` y
 *   `external_reference`.
 *
 * Ninguna ruta usa CSRF: no hay formulario propio de por medio. La
 * autenticidad la da la firma de la pasarela y, sobre todo, la consulta de
 * estado con las credenciales del comercio.
 */

const express = require('express');

const config = require('../config');
const store = require('../store');
const payments = require('../payments');
const flow = require('../flow');
const mercadopago = require('../mercadopago');
const { requireAuth } = require('../auth');
const { csrfProtect } = require('../security');

const router = express.Router();

function receiptPath(purchase) {
  return `/panel/compra/${encodeURIComponent(purchase.reference)}`;
}

/** Mensajes comunes a la vuelta del navegador de cualquier pasarela. */
function flashResult(req, result, gatewayName) {
  if (!result.purchase) {
    req.flash(
      'error',
      'No encontramos la compra asociada a este pago. Escríbenos si el cargo aparece en tu tarjeta.'
    );
    return;
  }

  if (result.status === 'pagado') {
    if (result.credited) {
      req.flash(
        'success',
        `Pago aprobado. Se agregaron ${result.purchase.credits} ${
          result.purchase.credits === 1 ? 'memorial' : 'memoriales'
        } a tu cuenta.`
      );
    } else {
      req.flash('info', 'El pago ya estaba confirmado en tu cuenta.');
    }
  } else if (result.status === 'rechazado') {
    req.flash(
      'error',
      `${gatewayName} rechazó el pago. No se hizo ningún cargo y puedes intentarlo de nuevo.`
    );
  } else if (result.status === 'reembolsado') {
    req.flash('info', 'Mercado Pago devolvió el dinero de esta compra. La orden quedó como reembolsada.');
  } else if (result.status === 'anulado') {
    req.flash('error', 'El pago fue anulado. Puedes intentarlo otra vez cuando quieras.');
  } else if (result.status === 'invalido') {
    req.flash(
      'error',
      'El pago no coincide con la orden registrada. Escríbenos antes de volver a intentarlo.'
    );
  } else {
    req.flash(
      'info',
      `Tu pago está pendiente de confirmación. Actualizamos el estado en cuanto ${gatewayName} nos avise.`
    );
  }
}

/* ------------------------------------------------------------------ Flow -- */

router.post('/pago/confirmacion', express.urlencoded({ extended: false }), async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) return res.status(200).type('text/plain').send('OK');

  try {
    const result = await payments.syncFlowPayment(token);
    if (!result.purchase) {
      console.warn('[flow] Notificación con token desconocido.');
    }
    return res.status(200).type('text/plain').send('OK');
  } catch (error) {
    // 500 = Flow reintenta más tarde; no se acredita nada.
    console.error('[flow] Error al confirmar la notificación:', error.message);
    return res.status(500).type('text/plain').send('ERROR');
  }
});

router.get('/pago/confirmacion', (req, res) => {
  res.status(405).type('text/plain').send('Método no permitido');
});

router.get('/pago/retorno', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const token = String(req.query.token || '').trim();
  if (!token) {
    req.flash('error', 'No recibimos el token del pago. Si te cobraron, escríbenos con tu comprobante.');
    return res.redirect('/panel/planes');
  }

  let target = '/panel/planes';

  try {
    const result = await payments.syncFlowPayment(token);
    if (result.purchase) target = receiptPath(result.purchase);
    flashResult(req, result, 'Flow');
  } catch (error) {
    console.error('[flow] Error al volver desde Flow:', error.message);
    req.flash(
      'error',
      'No pudimos confirmar el pago con Flow en este momento. Tu compra quedó registrada como pendiente; revisa el historial en unos minutos.'
    );
  }

  // Si la sesión se perdió, el comprobante pide ingreso y luego vuelve aquí.
  return res.redirect(target);
});

/* ---------------------------------------------------------- Mercado Pago -- */

/** Identificador del pago dentro de una notificación o de la vuelta. */
function paymentIdFromRequest(req) {
  return String(
    req.body?.data?.id ||
      req.query['data.id'] ||
      req.query.payment_id ||
      req.query.collection_id ||
      req.query.id ||
      ''
  ).trim();
}

/**
 * Webhook de Mercado Pago. Responde 200 en cuanto el pago queda procesado y
 * 500 solo si conviene que la pasarela reintente.
 */
router.post('/pago/mp/webhook', async (req, res) => {
  const type = String(req.body?.type || req.query.type || req.query.topic || '').trim();
  const paymentId = paymentIdFromRequest(req);

  // La firma solo se exige cuando el comercio la configuró en el panel.
  const signatureOk = mercadopago.verifyWebhookSignature({
    signature: req.get('x-signature'),
    requestId: req.get('x-request-id'),
    dataId: paymentId,
    secret: config.mercadopago.webhookSecret
  });
  if (signatureOk === false) {
    console.warn('[mp] Webhook con firma inválida; se ignora.');
    return res.status(401).type('text/plain').send('Firma inválida');
  }

  // merchant_order y otros eventos no acreditan nada: se confirman y se ignoran.
  if (type !== 'payment' || !paymentId) {
    return res.status(200).type('text/plain').send('OK');
  }

  try {
    const result = await payments.syncMercadoPagoPayment(paymentId);
    if (!result.purchase) {
      console.warn(`[mp] Pago ${paymentId} sin compra asociada (referencia desconocida).`);
    }
    return res.status(200).type('text/plain').send('OK');
  } catch (error) {
    console.error('[mp] Error al procesar la notificación:', error.message);
    return res.status(500).type('text/plain').send('ERROR');
  }
});

router.get('/pago/mp/webhook', (req, res) => {
  res.status(405).type('text/plain').send('Método no permitido');
});

/** Vuelta del navegador después de pagar en Mercado Pago. */
router.get('/pago/mp/retorno', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const paymentId = paymentIdFromRequest(req);
  const reference = String(req.query.external_reference || '').trim();

  let target = '/panel/planes';

  try {
    let result = { purchase: null, status: 'desconocido' };

    if (paymentId) {
      result = await payments.syncMercadoPagoPayment(paymentId);
    }

    // Si el pago aún no aparece (por ejemplo, la pasarela devuelve solo la
    // referencia), se sincroniza la compra por su referencia interna.
    if (!result.purchase && reference) {
      const purchase = store.findPurchaseByReference(reference);
      if (purchase) result = await payments.syncPurchase(purchase);
    }

    if (result.purchase) target = receiptPath(result.purchase);
    flashResult(req, result, 'Mercado Pago');
  } catch (error) {
    console.error('[mp] Error al volver desde Mercado Pago:', error.message);
    req.flash(
      'error',
      'No pudimos confirmar el pago con Mercado Pago en este momento. Tu compra quedó registrada como pendiente; revisa el historial en unos minutos.'
    );
  }

  return res.redirect(target);
});

/* ------------------------------------------------------------ diagnóstico -- */

/** Estado de la configuración de pagos. No expone llaves ni tokens. */
/* ---------------------------------------------------------- pago de prueba */

/**
 * Pasarela simulada del modo demostración. Existe para que el recorrido de
 * compra se pueda ver completo dentro de la vista previa: la compra queda
 * pendiente, se "paga" aquí y recién entonces se acredita. No pide ni guarda
 * datos de tarjeta y no se comunica con ninguna pasarela.
 */
function demoPurchase(req, res) {
  const purchase = store.findPurchaseByReference(String(req.params.reference));
  if (!purchase || purchase.user_id !== req.user.id) return null;
  if (purchase.mode !== 'demo') return null;
  return purchase;
}

router.get('/pago/demo/:reference', requireAuth, (req, res, next) => {
  const purchase = demoPurchase(req, res);
  if (!purchase) return next();
  if (purchase.status !== 'pendiente') return res.redirect(receiptPath(purchase));

  res.set('Cache-Control', 'no-store');
  return res.render('pago/demo', {
    pageTitle: 'Pago de prueba',
    metaDescription: 'Simulación del pago de un plan de Jardín Memorial.',
    bodyClass: 'page-panel page-demo-pay',
    purchase,
    plan: config.prices[purchase.plan] || null,
    gateway: payments.providerName()
  });
});

router.post('/pago/demo/:reference/aprobar', requireAuth, csrfProtect, (req, res, next) => {
  const purchase = demoPurchase(req, res);
  if (!purchase) return next();

  const result = store.completePendingPurchase(purchase.reference);
  if (!result || !result.purchase) return next();

  if (result.credited) {
    req.flash(
      'success',
      `Pago de prueba aprobado. Se agregaron ${result.purchase.credits} ${
        result.purchase.credits === 1 ? 'memorial' : 'memoriales'
      } a tu cuenta.`
    );
  } else {
    req.flash('info', 'Ese pago de prueba ya estaba aprobado.');
  }
  return res.redirect(receiptPath(result.purchase));
});

router.post('/pago/demo/:reference/cancelar', requireAuth, csrfProtect, (req, res, next) => {
  const purchase = demoPurchase(req, res);
  if (!purchase) return next();

  store.updatePurchaseStatus(purchase.reference, 'anulado');
  req.flash('info', 'Pago de prueba cancelado. No se agregaron memoriales.');
  return res.redirect('/panel/planes');
});

router.get('/pago/estado', (req, res) => {
  const activa = config.paymentProvider;
  res.json({
    modo: activa,
    pasarela: activa === 'demo' ? 'Demostración' : payments.providerName(activa),
    cobrosReales: activa !== 'demo',
    solicitado: config.requestedPaymentMode,
    aviso: config.paymentWarning,
    mercadopago: {
      ambiente: config.mercadopago.env,
      configurado: mercadopago.isConfigured(),
      firmaWebhook: Boolean(config.mercadopago.webhookSecret),
      urlRetorno: `${config.publicUrl}/pago/mp/retorno`,
      urlWebhook: `${config.publicUrl}/pago/mp/webhook`
    },
    flow: {
      ambiente: config.flow.env,
      configurado: flow.isConfigured(),
      urlRetorno: `${config.publicUrl}/pago/retorno`,
      urlConfirmacion: `${config.publicUrl}/pago/confirmacion`
    }
  });
});

module.exports = router;
