'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const config = require('./config');
const { formatDateParts, yearsLabel } = require('./util');
const { qrBuffer } = require('./qr');

const FONTS = {
  display: path.join(config.publicDir, 'fonts', 'cormorant-garamond-latin-400-normal.woff'),
  displayMedium: path.join(config.publicDir, 'fonts', 'cormorant-garamond-latin-500-normal.woff'),
  displayItalic: path.join(config.publicDir, 'fonts', 'cormorant-garamond-latin-400-italic.woff'),
  body: path.join(config.publicDir, 'fonts', 'jost-latin-300-normal.woff'),
  bodyMedium: path.join(config.publicDir, 'fonts', 'jost-latin-400-normal.woff'),
  bodySemi: path.join(config.publicDir, 'fonts', 'jost-latin-500-normal.woff')
};

const C = {
  ink: '#16211f',
  soft: '#5b6b66',
  sage: '#0e9184',
  sageLight: '#7fd8c9',
  cream: '#fff8f0',
  line: '#e2c9b2'
};

function sprig(doc, x, y, scale, rotation) {
  doc.save();
  doc.translate(x, y);
  doc.rotate(rotation);
  doc.scale(scale);
  doc.strokeColor(C.sage).lineWidth(1);
  doc.moveTo(0, 0).bezierCurveTo(6, -18, 6, -38, 0, -56).stroke();
  [
    [0, -12, 1],
    [0, -24, -1],
    [0, -36, 1]
  ].forEach(([lx, ly, dir]) => {
    doc
      .moveTo(lx, ly)
      .bezierCurveTo(lx + 10 * dir, ly - 3, lx + 14 * dir, ly - 11, lx + 13 * dir, ly - 17)
      .bezierCurveTo(lx + 5 * dir, ly - 14, lx + 1 * dir, ly - 8, lx, ly)
      .stroke();
  });
  doc.restore();
}

/**
 * Tarjeta conmemorativa imprimible (A5 horizontal) con el QR del memorial.
 * Pensada para recordatorios de ceremonia, tarjetas o placas.
 */
