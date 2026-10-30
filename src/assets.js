'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const config = require('./config');

/**
 * Huella de los estilos y scripts públicos. Se añade como ?v= a cada archivo
 * para que el navegador descarte versiones antiguas en caché cuando el diseño
 * cambia, en lugar de servir una hoja vieja durante días.
 */
function fingerprint() {
  const dirs = [path.join(config.publicDir, 'css'), path.join(config.publicDir, 'js')];
  const hash = crypto.createHash('sha1');

  dirs.forEach((dir) => {
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((name) => /\.(css|js)$/.test(name)).sort();
    } catch (_) {
      return;
    }
    files.forEach((name) => {
      try {
        const stat = fs.statSync(path.join(dir, name));
        hash.update(`${name}:${stat.size}:${stat.mtimeMs}`);
      } catch (_) {
        /* archivo ilegible: se omite */
      }
    });
  });

  return hash.digest('hex').slice(0, 10);
}

const version = fingerprint();

module.exports = { version };
