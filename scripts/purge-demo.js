'use strict';

/**
 * Retira el contenido de demostración antes de abrir el sitio al público.
 *
 * Borra la cuenta demo, sus memoriales (con fotos, video y música), las velas y
 * firmas asociadas y las compras simuladas de esa cuenta. No toca cuentas
 * reales.
 *
 *   npm run purge-demo
 *
 * En producción conviene ejecutarlo con la app detenida o en una ventana de
 * mantenimiento, y hacer antes una copia de `data/`.
 */

const config = require('../src/config');
const store = require('../src/store');
const media = require('../src/media');

function removeMemorialFiles(memorial) {
  store.listPhotos(memorial.id).forEach((photo) => {
    media.deleteUpload(photo.filename);
    media.deleteUpload(photo.thumb);
  });
  if (memorial.video_path) media.deleteUpload(memorial.video_path);
  if (memorial.music_path) media.deleteUpload(memorial.music_path);
}

function purgeDemo() {
  const user = store.findUserByEmail(config.demoAccount.email);
  if (!user) {
    console.log('No hay cuenta de demostración en esta instalación. Nada que retirar.');
    return { memorials: 0, user: false };
  }

  const memorials = store.listMemorialsByUser(user.id);
  memorials.forEach((memorial) => {
    removeMemorialFiles(memorial);
    store.deleteMemorial(memorial.id);
  });

  // Las compras simuladas de la demo no deben quedar en el historial público
  // de la instalación; sus cupos tampoco.
  const { run } = require('../src/db');
  run('DELETE FROM purchases WHERE user_id = ?', user.id);
  run('DELETE FROM sessions WHERE user_id = ?', user.id);
  run('DELETE FROM users WHERE id = ?', user.id);

  console.log(`✅ Cuenta demo retirada: ${config.demoAccount.email}`);
  console.log(`   Memoriales eliminados: ${memorials.length}`);
  console.log('   Revisa `data/uploads` si quieres borrar archivos huérfanos de otros orígenes.');
  return { memorials: memorials.length, user: true };
}

if (require.main === module) {
  purgeDemo();
}

module.exports = { purgeDemo };
