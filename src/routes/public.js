'use strict';

const express = require('express');
const config = require('../config');
const store = require('../store');
const util = require('../util');
const { qrSvg } = require('../qr');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', (req, res) => {
  const featured = store.listPublicMemorials({ limit: 3 });
  res.render('home', {
    pageTitle: null,
    metaDescription:
      'Crea un memorial digital para tu ser querido o mascota: enlace único, código QR, foto principal, galería de 10 fotos, video de 60 segundos, música, libro de visitas y certificado de propiedad.',
    bodyClass: 'page-home',
    activeNav: 'inicio',
    featured,
    plans: config.prices
  });
});

router.get('/planes', (req, res) => {
  res.render('planes', {
    pageTitle: 'Precios y planes',
    metaDescription:
      'Memorial digital por $6.990, o pack de 4 memoriales por $11.990. Incluye enlace, QR, galería, video, música, libro de visitas y certificado.',
    bodyClass: 'page-pricing',
    activeNav: 'planes',
    plans: config.prices,
    paymentsMode: config.paymentsMode
  });
});

router.get('/como-funciona', (req, res) => {
  res.render('como-funciona', {
    pageTitle: 'Cómo funciona',
    metaDescription:
      'Crea tu cuenta, elige un plan y arma el memorial digital en pocos minutos. Te entregamos el enlace, el QR y el certificado de propiedad.',
    bodyClass: 'page-how',
    activeNav: 'como-funciona',
    plans: config.prices
  });
});

router.get('/memoriales', (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const perPage = 12;
  const query = String(req.query.q || '').trim().slice(0, 80);
  const kind = req.query.tipo === 'mascota' ? 'mascota' : req.query.tipo === 'persona' ? 'persona' : null;
  const filters = { query, kind };

  const total = query ? store.countSearchPublicMemorials(filters) : store.countPublicMemorials();
  const pages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, pages);
  const memorials = query
    ? store.searchPublicMemorials({ ...filters, limit: perPage, offset: (currentPage - 1) * perPage })
    : store.listPublicMemorials({ limit: perPage, offset: (currentPage - 1) * perPage, kind });

  res.render('memoriales', {
    pageTitle: query ? `Búsqueda: ${query}` : 'Memoriales públicos',
    metaDescription: 'Conoce los memoriales digitales que familias de todo Chile han creado en Jardín Memorial.',
    bodyClass: 'page-explore',
    activeNav: 'memoriales',
    memorials,
    total,
    page: currentPage,
    pages,
    query,
    kind
  });
});

router.get('/preguntas-frecuentes', (req, res) => {
  res.render('faq', {
    pageTitle: 'Preguntas frecuentes',
    metaDescription:
      'Respuestas sobre memoriales digitales, pagos, privacidad, música, videos y certificado de propiedad en Jardín Memorial.',
    bodyClass: 'page-faq',
    activeNav: 'ayuda',
    plans: config.prices
  });
});

// El certificado de propiedad es privado: se consulta desde la cuenta titular.
// La antigua verificación pública por código ya no está disponible.
router.get('/certificado', (req, res) => {
  if (req.user) return res.redirect('/panel');
  return res.redirect('/ingresar?next=%2Fpanel');
});

router.get('/certificado/:code', requireAuth, (req, res, next) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const memorial = store.findMemorialByCertificate(code);
  // A quien no es titular no se le revela siquiera si el certificado existe.
  if (!memorial || memorial.user_id !== req.user.id) return next();
  const owner = store.findUserById(memorial.user_id);
  // Documento privado: no se cachea ni se indexa.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  qrSvg(`${util.baseUrl(req)}/m/${memorial.slug}`)
    .then((svg) => {
      res.render('certificado', {
        pageTitle: `Certificado ${memorial.certificate_code}`,
        metaDescription: `Certificado de propiedad del memorial de ${memorial.full_name}.`,
        bodyClass: 'page-certificate',
        activeNav: '',
        memorial,
        ownerName: owner ? owner.name : 'Titular de la cuenta',
        ownerInitials: owner ? util.initials(owner.name) : 'JM',
        qrSvg: svg,
        issuedLabel: util.formatTimestamp(memorial.created_at),
        span: util.yearsLabel(memorial)
      });
    })
    .catch(next);
});

router.get('/terminos', (req, res) => {
  res.render('legal/terminos', {
    pageTitle: 'Términos y condiciones',
    metaDescription: 'Términos y condiciones de uso de Jardín Memorial.',
    bodyClass: 'page-legal',
    activeNav: ''
  });
});

router.get('/privacidad', (req, res) => {
  res.render('legal/privacidad', {
    pageTitle: 'Política de privacidad',
    metaDescription: 'Cómo cuidamos los datos y recuerdos que compartes en Jardín Memorial.',
    bodyClass: 'page-legal',
    activeNav: ''
  });
});

module.exports = router;
