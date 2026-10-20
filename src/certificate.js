'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const config = require('./config');
const { formatDateLong, formatTimestamp } = require('./util');
const { qrBuffer } = require('./qr');

const FONTS = {
  display: path.join(config.publicDir, 'fonts', 'cormorant-garamond-latin-400-normal.woff'),
  displayMedium: path.join(config.publicDir, 'fonts', 'cormorant-garamond-latin-500-normal.woff'),
  displaySemi: path.join(config.publicDir, 'fonts', 'cormorant-garamond-latin-600-normal.woff'),
  displayItalic: path.join(config.publicDir, 'fonts', 'cormorant-garamond-latin-400-italic.woff'),
  body: path.join(config.publicDir, 'fonts', 'jost-latin-300-normal.woff'),
  bodyMedium: path.join(config.publicDir, 'fonts', 'jost-latin-400-normal.woff'),
  bodySemi: path.join(config.publicDir, 'fonts', 'jost-latin-500-normal.woff')
};

const C = {
  ink: '#1f2b25',
  soft: '#5c6a62',
  sage: '#7d9479',
  sageLight: '#a9bba2',
  cream: '#fbf8f0',
  gold: '#b79b6c',
  line: '#d8d2c2'
};

function registerFonts(doc) {
  for (const [name, file] of Object.entries(FONTS)) {
    doc.registerFont(name, fs.readFileSync(file));
  }
}

function drawCorner(doc, x, y, sx, sy) {
  doc.save();
  doc.strokeColor(C.sageLight).lineWidth(1);
  doc.moveTo(x + sx * 26, y).lineTo(x, y).lineTo(x, y + sy * 26).stroke();
  doc.restore();
}

function drawSprig(doc, x, y, scale = 1, rotation = 0) {
  doc.save();
  doc.translate(x, y);
  doc.rotate(rotation);
  doc.scale(scale);
  doc.strokeColor(C.sage).lineWidth(1.1);
  doc.moveTo(0, 0).bezierCurveTo(6, -18, 6, -38, 0, -56).stroke();
  const leaves = [
    [0, -12, 1],
    [0, -22, -1],
    [0, -32, 1],
    [0, -42, -1]
  ];
  for (const [lx, ly, dir] of leaves) {
    doc
      .moveTo(lx, ly)
      .bezierCurveTo(lx + 10 * dir, ly - 3, lx + 14 * dir, ly - 11, lx + 13 * dir, ly - 17)
      .bezierCurveTo(lx + 5 * dir, ly - 14, lx + 1 * dir, ly - 8, lx, ly)
      .stroke();
  }
  doc.restore();
}

/**
 * Genera el certificado de propiedad en PDF.
 * @returns {Promise<Buffer>}
 */
