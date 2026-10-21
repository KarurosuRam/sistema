'use strict';

const app = require('./src/app');
const config = require('./src/config');
const store = require('./src/store');
const { get } = require('./src/db');

store.deleteExpiredSessions();

let server = null;

async function bootstrap() {
  const users = get('SELECT COUNT(*) AS total FROM users').total;

  // El contenido de ejemplo solo se siembra solo en modo demostración. En una
  // instalación con pagos reales hay que pedirlo explícitamente (SEED_DEMO=true)
  // y, antes de abrir al público, retirarlo con `npm run purge-demo`.
  const seedRequested = process.env.SEED_DEMO === 'true';
  const seedDefault = config.paymentsMode === 'demo' && process.env.SEED_DEMO !== 'false';
  if (users === 0 && (seedRequested || seedDefault)) {
    try {
      const { seed } = require('./scripts/seed-demo');
      await seed();
    } catch (error) {
      console.error('No pudimos crear el contenido de demostración:', error);
    }
  }

  server = app.listen(config.port, '0.0.0.0', () => {
    const mode = config.paymentsMode === 'demo' ? 'demostración' : `producción · pagos Flow (${config.flow.env})`;
    console.log(`🌿 Jardín Memorial escuchando en http://0.0.0.0:${config.port} (modo ${mode})`);
    console.log(`   URL pública: ${config.publicUrl}`);
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
