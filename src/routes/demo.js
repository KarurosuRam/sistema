'use strict';

/**
 * Demo interactiva dentro de la propia página.
 *
 * El sitio se muestra dentro de una vista previa embebida, donde el navegador
 * puede bloquear las cookies de sesión. Por eso esta demo no depende de una
 * cuenta ni de una cookie: opera directamente sobre los memoriales de ejemplo
 * y devuelve al visitante a la misma página.
 */

const express = require('express');
const config = require('../config');
const store = require('../store');
const util = require('../util');
const { createRateLimiter } = require('../security');

const router = express.Router();

const demoReadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 200,
  message: 'Demasiadas visitas a la demo. Espera un momento y vuelve a intentarlo.',
  keyPrefix: 'demo-read'
});

const demoWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: 'Muchas acciones seguidas en la demo. Espera unos minutos para continuar.',
  keyPrefix: 'demo-write'
});

const MAX_DEMO_MEMORIALS = 8;
// Marca con la que se reconocen los memoriales creados desde la demo, para poder
// retirarlos sin tocar los memoriales de ejemplo originales.
const DEMO_RELATIONSHIP = 'Cuenta de ejemplo';

function findDemoUser() {
  return store.findUserByEmail(config.demoAccount.email);
}

/** Toda la demo vive bajo /demo y solo existe mientras los pagos son simulados. */
function demoGuard(req, res, next) {
  if (!config.demoAccess) return res.redirect('/memoriales');

  const user = findDemoUser();
  if (!user) {
    return res.status(503).render('demo', {
      pageTitle: 'Demo interactiva',
      metaDescription: 'Recorre una cuenta de ejemplo de Jardín Memorial.',
      layout: 'layouts/embed',
      bodyClass: 'page-demo page-demo--embed',
      activeNav: '',
      hideFooter: true,
      demoAvailable: false,
      demoUser: null,
      memorials: [],
      selected: null,
      photos: [],
      guestbook: [],
      candleCount: 0,
      messageCount: 0,
      status: null,
      themes: config.themes,
      maxMemorials: MAX_DEMO_MEMORIALS
    });
  }

  req.demoUser = user;
  next();
}

/**
 * Sin sesión no hay token CSRF que comparar. Se exige, cuando el navegador lo
 * envía, que la petición venga del mismo sitio; el abuso queda acotado por el
 * limitador de intentos.
 */
function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  // Detrás del proxy de la vista previa el host puede llegar en Host o en
  // X-Forwarded-Host; se aceptan ambos para no romper el envío de los formularios.
  const hosts = [req.get('host'), req.hostname, req.get('x-forwarded-host')]
    .filter(Boolean)
    .map((value) => String(value).split(',')[0].trim());
  try {
    if (hosts.includes(new URL(origin).host)) return next();
  } catch (_) {
    /* origen malformado: cae al rechazo */
  }
  const error = new Error('La petición no vino de este sitio.');
  error.status = 403;
  return next(error);
}

const STATUS_MESSAGES = {
  vela: 'Encendiste una vela más en su memoria.',
  firma: 'Tu mensaje quedó en el libro de visitas de la demo.',
  tema: 'Cambiaste el tema del memorial.',
  visibilidad: 'Actualizaste la visibilidad del memorial.',
  libro: 'Actualizaste el libro de visitas.',
  creado: 'Creamos un memorial de prueba en la cuenta de ejemplo.',
  eliminado: 'Quitamos el memorial de prueba. Los memoriales de ejemplo quedaron intactos.'
};

function demoMemorial(req) {
  const slug = String(req.body.slug || req.query.m || '').trim();
  const memorial = slug ? store.findMemorialBySlug(slug) : null;
  if (!memorial || memorial.user_id !== req.demoUser.id) return null;
  return memorial;
}

/* ------------------------------------------------------------ página demo */

router.get('/demo', demoReadLimiter, demoGuard, (req, res) => {
  const memorials = store.listMemorialsByUser(req.demoUser.id);
  const requested = String(req.query.m || '').trim();
  // Por defecto se abre el memorial insignia de la demo, no el último creado.
  const fallback = memorials.find((item) => item.slug === 'rosa-elena-munoz') || memorials[0] || null;
  const selected = memorials.find((item) => item.slug === requested) || fallback;

  // El memorial abierto va primero en el selector, así siempre queda a la vista.
  const ordered = selected
    ? [selected].concat(memorials.filter((item) => item.id !== selected.id))
    : memorials;

  const photos = selected ? store.listPhotos(selected.id) : [];
  const guestbook = selected ? store.listGuestbook(selected.id, { limit: 6 }) : [];
  const candleCount = selected ? store.countCandles(selected.id) : 0;
  const messageCount = selected ? store.countGuestbook(selected.id) : 0;

  const okKey = String(req.query.ok || '');
  const status = STATUS_MESSAGES[okKey] ? STATUS_MESSAGES[okKey] : null;
  const errorKey = String(req.query.error || '');
  const error =
    errorKey === 'limite'
      ? 'La demo ya tiene el máximo de memoriales de prueba. Quita uno de los que creaste para seguir.'
      : errorKey === 'libro'
        ? 'El libro de visitas está cerrado en este memorial, así que no se pueden sumar velas ni mensajes.'
        : null;

  res.render('demo', {
    pageTitle: 'Demo interactiva',
    metaDescription:
      'Prueba Jardín Memorial sin crear cuenta: enciende velas, deja mensajes y administra memoriales de ejemplo.',
    layout: 'layouts/embed',
    bodyClass: 'page-demo page-demo--embed',
    activeNav: '',
    hideFooter: true,
    demoAvailable: true,
    demoUser: req.demoUser,
    memorials: ordered,
    selected,
    photos,
    guestbook,
    candleCount,
    messageCount,
    status,
    error,
    themes: config.themes,
    maxMemorials: MAX_DEMO_MEMORIALS,
    selectedIsDemoCreated: !!selected && selected.relationship === DEMO_RELATIONSHIP,
    yearsLabel: selected ? util.yearsLabel(selected) : '',
    lifeYears: selected ? util.lifeSpan(selected.birth_date, selected.death_date) : null
  });
});

