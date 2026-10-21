'use strict';

/**
 * Retorno y confirmación de Flow.
 *
 * - `POST /pago/confirmacion`: notificación servidor a servidor. Flow envía el
 *   token y espera un 200; si no lo recibe, reintenta. Cualquier error de red
 *   se responde 500 a propósito para que reintente.
 * - `GET /pago/retorno`: a donde vuelve el navegador del comprador después de
 *   pagar. Se consulta el estado real y se le lleva a su comprobante.
 *
 * Ninguna de las dos rutas usa CSRF: no hay formulario propio de por medio y
 * la autenticidad la da la firma de Flow + la consulta de estado con la
 * SecretKey del comercio.
 */

const express = require('express');

const config = require('../config');
const payments = require('../payments');
const flow = require('../flow');

const router = express.Router();

function receiptPath(purchase) {
  return `/panel/compra/${encodeURIComponent(purchase.reference)}`;
}

router.post('/pago/confirmacion', express.urlencoded({ extended: false }), async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) return res.status(200).type('text/plain').send('OK');

  try {
    const result = await payments.syncPayment(token);
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
    const result = await payments.syncPayment(token);

    if (!result.purchase) {
      req.flash('error', 'No encontramos la compra asociada a este pago. Escríbenos si el cargo aparece en tu tarjeta.');
      return res.redirect('/panel/planes');
    }

    target = receiptPath(result.purchase);

    if (result.status === 'pagado') {
      if (result.credited) {
        req.flash(
          'success',
          `Pago aprobado. Se agregaron ${result.purchase.credits} ${
            result.purchase.credits === 1 ? 'memorial' : 'memoriales'
          } a tu cuenta.`
        );
      }
    } else if (result.status === 'rechazado') {
      req.flash('error', 'Flow rechazó el pago. No se hizo ningún cargo y puedes intentarlo de nuevo.');
    } else if (result.status === 'anulado') {
      req.flash('error', 'El pago fue anulado. Puedes intentarlo otra vez cuando quieras.');
    } else if (result.status === 'invalido') {
      req.flash('error', 'El pago no coincide con la orden registrada. Escríbenos antes de volver a intentarlo.');
    } else {
      req.flash('info', 'Tu pago está pendiente de confirmación. Actualizamos el estado en cuanto Flow nos avise.');
    }
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

/** Diagnóstico para el administrador: no expone llaves. */
router.get('/pago/estado', (req, res) => {
  res.json({
    modo: config.paymentsMode,
    flow: {
      ambiente: config.flow.env,
      configurado: flow.isConfigured(),
      urlRetorno: `${config.publicUrl}/pago/retorno`,
      urlConfirmacion: `${config.publicUrl}/pago/confirmacion`
    }
  });
});

module.exports = router;
