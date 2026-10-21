'use strict';

/**
 * Servicio de pagos.
 *
 * Une las pasarelas (Mercado Pago Checkout Pro y Flow) con la base de datos:
 * crea compras pendientes, valida lo que confirma cada pasarela y acredita los
 * cupos una sola vez. Toda la lógica vive aquí para que la vuelta del
 * navegador, la notificación servidor a servidor y el botón «verificar pago»
 * del comprobante compartan exactamente las mismas comprobaciones.
 */

const config = require('./config');
const store = require('./store');
const util = require('./util');
const flow = require('./flow');
const mercadopago = require('./mercadopago');

function provider() {
  return config.paymentProvider;
}

function providerName(value = provider()) {
  if (value === 'mercadopago') return 'Mercado Pago';
  if (value === 'flow') return 'Flow';
  return 'la demostración';
}

function isDemo() {
  return provider() === 'demo';
}

function isFlowMode() {
  return provider() === 'flow';
}

function isMercadoPagoMode() {
  return provider() === 'mercadopago';
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

/** Mercado Pago: vuelta del navegador y webhook del pago. */
function mercadoPagoUrls() {
  const retorno = `${config.publicUrl}/pago/mp/retorno`;
  return {
    backUrls: { success: retorno, pending: retorno, failure: retorno },
    notificationUrl: `${config.publicUrl}/pago/mp/webhook`
  };
}

function assertReady() {
  if (isDemo()) return;

  if (provider() === 'flow' && !flow.isConfigured()) {
    const error = new Error(
      'Flow no está configurado. Define FLOW_API_KEY y FLOW_SECRET_KEY en el entorno.'
    );
    error.status = 503;
    throw error;
  }

  if (provider() === 'mercadopago' && !mercadopago.isConfigured()) {
    const error = new Error(
      'Mercado Pago no está configurado. Define MP_ACCESS_TOKEN en el entorno.'
    );
    error.status = 503;
    throw error;
  }

  if (!/^https:\/\//i.test(config.publicUrl)) {
    const error = new Error(
      `SITE_URL debe ser una URL HTTPS pública para que ${providerName()} pueda notificar el pago (valor actual: ${config.publicUrl}).`
    );
    error.status = 503;
    throw error;
  }
}

/**
 * Crea la orden en la pasarela activa y devuelve la URL a la que hay que llevar
 * al comprador. Si la pasarela falla, la compra queda anulada y nunca acredita
 * cupos.
 */
async function startPayment({ user, plan }) {
  if (provider() === 'mercadopago') return startMercadoPagoPayment({ user, plan });
  if (provider() === 'flow') return startFlowPayment({ user, plan });

  const error = new Error('No hay una pasarela de pagos configurada.');
  error.status = 503;
  throw error;
}

/** Crea la preferencia de Checkout Pro y devuelve su init_point. */
async function startMercadoPagoPayment({ user, plan }) {
  assertReady();

  const reference = newReference();
  store.createPendingPurchase({
    userId: user.id,
    plan: plan.id,
    planName: plan.name,
    amount: plan.amount,
    credits: plan.credits,
    reference,
    provider: 'mercadopago'
  });

  try {
    const preference = await mercadopago.createPreference({
      plan,
      user,
      reference,
      ...mercadoPagoUrls()
    });

    const redirectUrl = mercadopago.preferenceUrl(preference);
    if (!preference || !preference.id || !redirectUrl) {
      throw new mercadopago.MercadoPagoError(
        'Mercado Pago no devolvió la URL de pago.'
      );
    }

    const purchase = store.attachPaymentToken(reference, {
      token: preference.id,
      providerOrder: null
    });

    return { purchase, redirectUrl };
  } catch (error) {
    store.updatePurchaseStatus(reference, 'anulado');
    throw error;
  }
}

/** Crea la orden en Flow y devuelve la URL de pago. */
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
async function syncFlowPayment(token) {
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

/**
 * Aplica un pago de Mercado Pago a su compra.
 *
 * Solo acredita si el estado es `approved` y el monto/moneda coinciden con lo
 * vendido. La referencia (`external_reference`) es la que une el pago con la
 * compra; un pago de otra cuenta o de otra orden no toca cupos.
 */
function applyMercadoPagoPayment(purchase, payment) {
  if (!payment || !purchase) return { purchase, status: 'desconocido' };
  if (purchase.status === 'pagado') {
    return { purchase, status: 'pagado', credited: false, alreadyPaid: true };
  }

  const status = mercadopago.normalizeStatus(payment.status);
  const providerOrder = payment.id ? String(payment.id) : null;
  const payerEmail = payment.payer?.email || null;
  const incomingReference = String(payment.external_reference || '');

  if (incomingReference && incomingReference !== String(purchase.reference)) {
    console.warn(
      `[mp] Pago ${payment.id} con referencia ${incomingReference} no corresponde a la compra ${purchase.reference}. No se acredita.`
    );
    return { purchase, status: 'invalido', mismatch: true };
  }

  const sameAmount = Number(payment.transaction_amount) === Number(purchase.amount);
  const sameCurrency = String(payment.currency_id || 'CLP').toUpperCase() === 'CLP';

  if (status === 'pagado' && (!sameAmount || !sameCurrency)) {
    console.warn(
      `[mp] Pago ${payment.id} de la orden ${purchase.reference} no coincide ` +
        `(amount=${payment.transaction_amount}, currency=${payment.currency_id}). No se acredita.`
    );
    return { purchase, status: 'invalido', mismatch: true };
  }

  if (status === 'pagado') {
    const result = store.completePendingPurchase(purchase.reference, {
      providerOrder,
      payerEmail
    });
    return {
      purchase: result.purchase,
      status,
      credited: result.credited,
      alreadyPaid: result.alreadyPaid
    };
  }

  store.updatePurchaseStatus(purchase.reference, status, {
    providerOrder,
    payerEmail
  });
  return { purchase: store.findPurchaseByReference(purchase.reference), status };
}

/** Sincroniza una compra a partir del id de pago que entrega Mercado Pago. */
async function syncMercadoPagoPayment(paymentId) {
  let payment;
  try {
    payment = await mercadopago.getPayment(paymentId);
  } catch (error) {
    // 404 = el id no es un pago de esta cuenta (o es una orden de compra).
    if (error.status === 404) return { purchase: null, status: 'desconocido' };
    throw error;
  }

  const reference = String(payment.external_reference || '').trim();
  if (!reference) return { purchase: null, status: 'desconocido' };

  const purchase = store.findPurchaseByReference(reference);
  if (!purchase || purchase.provider !== 'mercadopago') {
    return { purchase: null, status: 'desconocido' };
  }

  return applyMercadoPagoPayment(purchase, payment);
}

/**
 * Sincroniza una compra concreta consultando la pasarela correspondiente.
 * Es la función que usan la vuelta del navegador y el botón «verificar pago».
 */
async function syncPurchase(purchase) {
  if (!purchase) return { purchase: null, status: 'desconocido' };

  if (purchase.status === 'pagado') {
    return { purchase, status: 'pagado', credited: false, alreadyPaid: true };
  }

  if (purchase.provider === 'mercadopago') {
    if (purchase.provider_order) {
      try {
        const payment = await mercadopago.getPayment(purchase.provider_order);
        if (String(payment.external_reference || '') !== String(purchase.reference)) {
          return { purchase, status: 'invalido', mismatch: true };
        }
        return applyMercadoPagoPayment(purchase, payment);
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }

    const payments = await mercadopago.searchPayments(purchase.reference);
    if (!payments.length) {
      return { purchase: store.findPurchaseByReference(purchase.reference), status: 'pendiente' };
    }
    const approved = payments.find((item) => item.status === 'approved');
    return applyMercadoPagoPayment(purchase, approved || payments[0]);
  }

  if (purchase.provider === 'flow' && purchase.provider_token) {
    return syncFlowPayment(purchase.provider_token);
  }

  return { purchase, status: 'desconocido' };
}

module.exports = {
  provider,
  providerName,
  isDemo,
  isFlowMode,
  isMercadoPagoMode,
  newReference,
  callbackUrls,
  mercadoPagoUrls,
  assertReady,
  startPayment,
  startMercadoPagoPayment,
  startFlowPayment,
  syncFlowPayment,
  // Alias histórico usado por las rutas de Flow.
  syncPayment: syncFlowPayment,
  syncMercadoPagoPayment,
  syncPurchase,
  applyMercadoPagoPayment
};
