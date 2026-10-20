'use strict';

const express = require('express');
const config = require('../config');
const store = require('../store');
const { cookieOptions } = require('../security');
const util = require('../util');
const { loadPublicMemorial } = require('../auth');
const { qrBuffer, qrDataUrl } = require('../qr');
const { createRateLimiter, csrfProtect, csrfProtectPublic } = require('../security');
const { validateGuestbook } = require('../validation');

const router = express.Router();

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const guestbookLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: 'Recibimos varias firmas desde tu conexión. Espera unos minutos para dejar otra.',
  keyPrefix: 'guestbook'
});
const candleLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Muchas velas encendidas seguidas. Espera un momento.',
  keyPrefix: 'candle'
});

function viewCookieKey(memorial) {
  return `jm_v_${memorial.id}`;
}

router.get('/:slug', loadPublicMemorial, asyncHandler(async (req, res, next) => {
  try {
    const memorial = req.memorial;
    const photos = store.listPhotos(memorial.id);
    const messageCount = store.countGuestbook(memorial.id);
    const requestedLimit = Number.parseInt(req.query.mensajes, 10);
    const guestbookLimit = [30, 60, 120].includes(requestedLimit) ? requestedLimit : 30;
    const guestbook = store.listGuestbook(memorial.id, { limit: guestbookLimit });
    const moreMessages = guestbook.length < messageCount;
    const nextGuestbookLimit = guestbookLimit >= 120 ? 120 : guestbookLimit + 30;
    const candleCount = store.countCandles(memorial.id);

    const cookieKey = viewCookieKey(memorial);
    if (!req.cookies[cookieKey]) {
      store.registerView(memorial.id);
      res.cookie(cookieKey, '1', cookieOptions(req, {
        maxAge: 1000 * 60 * 60 * 12,
        httpOnly: true,
        path: '/'
      }));
      memorial.views += 1;
    }

    const publicUrl = `${util.baseUrl(req)}/m/${memorial.slug}`;
    const qrInline = await qrDataUrl(publicUrl, { margin: 0, width: 480 });

    const mainPhotoUrl = memorial.main_photo ? `/uploads/${memorial.main_photo}` : '/img/hero-garden.jpg';
    res.locals.ogImage = mainPhotoUrl;
    res.locals.ogType = 'profile';
    res.locals.metaDescription = memorial.epitaph
      ? `${memorial.full_name}: ${memorial.epitaph}`
      : `Memorial digital de ${memorial.full_name}. Comparte un recuerdo en su libro de visitas.`;

    const titleParts = [memorial.full_name];
    const span = util.yearsLabel(memorial);
    if (span) titleParts.push(`(${span})`);

    res.render('memorial/ver', {
      pageTitle: titleParts.join(' '),
      layout: 'layouts/memorial',
      bodyClass: `page-memorial theme-${memorial.theme}`,
      activeNav: '',
      hideFooter: true,
      memorial,
      photos,
      guestbook,
      candleCount,
      messageCount,
      moreMessages,
      nextGuestbookLimit,
      publicUrl,
      qrInline,
      musicSrc: memorial.music_path ? `/uploads/${memorial.music_path}` : config.defaultMusic,
      hasCustomMusic: !!memorial.music_path,
      span,
      lifeYears: util.lifeSpan(memorial.birth_date, memorial.death_date),
      birthLabel: util.formatDateParts(memorial.birth_date),
      deathLabel: util.formatDateParts(memorial.death_date),
      isOwner: req.isOwner,
      errors: [],
      values: {},
      extraCss: '/css/memorial.css',
      extraJs: '/js/memorial.js'
    });
  } catch (error) {
    next(error);
  }
}));

router.post('/:slug/firma', guestbookLimiter, loadPublicMemorial, csrfProtect, (req, res) => {
  const memorial = req.memorial;
  const wantsCandle = req.body.candle === 'on' || req.body.candle === '1';

  if (!memorial.allow_guestbook) {
    req.flash('error', 'El libro de visitas de este memorial está cerrado por su familia.');
    return res.redirect(`/m/${memorial.slug}#libro`);
  }

  const { errors, values } = validateGuestbook(req.body);
  if (errors.length) {
    req.flash('error', errors[0]);
    return res.redirect(`/m/${memorial.slug}#libro`);
  }

  store.addGuestbookEntry(memorial.id, values);
  if (values.candle) store.addCandle(memorial.id, values.name);
  req.flash(
    'success',
    values.candle
      ? 'Gracias por tu mensaje. Encendimos una vela junto a tu recuerdo.'
      : 'Gracias por dejar unas palabras en este memorial.'
  );
  const limit = String(req.body.mensajes || '');
  const suffix = ['30', '60', '120'].includes(limit) ? `?mensajes=${limit}` : '';
  return res.redirect(`/m/${memorial.slug}${suffix}#libro`);
});

router.post('/:slug/vela', candleLimiter, loadPublicMemorial, csrfProtectPublic, (req, res) => {
  const memorial = req.memorial;

  if (!memorial.allow_guestbook) {
    req.flash('error', 'Las velas de este memorial están cerradas por su familia.');
    return res.redirect(`/m/${memorial.slug}#velas`);
  }

  const name = String(req.body?.name || '').trim().slice(0, 60);
  try {
    store.addCandle(memorial.id, name || null);
  } catch (error) {
    console.error('[vela]', memorial.slug, error);
    req.flash('error', 'No pudimos encender la vela en este momento. Inténtalo otra vez en un rato.');
    return res.redirect(`/m/${memorial.slug}#velas`);
  }

  req.flash('success', 'Una luz más para su memoria. Gracias por encender esta vela.');
  res.redirect(`/m/${memorial.slug}#velas`);
});

router.get('/:slug/qr.png', loadPublicMemorial, asyncHandler(async (req, res, next) => {
  try {
    const url = `${util.baseUrl(req)}/m/${req.memorial.slug}`;
    const buffer = await qrBuffer(url, { width: 1000, margin: 2 });
    const download = req.query.download === '1';
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="qr-${req.memorial.slug}.png"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}));

module.exports = router;
