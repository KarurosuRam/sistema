'use strict';

const express = require('express');
const config = require('../config');
const store = require('../store');
const util = require('../util');
const { qrSvg } = require('../qr');

const router = express.Router();

router.get('/', (req, res) => {
  const stats = store.siteStats();
  const featured = store.listPublicMemorials({ limit: 3 });
  res.render('home', {
    pageTitle: null,
    metaDescription:
      'Crea un memorial digital para tu ser querido o mascota: enlace único, código QR, foto principal, galería de 10 fotos, video de 60 segundos, música, libro de visitas y certificado de propiedad.',
    bodyClass: 'page-home',
    activeNav: 'inicio',
    stats,
    featured,
    demoSlug: featured[0]?.slug || 'rosa-elena-munoz',
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
  const total = store.countPublicMemorials();
  const pages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, pages);
  const memorials = store.listPublicMemorials({ limit: perPage, offset: (currentPage - 1) * perPage });
  res.render('memoriales', {
    pageTitle: 'Memoriales públicos',
    metaDescription: 'Conoce los memoriales digitales que familias de todo Chile han creado en Jardín Memorial.',
    bodyClass: 'page-explore',
    activeNav: 'memoriales',
    memorials,
    total,
    page: currentPage,
    pages
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

router.get('/certificado', (req, res) => {
  const code = String(req.query.codigo || req.query.code || '').trim().toUpperCase();
  if (code) {
    const match = store.findMemorialByCertificate(code);
    if (match) return res.redirect(`/certificado/${encodeURIComponent(match.certificate_code)}`);
    return res.status(404).render('certificado-verificar', {
      pageTitle: 'Verificar certificado',
      metaDescription: 'Verifica la autenticidad de un certificado de propiedad de Jardín Memorial.',
      bodyClass: 'page-certificate',
      activeNav: '',
      notFound: true,
      code
    });
  }
  res.render('certificado-verificar', {
    pageTitle: 'Verificar certificado',
    metaDescription: 'Verifica la autenticidad de un certificado de propiedad de Jardín Memorial.',
    bodyClass: 'page-certificate',
    activeNav: '',
    notFound: false,
    code: ''
  });
});

router.get('/certificado/:code', (req, res, next) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const memorial = store.findMemorialByCertificate(code);
  if (!memorial) {
    const error = new Error('Certificado no encontrado');
    error.status = 404;
    return next(error);
  }
  const owner = store.findUserById(memorial.user_id);
  const qr = null;
  qrSvg(`${util.baseUrl(req)}/m/${memorial.slug}`)
    .then((svg) => {
      res.render('certificado', {
        pageTitle: `Certificado ${memorial.certificate_code}`,
        metaDescription: `Verificación del certificado de propiedad del memorial de ${memorial.full_name}.`,
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

router.get('/demo', (req, res) => {
  const demo = store.findMemorialBySlug('rosa-elena-munoz') || store.listPublicMemorials({ limit: 1 })[0];
  if (demo) return res.redirect(`/m/${demo.slug}`);
  return res.redirect('/planes');
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