async function generateCertificate({ memorial, owner, siteUrl: requestedUrl }) {
  // El certificado impreso siempre refiere al dominio público de la marca,
  // salvo que se configure BASE_URL explícitamente (p. ej. en una instalación propia).
  const siteUrl = (process.env.BASE_URL || '').trim().replace(/\/+$/, '') || config.defaultSiteUrl;
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margin: 0,
    info: {
      Title: `Certificado de propiedad · ${memorial.full_name}`,
      Author: config.siteName,
      Subject: `Certificado ${memorial.certificate_code}`,
      Keywords: 'memorial digital, certificado de propiedad, jardín memorial'
    }
  });

  registerFonts(doc);

  // Fondo
  doc.rect(0, 0, pageWidth, pageHeight).fill(C.cream);
  doc.rect(0, 0, pageWidth, 8).fill(C.sage);
  doc.rect(0, pageHeight - 8, pageWidth, 8).fill(C.sage);

  // Marco fino
  doc
    .lineWidth(0.8)
    .strokeColor(C.line)
    .rect(34, 34, pageWidth - 68, pageHeight - 68)
    .stroke();
  doc.lineWidth(0.5).strokeColor(C.sageLight).rect(41, 41, pageWidth - 82, pageHeight - 82).stroke();

  drawCorner(doc, 58, 58, 1, 1);
  drawCorner(doc, pageWidth - 58, 58, -1, 1);
  drawCorner(doc, 58, pageHeight - 58, 1, -1);
  drawCorner(doc, pageWidth - 58, pageHeight - 58, -1, -1);

  drawSprig(doc, 66, 338, 0.85, -14);
  drawSprig(doc, pageWidth - 66, 338, 0.85, 14);

  // Encabezado
  doc
    .font('bodyMedium')
    .fontSize(8.5)
    .fillColor(C.sage)
    .text('J A R D Í N   M E M O R I A L', 0, 62, { align: 'center', characterSpacing: 1.6 });
  doc
    .font('body')
    .fontSize(7.5)
    .fillColor(C.soft)
    .text('Memoriales digitales para recordar siempre', 0, 78, { align: 'center', characterSpacing: 0.5 });

  doc
    .font('display')
    .fontSize(39)
    .fillColor(C.ink)
    .text('Certificado de propiedad', 0, 112, { align: 'center' });
  doc
    .font('displayItalic')
    .fontSize(12)
    .fillColor(C.soft)
    .text('Este documento acredita la titularidad del memorial digital', 0, 160, { align: 'center' });

  // Columna de contenido
  const left = 88;
  const contentWidth = 462;
  const rightEdge = pageWidth - 88;
  const qrSize = 116;
  const qrX = rightEdge - qrSize;
  const qrY = 196;

  let cursorY = 198;
  doc.font('body').fontSize(10.4).fillColor(C.soft);
  doc.text('Se certifica que el memorial digital de', left, cursorY, { width: contentWidth });
  cursorY = doc.y + 2;

  const name = String(memorial.full_name || '');
  const nameSize = name.length > 34 ? 23 : name.length > 26 ? 26 : 30;
  doc.font('displayMedium').fontSize(nameSize).fillColor(C.ink);
  const nameHeight = doc.heightOfString(name, { width: contentWidth, lineGap: 0 });
  doc.text(name, left, cursorY, { width: contentWidth, lineGap: 0 });
  cursorY = doc.y + 5;

  const subtitleParts = [];
  if (memorial.kind === 'mascota') subtitleParts.push('Mascota de la familia');
  if (memorial.relationship) subtitleParts.push(memorial.relationship);
  if (memorial.birth_date || memorial.death_date) {
    const birth = memorial.birth_date ? String(memorial.birth_date).slice(0, 4) : '';
    const death = memorial.death_date ? String(memorial.death_date).slice(0, 4) : '';
    subtitleParts.push(`${birth} — ${death}`.replace(/^ — /, 'Desde ').replace(/ — $/, ''));
  }
  if (subtitleParts.length) {
    doc.font('body').fontSize(9).fillColor(C.sage);
    doc.text(subtitleParts.join('  ·  ').toUpperCase(), left, cursorY, {
      width: contentWidth,
      characterSpacing: 1.1,
      lineGap: 2
    });
    cursorY = doc.y + 8;
  } else {
    cursorY += 6;
  }

  const issued = formatDateLong(String(memorial.created_at).slice(0, 10));
  doc.font('body').fontSize(10.2).fillColor(C.soft);
  doc.text(
    `fue creado el ${issued} y registrado a nombre de ${owner.name}, titular de los derechos de ` +
      'administración y resguardo de sus recuerdos. Esta constancia se emite de forma electrónica ' +
      'y puede verificarse en línea con el código indicado.',
    left,
    cursorY,
    { width: contentWidth, lineGap: 4 }
  );

  // Caja de datos, siempre bajo el texto
  const boxY = Math.max(doc.y + 16, 356);
  const boxH = 84;
  doc
    .roundedRect(left, boxY, contentWidth + 72, boxH, 6)
    .fillAndStroke('#fffdf9', C.line);

  const col1 = left + 18;
  const col2 = left + 250;
  const label = (text, x, y) =>
    doc.font('bodyMedium').fontSize(6.6).fillColor(C.sage).text(text.toUpperCase(), x, y, { characterSpacing: 1.2 });
  const value = (text, x, y, width) =>
    doc.font('body').fontSize(9.4).fillColor(C.ink).text(text, x, y, { width, lineBreak: false, ellipsis: true });

  label('Código de certificado', col1, boxY + 15);
  value(memorial.certificate_code, col1, boxY + 27, 210);
  label('Fecha de emisión', col2, boxY + 15);
  value(formatTimestamp(memorial.created_at), col2, boxY + 27, 250);
  label('Enlace del memorial', col1, boxY + 51);
  value(`${siteUrl.replace(/^https?:\/\//, '')}/m/${memorial.slug}`, col1, boxY + 63, 330);

  // QR
  const qr = await qrBuffer(`${siteUrl}/m/${memorial.slug}`, { width: 600, margin: 1, dark: C.ink, light: '#ffffff' });
  doc
    .roundedRect(qrX - 9, qrY - 9, qrSize + 18, qrSize + 18, 4)
    .fillAndStroke('#ffffff', C.line);
  doc.image(qr, qrX, qrY, { width: qrSize, height: qrSize });
  doc
    .font('bodyMedium')
    .fontSize(6.4)
    .fillColor(C.soft)
    .text('ESCANEA PARA VISITAR', qrX - 9, qrY + qrSize + 16, {
      width: qrSize + 18,
      align: 'center',
      characterSpacing: 1.1
    });

  // Firmas
  const signY = Math.min(boxY + boxH + 54, 494);
  doc.lineWidth(0.7).strokeColor(C.sageLight);
  doc.moveTo(left, signY).lineTo(left + 190, signY).stroke();
  doc.font('displayItalic').fontSize(19).fillColor(C.ink).text('Jardín Memorial', left, signY - 30, { width: 200 });
  doc.font('body').fontSize(7.4).fillColor(C.soft).text('Emisor del certificado', left, signY + 7, {
    characterSpacing: 0.8
  });

  doc.lineWidth(0.7).strokeColor(C.sageLight);
  doc.moveTo(left + 250, signY).lineTo(left + 440, signY).stroke();
  doc
    .font('displayMedium')
    .fontSize(owner.name.length > 28 ? 13 : 15.5)
    .fillColor(C.ink)
    .text(owner.name, left + 250, signY - (owner.name.length > 28 ? 22 : 26), { width: 200, lineBreak: false, ellipsis: true });
  doc.font('body').fontSize(7.4).fillColor(C.soft).text('Titular de la cuenta', left + 250, signY + 7, {
    characterSpacing: 0.8
  });

  // Pie
  doc
    .font('body')
    .fontSize(7.2)
    .fillColor(C.soft)
    .text(
      `Verifica la autenticidad de este certificado en ${siteUrl.replace(/^https?:\/\//, '')}/certificado/${memorial.certificate_code}`,
      60,
      pageHeight - 66,
      { width: pageWidth - 120, align: 'center' }
    );
  doc
    .fillColor(C.sage)
    .text(`${config.siteName}  ·  ${siteUrl.replace(/^https?:\/\//, '')}  ·  ${config.contactEmail}`, 60, pageHeight - 52, {
      width: pageWidth - 120,
      align: 'center',
      characterSpacing: 0.4
    });

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

module.exports = { generateCertificate };
