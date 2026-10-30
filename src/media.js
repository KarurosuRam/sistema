'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const config = require('./config');

const MP3_BITRATES = {
  // [version][layer] -> kbps table
  mpeg1: {
    layer1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    layer2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    layer3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  },
  mpeg2: {
    layer1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    layer2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    layer3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  }
};

const MP3_RATES = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000] // MPEG 2.5
};

function randomName(ext) {
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function removeQuiet(filePath) {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch(() => {});
}

/**
 * Normaliza una imagen subida y genera versión completa + miniatura.
 * Devuelve rutas relativas a /uploads.
 */
async function processImage(filePath) {
  const image = sharp(filePath, { failOn: 'error' });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) {
    const error = new Error('El archivo no parece ser una imagen válida.');
    error.status = 400;
    throw error;
  }
  if (meta.width < 300 || meta.height < 300) {
    const error = new Error('La imagen es muy pequeña. Usa una foto de al menos 300 × 300 px.');
    error.status = 400;
    throw error;
  }

  const base = randomName('');
  const fullName = `${base}.jpg`;
  const thumbName = `${base}-thumb.jpg`;
  const imgDir = path.join(config.uploadsDir, 'img');
  ensureDir(imgDir);

  const rotated = sharp(filePath, { failOn: 'error' }).rotate();
  await rotated
    .clone()
    .resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 86, progressive: true, mozjpeg: true })
    .toFile(path.join(imgDir, fullName));

  await rotated
    .clone()
    .resize(720, 720, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toFile(path.join(imgDir, thumbName));

  return { filename: `img/${fullName}`, thumb: `img/${thumbName}` };
}

function readId3v2Size(buffer) {
  if (buffer.length < 10) return 0;
  if (buffer.toString('latin1', 0, 3) !== 'ID3') return 0;
  const size =
    ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
  return 10 + size + (buffer[5] & 0x10 ? 10 : 0);
}

function isMp3FrameHeader(b0, b1, b2, b3) {
  return b0 === 0xff && (b1 & 0xe0) === 0xe0 && ((b2 >> 4) & 0x0f) !== 0x0f && ((b2 >> 2) & 0x03) !== 0x03;
}

function parseMp3Duration(buffer) {
  const total = buffer.length;
  let offset = readId3v2Size(buffer);
  let frames = 0;
  let samples = 0;

  // Encabezado Xing/Info (VBR) → cantidad exacta de frames.
  const probe = buffer.subarray(offset, Math.min(total, offset + 200));
  const xingIndex = probe.indexOf(Buffer.from('Xing'));
  const infoIndex = probe.indexOf(Buffer.from('Info'));
  const vbriIndex = probe.indexOf(Buffer.from('VBRI'));
  if (xingIndex >= 0 || infoIndex >= 0) {
    const at = xingIndex >= 0 ? xingIndex : infoIndex;
    const flags = probe.readUInt32BE(at + 4);
    if (flags & 0x1) {
      const frameCount = probe.readUInt32BE(at + 8);
      if (frameCount > 0) frames = frameCount;
    }
  } else if (vbriIndex >= 0) {
    const frameCount = probe.readUInt32BE(vbriIndex + 14);
    if (frameCount > 0) frames = frameCount;
  }

  let sampleRate = 44100;
  let samplesPerFrame = 1152;
  let scannedFrames = 0;
  let bytes = 0;
  let cursor = offset;

  while (cursor + 4 <= total) {
    if (!isMp3FrameHeader(buffer[cursor], buffer[cursor + 1], buffer[cursor + 2], buffer[cursor + 3])) {
      cursor += 1;
      if (scannedFrames > 8) break;
      continue;
    }
    const b1 = buffer[cursor + 1];
    const b2 = buffer[cursor + 2];
    const b3 = buffer[cursor + 3];
    const versionBits = (b1 >> 3) & 0x03; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layerBits = (b1 >> 1) & 0x03; // 1 = Layer III
    const bitrateIndex = (b2 >> 4) & 0x0f;
    const rateIndex = (b2 >> 2) & 0x03;
    const padding = (b2 >> 1) & 0x01;
    if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3 || layerBits === 0 || versionBits === 1) {
      cursor += 1;
      continue;
    }
    const isMpeg1 = versionBits === 3;
    const layerKey = layerBits === 3 ? 'layer1' : layerBits === 2 ? 'layer2' : 'layer3';
    const table = (isMpeg1 ? MP3_BITRATES.mpeg1 : MP3_BITRATES.mpeg2)[layerKey];
    const bitrate = table[bitrateIndex] * 1000;
    sampleRate = MP3_RATES[versionBits][rateIndex];
    samplesPerFrame = layerKey === 'layer1' ? 384 : layerKey === 'layer3' && !isMpeg1 ? 576 : 1152;
    const frameLength =
      layerKey === 'layer1'
        ? Math.floor((12 * bitrate) / sampleRate + padding) * 4
        : Math.floor((samplesPerFrame / 8) * (bitrate / sampleRate)) + padding;
    if (frameLength < 24) {
      cursor += 1;
      continue;
    }
    scannedFrames += 1;
    bytes += frameLength;
    cursor += frameLength;
    if (scannedFrames > 200000) break;
  }

  if (frames > 0) {
    // Se necesitan samplesPerFrame/sampleRate del primer frame válido.
    return (frames * samplesPerFrame) / sampleRate;
  }
  if (scannedFrames > 0 && cursor > offset) {
    // Estimar frames restantes con el tamaño promedio de frame.
    const avgFrameBytes = bytes / scannedFrames;
    frames = scannedFrames + Math.max(0, Math.round((total - cursor) / avgFrameBytes));
    return (frames * samplesPerFrame) / sampleRate;
  }
  return null;
}

