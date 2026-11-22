'use strict';

const app = require('./src/app');
const config = require('./src/config');
const store = require('./src/store');
const { get } = require('./src/db');

store.deleteExpiredSessions();

// Higiene de la recuperación de contraseña: los enlaces usados o vencidos hace
// más de una semana no sirven para nada y no deben quedarse en la base.
try {
  require('./src/password-reset').purgeOld();
} catch (error) {
  console.warn('[recuperar] No pudimos limpiar los enlaces vencidos:', error.message);
}

let server = null;

async function bootstrap() {
  const users = get('SELECT COUNT(*) AS total FROM users').total;

  // El contenido de ejemplo NUNCA se siembra solo: hay que pedirlo con
  // SEED_DEMO=true (desarrollo) y retirarlo con `npm run purge-demo`.
  if (users === 0 && process.env.SEED_DEMO === 'true') {
    try {
      const { seed } = require('./scripts/seed-demo');
      await seed();
    } catch (error) {
      console.error('No pudimos crear el contenido de demostración:', error);
    }
  }

  server = app.listen(config.port, '0.0.0.0', () => {
    const provider = config.paymentProvider;
    const pasarela =
      provider === 'mercadopago'
        ? `Mercado Pago (${config.mercadopago.env})`
        : provider === 'flow'
          ? `Flow (${config.flow.env})`
          : 'demostración';
    console.log(`🌿 Jardín Memorial escuchando en http://0.0.0.0:${config.port} (modo ${pasarela})`);
    console.log(`   URL pública: ${config.publicUrl}`);
    if (provider === 'demo') {
      console.log(
        '   Pagos: simulados. Define MP_ACCESS_TOKEN (Mercado Pago) o FLOW_API_KEY/FLOW_SECRET_KEY para cobrar de verdad.'
      );
    }
    if (provider === 'mercadopago') {
      console.log(`   Pagos: webhook ${config.publicUrl}/pago/mp/webhook · retorno ${config.publicUrl}/pago/mp/retorno`);
    }
    if (provider === 'flow') {
      console.log(`   Pagos: confirmación ${config.publicUrl}/pago/confirmacion · retorno ${config.publicUrl}/pago/retorno`);
    }
    if (config.paymentWarning) {
      console.warn(`   ⚠ ${config.paymentWarning}`);
    }
    if (provider === 'mercadopago' && !config.mercadopago.webhookSecret) {
      console.log(
        '   Pagos: webhook sin firma configurada (MP_WEBHOOK_SECRET). Igual se verifica cada pago contra la API.'
      );
    }
  });
}

bootstrap();

function shutdown(signal) {
  console.log(`\n${signal} recibido, cerrando Jardín Memorial…`);
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
