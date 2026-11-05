'use strict';

/**
 * Exporta esta instalación a un ZIP que se importa desde el plugin de WordPress.
 *
 * Uso:
 *   npm run export-wordpress                 # deja el ZIP en dist/
 *   npm run export-wordpress -- --sin-medios # solo datos, sin fotos ni videos
 *   npm run export-wordpress -- --salida /ruta
 *
 * El ZIP contiene `datos.json` y la carpeta `uploads/`. En WordPress se sube
 * desde «Jardín Memorial → Migración» y el plugin crea las cuentas, los
 * memoriales y los adjuntos.
 *
 * No se exportan contraseñas: WordPress usa otro algoritmo. Cada cuenta se
 * crea con una clave aleatoria y el titular la reemplaza con «Recuperar
 * contraseña».
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const config = require('../src/config');
const { dbPath } = require('../src/db');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
}

const sinMedios = process.argv.includes('--sin-medios');
const outDir = path.resolve(arg('--salida', path.join(__dirname, '..', 'dist')));

/* --------------------------------------------------------------- sqlite */

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (error) {
  console.error('Necesitas Node 22.5 o más nuevo para exportar la base.');
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`No encontramos la base en ${dbPath}. Arranca la app una vez para crearla.`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const all = (sql, ...params) => db.prepare(sql).all(...params);

/* ------------------------------------------------------------------ zip */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function dosDate(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

/**
 * ZIP mínimo (deflate o store), sin dependencias: el mismo archivo funciona en
 * el hosting compartido aunque no haya `zip` instalado.
 */
class Zip {
  constructor() {
    this.parts = [];
    this.entries = [];
    this.offset = 0;
  }

  add(name, data, { store = false } = {}) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const nameBuffer = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const method = store ? 0 : 8;
    const body = store ? buffer : zlib.deflateRawSync(buffer, { level: 6 });
    const checksum = crc32(buffer);
    const { time, date } = dosDate(new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(buffer.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    this.parts.push(local, nameBuffer, body);
    this.entries.push({
      name: nameBuffer,
      method,
      time,
      date,
      checksum,
      compressed: body.length,
      size: buffer.length,
      offset: this.offset
    });
    this.offset += local.length + nameBuffer.length + body.length;
  }

  finish() {
    const central = [];
    let centralSize = 0;

    this.entries.forEach((entry) => {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(20, 6);
      header.writeUInt16LE(0x0800, 8);
      header.writeUInt16LE(entry.method, 10);
      header.writeUInt16LE(entry.time, 12);
      header.writeUInt16LE(entry.date, 14);
      header.writeUInt32LE(entry.checksum, 16);
      header.writeUInt32LE(entry.compressed, 20);
      header.writeUInt32LE(entry.size, 24);
      header.writeUInt16LE(entry.name.length, 28);
      header.writeUInt16LE(0, 30);
      header.writeUInt16LE(0, 32);
      header.writeUInt16LE(0, 34);
      header.writeUInt16LE(0, 36);
      header.writeUInt32LE(0o644 << 16, 38);
      header.writeUInt32LE(entry.offset, 42);
      central.push(header, entry.name);
      centralSize += header.length + entry.name.length;
    });

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(this.offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...this.parts, ...central, end]);
  }
}

/* --------------------------------------------------------------- datos */

/**
 * MySQL guarda DATETIME como «YYYY-MM-DD HH:MM:SS»; la app usa ISO 8601.
 * Si dejáramos la «T» y la «Z», el importador fallaría en modo estricto.
 */
function fecha(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19).replace('T', ' ');
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

const users = all('SELECT id, name, email, credits FROM users ORDER BY id');
const memorialRows = all('SELECT * FROM memorials ORDER BY id');
const photoRows = all('SELECT * FROM photos ORDER BY memorial_id, position, id');
const guestbookRows = all('SELECT * FROM guestbook ORDER BY memorial_id, id');
const candleRows = all('SELECT * FROM candles ORDER BY memorial_id, id');
const purchaseRows = all('SELECT * FROM purchases ORDER BY id');

const photoByMemorial = new Map();
photoRows.forEach((photo) => {
  if (!photoByMemorial.has(photo.memorial_id)) photoByMemorial.set(photo.memorial_id, []);
  photoByMemorial.get(photo.memorial_id).push({ filename: photo.filename, caption: photo.caption || '' });
});

const guestbookByMemorial = new Map();
guestbookRows.forEach((entry) => {
  if (!guestbookByMemorial.has(entry.memorial_id)) guestbookByMemorial.set(entry.memorial_id, []);
  guestbookByMemorial.get(entry.memorial_id).push({
    name: entry.name,
    city: entry.city || '',
    message: entry.message,
    candle: entry.candle ? 1 : 0,
    hidden: entry.hidden ? 1 : 0,
    created_at: fecha(entry.created_at)
  });
});

const candlesByMemorial = new Map();
candleRows.forEach((candle) => {
  if (!candlesByMemorial.has(candle.memorial_id)) candlesByMemorial.set(candle.memorial_id, []);
  candlesByMemorial.get(candle.memorial_id).push({ name: candle.name || '', created_at: fecha(candle.created_at) });
});

const memorials = memorialRows.map((row) => ({
  id: row.id,
  user_id: row.user_id,
  slug: row.slug,
  certificate_code: row.certificate_code,
  kind: row.kind,
  full_name: row.full_name,
  relationship: row.relationship || '',
  birth_date: row.birth_date || null,
  death_date: row.death_date || null,
  epitaph: row.epitaph || '',
  biography: row.biography || '',
  theme: row.theme || 'jardin',
  is_public: row.is_public ? 1 : 0,
  allow_guestbook: row.allow_guestbook ? 1 : 0,
  views: row.views || 0,
  created_at: fecha(row.created_at),
  main_photo: row.main_photo || '',
  music_path: row.music_path || '',
  video_path: row.video_path || '',
  photos: photoByMemorial.get(row.id) || [],
  guestbook: guestbookByMemorial.get(row.id) || [],
  candles: candlesByMemorial.get(row.id) || []
}));

const purchases = purchaseRows.map((row) => ({
  user_id: row.user_id,
  plan: row.plan,
  plan_name: row.plan_name,
  amount: row.amount,
  credits: row.credits,
  reference: row.reference,
  status: row.status,
  provider_order: row.provider_order || null,
  payer_email: row.payer_email || null,
  paid_at: fecha(row.paid_at),
  refund_id: row.refund_id || null,
  created_at: fecha(row.created_at)
}));

/* -------------------------------------------------------------- archivos */

const uploadsDir = config.uploadsDir;
const archivos = new Set();

if (!sinMedios) {
  memorials.forEach((memorial) => {
    [memorial.main_photo, memorial.music_path, memorial.video_path].forEach((file) => {
      if (file) archivos.add(file);
    });
    memorial.photos.forEach((photo) => {
      if (photo.filename) archivos.add(photo.filename);
    });
  });
}

const presentes = [];
const faltantes = [];
archivos.forEach((relative) => {
  const absolute = path.join(uploadsDir, relative);
  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
    presentes.push(relative);
  } else {
    faltantes.push(relative);
  }
});

/* --------------------------------------------------------------- empaque */

const datos = {
  meta: {
    generado: new Date().toISOString(),
    origen: 'app-node',
    version: 1,
    con_medios: !sinMedios
  },
  users,
  memorials,
  purchases
};

const zip = new Zip();
zip.add('datos.json', JSON.stringify(datos, null, 2));

presentes.forEach((relative) => {
  const absolute = path.join(uploadsDir, relative);
  const compressed = /\.(jpe?g|png|webp|mp3|m4a|ogg|mp4|webm|mov)$/i.test(relative);
  zip.add(`uploads/${relative.replace(/\\/g, '/')}`, fs.readFileSync(absolute), { store: compressed });
});

fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const target = path.join(outDir, `jardin-memorial-migracion-${stamp}.zip`);
fs.writeFileSync(target, zip.finish());

const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

console.log('');
console.log('Exportación lista para WordPress');
console.log('  Archivo:      ' + target);
console.log('  Tamaño:       ' + mb(fs.statSync(target).size));
console.log('  Cuentas:      ' + users.length);
console.log('  Memoriales:   ' + memorials.length);
console.log('  Fotos:        ' + photoRows.length);
console.log('  Mensajes:     ' + guestbookRows.length);
console.log('  Velas:        ' + candleRows.length);
console.log('  Compras:      ' + purchases.length);
console.log('  Archivos:     ' + presentes.length + (sinMedios ? ' (omitidos con --sin-medios)' : ''));
if (faltantes.length) {
  console.log('  Aviso: ' + faltantes.length + ' archivo(s) referenciados ya no están en disco.');
  faltantes.slice(0, 5).forEach((file) => console.log('    · ' + file));
}
console.log('');
console.log('Siguiente paso: WordPress → Jardín Memorial → Migración → subir este ZIP.');
console.log('');

db.close();