async function saveAudio(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const id3 = buffer.toString('latin1', 0, 3) === 'ID3';
  let frameFound = false;
  for (let i = 0; i < Math.min(buffer.length - 4, 200000); i += 1) {
    if (isMp3FrameHeader(buffer[i], buffer[i + 1], buffer[i + 2], buffer[i + 3])) {
      frameFound = true;
      break;
    }
  }
  if (!id3 && !frameFound) {
    const error = new Error('La música debe ser un archivo MP3 válido.');
    error.status = 400;
    throw error;
  }
  if (!frameFound) {
    const error = new Error('No pudimos leer el audio MP3. Prueba con otro archivo.');
    error.status = 400;
    throw error;
  }
  const duration = parseMp3Duration(buffer);
  const audioDir = path.join(config.uploadsDir, 'audio');
  ensureDir(audioDir);
  const filename = randomName('.mp3');
  await fs.promises.rename(filePath, path.join(audioDir, filename));
  return { filename: `audio/${filename}`, duration };
}

function readBoxHeader(fd, position) {
  const header = Buffer.alloc(16);
  const bytesRead = fs.readSync(fd, header, 0, 16, position);
  if (bytesRead < 8) return null;
  let size = header.readUInt32BE(0);
  const type = header.toString('latin1', 4, 8);
  let headerSize = 8;
  if (size === 1) {
    if (bytesRead < 16) return null;
    const big = header.readBigUInt64BE(8);
    size = big > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(big);
    headerSize = 16;
  } else if (size === 0) {
    size = fs.fstatSync(fd).size - position;
  }
  return { size, type, headerSize };
}

function findMvhd(fd, start, end, depth = 0) {
  if (depth > 6) return null;
  let position = start;
  while (position + 8 <= end) {
    const box = readBoxHeader(fd, position);
    if (!box || box.size < 8) break;
    const boxEnd = Math.min(position + box.size, end);
    if (box.type === 'mvhd') {
      const buf = Buffer.alloc(Math.min(box.size, 120));
      fs.readSync(fd, buf, 0, buf.length, position + box.headerSize);
      const version = buf[0];
      let timescale;
      let duration;
      if (version === 1) {
        timescale = buf.readUInt32BE(20);
        const hi = buf.readUInt32BE(24);
        const lo = buf.readUInt32BE(28);
        duration = hi * 4294967296 + lo;
      } else {
        timescale = buf.readUInt32BE(12);
        duration = buf.readUInt32BE(16);
      }
      if (timescale > 0 && Number.isFinite(duration)) return { timescale, duration };
      return null;
    }
    if (['moov', 'trak', 'mdia', 'edts'].includes(box.type)) {
      const found = findMvhd(fd, position + box.headerSize, boxEnd, depth + 1);
      if (found) return found;
    }
    position = boxEnd;
  }
  return null;
}

function inspectVideo(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const isIso = head.toString('latin1', 4, 8) === 'ftyp';
    if (!isIso) return { valid: false, reason: 'El video debe ser MP4 o MOV.' };
    const mvhd = findMvhd(fd, 0, stat.size);
    const duration = mvhd && mvhd.timescale > 0 ? mvhd.duration / mvhd.timescale : null;
    return { valid: true, duration, size: stat.size };
  } finally {
    fs.closeSync(fd);
  }
}

async function saveVideo(filePath) {
  const info = inspectVideo(filePath);
  if (!info.valid) {
    const error = new Error(info.reason || 'El video no es válido.');
    error.status = 400;
    throw error;
  }
  if (info.size > config.maxVideoMB * 1024 * 1024) {
    const error = new Error(`El video supera los ${config.maxVideoMB} MB permitidos.`);
    error.status = 400;
    throw error;
  }
  if (info.duration && info.duration > config.maxVideoSeconds + 1.5) {
    const error = new Error(`El video dura ${Math.round(info.duration)} s. El máximo permitido es 60 segundos.`);
    error.status = 400;
    error.videoTooLong = true;
    throw error;
  }
  const videoDir = path.join(config.uploadsDir, 'video');
  ensureDir(videoDir);
  const filename = randomName('.mp4');
  await fs.promises.rename(filePath, path.join(videoDir, filename));
  return { filename: `video/${filename}`, duration: info.duration };
}

function deleteUpload(relativePath) {
  if (!relativePath) return;
  const clean = String(relativePath).replace(/^\/+/, '');
  if (clean.includes('..')) return;
  const absolute = path.resolve(config.uploadsDir, clean);
  if (!absolute.startsWith(path.resolve(config.uploadsDir))) return;
  removeQuiet(absolute);
}

module.exports = {
  processImage,
  saveAudio,
  saveVideo,
  parseMp3Duration,
  inspectVideo,
  deleteUpload,
  randomName,
  removeQuiet
};
