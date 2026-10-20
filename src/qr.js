'use strict';

const QRCode = require('qrcode');

const COLORS = {
  ink: '#16211f',
  sage: '#0e9184',
  cream: '#fff8f0'
};

async function qrBuffer(text, { width = 640, margin = 2, dark = COLORS.ink, light = COLORS.cream } = {}) {
  return QRCode.toBuffer(text, {
    type: 'png',
    width,
    margin,
    errorCorrectionLevel: 'M',
    color: { dark, light }
  });
}

async function qrDataUrl(text, options = {}) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 520,
    color: { dark: COLORS.ink, light: '#00000000' },
    ...options
  });
}

async function qrSvg(text, { dark = COLORS.ink, light = '#ffffff' } = {}) {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    color: { dark, light }
  });
}

module.exports = { qrBuffer, qrDataUrl, qrSvg, COLORS };