/* --------------------------------------------------------------- acciones */

router.post('/demo/vela', demoWriteLimiter, demoGuard, sameOrigin, (req, res) => {
  const memorial = demoMemorial(req);
  if (!memorial) return res.redirect('/demo');
  if (!memorial.allow_guestbook) {
    return res.redirect(`/demo?m=${memorial.slug}&error=libro`);
  }

  const name = String(req.body.name || '').trim().slice(0, 60);
  store.addCandle(memorial.id, name || null);
  return res.redirect(`/demo?m=${memorial.slug}&ok=vela#velas`);
});

router.post('/demo/firma', demoWriteLimiter, demoGuard, sameOrigin, (req, res) => {
  const memorial = demoMemorial(req);
  if (!memorial) return res.redirect('/demo');
  if (!memorial.allow_guestbook) {
    return res.redirect(`/demo?m=${memorial.slug}&error=libro`);
  }

  const name = String(req.body.name || '').trim().slice(0, 60);
  const city = String(req.body.city || '').trim().slice(0, 60);
  const message = String(req.body.message || '').trim().slice(0, 600);

  if (name.length < 2 || message.length < 3) {
    return res.redirect(`/demo?m=${memorial.slug}#libro`);
  }

  store.addGuestbookEntry(memorial.id, { name, city, message, candle: false });
  return res.redirect(`/demo?m=${memorial.slug}&ok=firma#libro`);
});

router.post('/demo/tema', demoWriteLimiter, demoGuard, sameOrigin, (req, res) => {
  const memorial = demoMemorial(req);
  if (!memorial) return res.redirect('/demo');

  const theme = config.themes[req.body.theme] ? req.body.theme : 'jardin';
  store.updateMemorial(memorial.id, {
    full_name: memorial.full_name,
    kind: memorial.kind,
    relationship: memorial.relationship,
    birth_date: memorial.birth_date,
    death_date: memorial.death_date,
    epitaph: memorial.epitaph,
    biography: memorial.biography,
    theme,
    is_public: !!memorial.is_public,
    allow_guestbook: !!memorial.allow_guestbook
  });
  return res.redirect(`/demo?m=${memorial.slug}&ok=tema#ajustes`);
});

router.post('/demo/visibilidad', demoWriteLimiter, demoGuard, sameOrigin, (req, res) => {
  const memorial = demoMemorial(req);
  if (!memorial) return res.redirect('/demo');

  store.updateMemorial(memorial.id, {
    full_name: memorial.full_name,
    kind: memorial.kind,
    relationship: memorial.relationship,
    birth_date: memorial.birth_date,
    death_date: memorial.death_date,
    epitaph: memorial.epitaph,
    biography: memorial.biography,
    theme: memorial.theme,
    is_public: !memorial.is_public,
    allow_guestbook: !!memorial.allow_guestbook
  });
  return res.redirect(`/demo?m=${memorial.slug}&ok=visibilidad#ajustes`);
});

router.post('/demo/libro', demoWriteLimiter, demoGuard, sameOrigin, (req, res) => {
  const memorial = demoMemorial(req);
  if (!memorial) return res.redirect('/demo');

  store.updateMemorial(memorial.id, {
    full_name: memorial.full_name,
    kind: memorial.kind,
    relationship: memorial.relationship,
    birth_date: memorial.birth_date,
    death_date: memorial.death_date,
    epitaph: memorial.epitaph,
    biography: memorial.biography,
    theme: memorial.theme,
    is_public: !!memorial.is_public,
    allow_guestbook: !memorial.allow_guestbook
  });
  return res.redirect(`/demo?m=${memorial.slug}&ok=libro#ajustes`);
});

router.post('/demo/crear', demoWriteLimiter, demoGuard, sameOrigin, (req, res) => {
  const existing = store.listMemorialsByUser(req.demoUser.id);
  if (existing.length >= MAX_DEMO_MEMORIALS) {
    return res.redirect('/demo?error=limite');
  }

  const fullName = String(req.body.full_name || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  if (fullName.length < 2) return res.redirect('/demo#crear');

  const memorial = store.createMemorial(req.demoUser.id, {
    kind: req.body.kind === 'mascota' ? 'mascota' : 'persona',
    full_name: fullName,
    relationship: DEMO_RELATIONSHIP,
    birth_date: null,
    death_date: null,
    epitaph: 'Un memorial de prueba creado desde la demo.',
    biography: 'Este memorial se creó dentro de la demo interactiva para mostrar cómo se ve un jardín recién abierto.',
    theme: req.body.theme && config.themes[req.body.theme] ? req.body.theme : 'jardin',
    // Nace privado: no aparece en la galería pública ni en el sitemap.
    is_public: false,
    allow_guestbook: true
  });

  return res.redirect(`/demo?m=${memorial.slug}&ok=creado#ajustes`);
});

router.post('/demo/eliminar', demoWriteLimiter, demoGuard, sameOrigin, (req, res) => {
  const memorial = demoMemorial(req);
  // Solo se quitan los memoriales creados desde la demo, nunca los de ejemplo.
  if (!memorial || memorial.relationship !== DEMO_RELATIONSHIP) return res.redirect('/demo#ajustes');

  store.deleteMemorial(memorial.id);
  return res.redirect('/demo?ok=eliminado#ajustes');
});

module.exports = router;
