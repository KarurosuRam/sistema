'use strict';

/**
 * Servicio de pagos.
 *
 * Une la pasarela Flow con la base de datos: crea órdenes pendientes, valida
 * lo que Flow confirma y acredita los cupos una sola vez. Toda la lógica vive
 * aquí para que las rutas de retorno, la notificación servidor a servidor y el
 * botón «verificar pago» del comprobante compartan exactamente las mismas
 * comprobaciones.
 */

const config = require('./config');
const store = require('./store');
const util = require('./util');
const flow = require('./flow');

function isFlowMode() {
  return config.paymentsMode === 'flow';
}

function newReference() {
  return `JM-${Date.now().toString(36).toUpperCase()}-${util.randomCode(4)}`;
}

/** Flow exige URLs absolutas y HTTPS para notificar y devolver al comprador. */
function callbackUrls() {
  return {
    urlConfirmation: `${config.publicUrl}/pago/confirmacion`,
    urlReturn: `${config.publicUrl}/pago/retorno`
  };
}

function assertReady() {
  if (!flow.isConfigured()) {
    const error = new Error(
      'Flow no está configurado. Define FLOW_API_KEY y FLOW_SECRET_KEY en el entorno.'
    );
    error.status = 503;
    throw error;
  }
  if (!/^https:\/\//i.test(config.publicUrl)) {
    const error = new Error(
      `SITE_URL debe ser una URL HTTPS pública para que Flow pueda notificar el pago (valor actual: ${config.publicUrl}).`
    );
    error.status = 503;
    throw error;
  }
}

/**
 * Crea la orden en Flow y devuelve la URL de pago a la que hay que llevar al
 * comprador. Si Flow falla, la compra queda anulada y nunca acredita cupos.
 */
async function startFlowPayment({ user, plan }) {
  assertReady();

  const reference = newReference();
  store.createPendingPurchase({
    userId: user.id,
    plan: plan.id,
    planName: plan.name,
    amount: plan.amount,
    credits: plan.credits,
    reference,
    provider: 'flow'
  });

  try {
    const payment = await flow.createPayment({
      commerceOrder: reference,
      subject: `Jardín Memorial · ${plan.name}`,
      amount: plan.amount,
      email: user.email,
      ...callbackUrls(),
      optional: { referencia: reference, plan: plan.id, cuenta: user.id },
      timeout: 3600
    });

    if (!payment || !payment.token || !payment.url) {
      throw new flow.FlowError('Flow no devolvió la URL de pago.');
    }

    const purchase = store.attachPaymentToken(reference, {
      token: payment.token,
      providerOrder: payment.flowOrder
    });

    return { purchase, redirectUrl: flow.paymentUrl(payment.url, payment.token) };
  } catch (error) {
    store.updatePurchaseStatus(reference, 'anulado');
    throw error;
  }
}

/**
 * Consulta el estado real de una orden en Flow y sincroniza la compra.
 *
 * Comprobaciones antes de acreditar:
 *  - el token existe en nuestra base;
 *  - el `commerceOrder` que devuelve Flow es la referencia de esa compra;
 *  - el monto y la moneda coinciden con el plan vendido.
 *
 * Devuelve { purchase, status, credited, alreadyPaid, mismatch }.
 */
async function syncPayment(token) {
  const purchase = store.findPurchaseByProviderToken(token);
  if (!purchase) return { purchase: null, status: 'desconocido' };

  if (purchase.status === 'pagado') {
    return { purchase, status: 'pagado', credited: false, alreadyPaid: true };
  }

  const data = await flow.getStatus(token);
  const status = flow.normalizeStatus(data.status);

  const sameOrder = String(data.commerceOrder || '') === String(purchase.reference);
  const sameAmount = Number(data.amount) === Number(purchase.amount);
  const sameCurrency = String(data.currency || 'CLP').toUpperCase() === 'CLP';

  if (status === 'pagado' && (!sameOrder || !sameAmount || !sameCurrency)) {
    console.warn(
      `[flow] Orden ${purchase.reference} no coincide con lo informado por Flow ` +
        `(order=${data.commerceOrder}, amount=${data.amount}, currency=${data.currency}). No se acredita.`
    );
    return { purchase, status: 'invalido', mismatch: true };
  }

  if (status === 'pagado') {
    const result = store.completePendingPurchase(purchase.reference, {
      providerOrder: data.flowOrder,
      payerEmail: data.payer
    });
    return {
      purchase: result.purchase,
      status,
      credited: result.credited,
      alreadyPaid: result.alreadyPaid
    };
  }

  store.updatePurchaseStatus(purchase.reference, status, {
    providerOrder: data.flowOrder,
    payerEmail: data.payer
  });
  return { purchase: store.findPurchaseByReference(purchase.reference), status };
}

module.exports = {
  isFlowMode,
  newReference,
  callbackUrls,
  assertReady,
  startFlowPayment,
  syncPayment
};