async function generatePoster({ memorial }) {
  // Mismo criterio que el certificado: SITE_URL manda sobre el dominio fijo.
  const siteUrl = config.publicUrl;
  const pageWidth = 595.28;
  const pageHeight = 419.53;

  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margin: 0,
    info: {
      Title: `Tarjeta conmemorativa · ${memorial.full_name}`,
      Author: config.siteName,
      Subject: `Memorial digital ${memorial.certificate_code}`
    }
  });

  for (const [name, file] of Object.entries(FONTS)) {
    doc.registerFont(name, fs.readFileSync(file));
  }

  // Fondo y marco
  doc.rect(0, 0, pageWidth, pageHeight).fill(C.cream);
  doc.rect(0, 0, pageWidth, 6).fill(C.sage);
  doc.rect(0, pageHeight - 6, pageWidth, 6).fill(C.sage);
  doc.lineWidth(0.7).strokeColor(C.line).rect(18, 18, pageWidth - 36, pageHeight - 36).stroke();

  // Retrato
  const photoRelative = memorial.main_thumb || memorial.main_photo;
  const photoPath = photoRelative ? path.join(config.uploadsDir, photoRelative) : null;
  const cx = 150;
  const cy = 138;
  const radius = 62;

  if (photoPath && fs.existsSync(photoPath)) {
    doc.save();
    doc.circle(cx, cy, radius).clip();
    doc.image(photoPath, cx - radius, cy - radius, {
      width: radius * 2,
      height: radius * 2,
      cover: [radius * 2, radius * 2]
    });
    doc.restore();
    doc.circle(cx, cy, radius).lineWidth(2).strokeColor('#ffffff').stroke();
  } else {
    doc.circle(cx, cy, radius).fillAndStroke('#e6f7f3', C.sageLight);
    const initials = String(memorial.full_name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
    doc
      .font('display')
      .fontSize(46)
      .fillColor(C.sage)
      .text(initials, cx - radius, cy - 26, { width: radius * 2, align: 'center' });
  }
  doc.circle(cx, cy, radius + 6).lineWidth(0.6).strokeColor(C.sageLight).stroke();

  // Texto principal
  doc
    .font('bodyMedium')
    .fontSize(7.4)
    .fillColor(C.sage)
    .text(memorial.kind === 'mascota' ? 'EN MEMORIA DE SU MASCOTA' : 'EN MEMORIA DE', 40, 226, {
      width: 250,
      align: 'center',
      characterSpacing: 2
    });

  const nameSize = memorial.full_name.length > 30 ? 22 : memorial.full_name.length > 22 ? 26 : 30;
  doc
    .font('displayMedium')
    .fontSize(nameSize)
    .fillColor(C.ink)
    .text(memorial.full_name, 30, 244, { width: 270, align: 'center', lineGap: -2 });

  const span = yearsLabel(memorial);
  if (span) {
    doc
      .font('body')
      .fontSize(8.6)
      .fillColor(C.soft)
      .text(span, 30, doc.y + 4, { width: 270, align: 'center', characterSpacing: 2 });
  }

  if (memorial.epitaph) {
    doc
      .font('displayItalic')
      .fontSize(11)
      .fillColor(C.soft)
      .text(`«${memorial.epitaph}»`, 40, doc.y + 10, { width: 250, align: 'center', lineGap: 2 });
  }

  // Separador vertical
  doc.lineWidth(0.6).strokeColor(C.line).moveTo(340, 62).lineTo(340, 340).stroke();

  // QR
  const qr = await qrBuffer(`${siteUrl}/m/${memorial.slug}`, {
    width: 640,
    margin: 1,
    dark: C.ink,
    light: '#ffffff'
  });
  const qrSize = 124;
  const qrX = 428;
  const qrY = 84;
  doc.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 4).fillAndStroke('#ffffff', C.line);
  doc.image(qr, qrX, qrY, { width: qrSize, height: qrSize });

  doc
    .font('bodySemi')
    .fontSize(7)
    .fillColor(C.sage)
    .text('ESCANEA Y VISITA SU MEMORIAL', 352, qrY + qrSize + 18, {
      width: 200,
      align: 'center',
      characterSpacing: 1.1
    });
  doc
    .font('body')
    .fontSize(8.2)
    .fillColor(C.ink)
    .text(`jardinmemorial.cl/m/${memorial.slug}`, 352, qrY + qrSize + 34, { width: 200, align: 'center' });

  // Fechas clave (derecha, bajo el QR)
  const birth = formatDateParts(memorial.birth_date);
  const death = formatDateParts(memorial.death_date);
  let dateY = qrY + qrSize + 56;
  const dateRow = (label, value) => {
    if (!value) return;
    doc.font('bodyMedium').fontSize(6).fillColor(C.sage).text(label.toUpperCase(), 352, dateY, {
      width: 200,
      align: 'center',
      characterSpacing: 1.2
    });
    doc.font('body').fontSize(8).fillColor(C.soft).text(value, 352, dateY + 9, { width: 200, align: 'center' });
    dateY += 26;
  };
  dateRow(memorial.kind === 'mascota' ? 'Nació' : 'Nacimiento', birth ? birth.short : '');
  dateRow(memorial.kind === 'mascota' ? 'Nos dejó' : 'Partida', death ? death.short : '');

  // Decoración
  sprig(doc, 48, 372, 0.55, -12);
  sprig(doc, pageWidth - 48, 372, 0.55, 12);

  // Pie
  doc
    .font('body')
    .fontSize(6.8)
    .fillColor(C.soft)
    .text(
      `JARDÍN MEMORIAL  ·  ${siteUrl.replace(/^https?:\/\//, '')}  ·  CERTIFICADO ${memorial.certificate_code}`,
      40,
      pageHeight - 40,
      { width: pageWidth - 80, align: 'center', characterSpacing: 0.8 }
    );

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

module.exports = { generatePoster };
