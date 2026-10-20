'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const config = require('../config');
const store = require('../store');
const util = require('../util');
const media = require('../media');
const { requireAuth, loadMemorialOwned } = require('../auth');
const { csrfProtect, createRateLimiter } = require('../security');
const { photoSingle, photoArray, audioSingle, videoSingle } = require('../upload');
const { validateMemorial } = require('../validation');
const { qrBuffer, qrDataUrl } = require('../qr');
const { generateCertificate } = require('../certificate');
const { generatePoster } = require('../poster');

const router = express.Router();

const purchaseLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Demasiados intentos de compra. Espera unos minutos.',
  keyPrefix: 'purchase'
});

const csrfUnlessMultipart = (req, res, next) => {
  if (req.is('multipart/form-data')) return next();
  return csrfProtect(req, res, next);
};

router.use(requireAuth);
router.use(csrfUnlessMultipart);
router.use((req, res, next) => {
  res.locals.activeNav = 'panel';
  res.locals.bodyClass = res.locals.bodyClass || 'page-panel';
  res.locals.plans = config.prices;
  res.locals.paymentsMode = config.paymentsMode;
  next();
});

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function safeFileName(value, fallback = 'memorial') {
  return util.slugify(value) || fallback;
}

function cleanupTemp(files) {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  list.forEach((file) => media.removeQuiet(file.path));
}

function flashAndBack(req, res, message, type = 'error', suffix = '') {
  req.flash(type, message);
  return res.redirect(`/panel/memoriales/${req.memorial.id}${suffix}`);
}

/* ------------------------------------------------------------- dashboard */

router.get('/', (req, res) => {
  const memorials = store.listMemorialsByUser(req.user.id);
  const stats = store.userStats(req.user.id);
  const purchases = store.listPurchases(req.user.id, 5);
  const recentGuestbook = store.listRecentGuestbookForUser(req.user.id, 6);
  res.render('panel/index', {
    pageTitle: 'Mi jardín',
    metaDescription: 'Administra tus memoriales digitales en Jardín Memorial.',
    bodyClass: 'page-panel',
    memorials,
    stats,
    purchases,
    recentGuestbook,
    plans: config.prices,
    bienvenida: req.query.bienvenida === '1'
  });
});

/* ---------------------------------------------------------------- planes */

router.get('/planes', (req, res) => {
  res.render('panel/planes', {
    pageTitle: 'Comprar memoriales',
    metaDescription: 'Elige tu plan de memoriales digitales en Jardín Memorial.',
    bodyClass: 'page-panel',
    plans: config.prices,
    paymentsMode: config.paymentsMode
  });
});

router.get('/comprar/:plan', (req, res, next) => {
  const plan = config.prices[req.params.plan];
  if (!plan) return next();
  res.render('panel/checkout', {
    pageTitle: `Comprar ${plan.name}`,
    metaDescription: `Compra ${plan.name} en Jardín Memorial.`,
    bodyClass: 'page-panel',
    plan,
    paymentsMode: config.paymentsMode,
    errors: []
  });
});

router.post('/comprar/:plan', purchaseLimiter, (req, res, next) => {
  const plan = config.prices[req.params.plan];
  if (!plan) return next();

  if (config.paymentsMode === 'live') {
    req.flash('error', 'La pasarela de pagos está en configuración. Escríbenos a ' + config.contactEmail + ' para completar tu compra.');
    return res.redirect(`/panel/comprar/${plan.id}`);
  }

  try {
    const reference = `JM-${Date.now().toString(36).toUpperCase()}-${util.randomCode(4)}`;
    const { purchase } = store.completePurchase({
      userId: req.user.id,
      plan: plan.id,
      planName: plan.name,
      amount: plan.amount,
      credits: plan.credits,
      reference,
      mode: 'demo'
    });
    req.flash('success', `Pago aprobado. Se agregaron ${plan.credits} ${plan.credits === 1 ? 'memorial' : 'memoriales'} a tu cuenta.`);
    return res.redirect(`/panel/compra/${purchase.reference}`);
  } catch (error) {
    return next(error);
  }
});

router.get('/compra/:reference', (req, res, next) => {
  const purchase = store.findPurchaseByReference(String(req.params.reference));
  if (!purchase || purchase.user_id !== req.user.id) return next();
  res.render('panel/recibo', {
    pageTitle: 'Comprobante de compra',
    metaDescription: 'Comprobante de compra de Jardín Memorial.',
    bodyClass: 'page-panel',
    purchase,
    mode: config.paymentsMode
  });
});

router.get('/compras', (req, res) => {
  res.render('panel/compras', {
    pageTitle: 'Historial de compras',
    metaDescription: 'Historial de compras y memoriales disponibles en tu cuenta.',
    bodyClass: 'page-panel',
    purchases: store.listPurchases(req.user.id, 100)
  });
});

/* ----------------------------------------------------------- mensajes */

router.get('/mensajes', (req, res) => {
  const entries = store.listGuestbookForUser(req.user.id, { limit: 200 });
  const counters = store.countGuestbookForUser(req.user.id);
  res.render('panel/mensajes', {
    pageTitle: 'Mensajes recibidos',
    metaDescription: 'Modera los mensajes que dejan los visitantes de tus memoriales.',
    bodyClass: 'page-panel',
    entries,
    total: counters.total || 0,
    hidden: counters.hidden || 0
  });
});

router.post('/mensajes/:entryId/ocultar', (req, res) => {
  const entry = store.findGuestbookEntry(Number(req.params.entryId));
  if (!entry) {
    req.flash('error', 'El mensaje no existe.');
    return res.redirect('/panel/mensajes');
  }
  const memorial = store.findMemorialById(entry.memorial_id);
  if (!memorial || memorial.user_id !== req.user.id) {
    const error = new Error('No tienes acceso a este mensaje.');
    error.status = 403;
    return res.render('errors/403', {
      pageTitle: 'Acceso restringido',
      metaDescription: 'No tienes permisos para ver esta página.',
      bodyClass: 'page-error'
    });
  }
  store.setGuestbookHidden(entry.id, !entry.hidden);
  req.flash('success', entry.hidden ? 'El mensaje vuelve a estar visible.' : 'El mensaje quedó oculto del memorial.');
  res.redirect(req.body.back === 'memorial' ? `/panel/memoriales/${memorial.id}#libro` : '/panel/mensajes');
});

router.post('/mensajes/:entryId/eliminar', (req, res) => {
  const entry = store.findGuestbookEntry(Number(req.params.entryId));
  if (!entry) {
    req.flash('error', 'El mensaje no existe.');
    return res.redirect('/panel/mensajes');
  }
  const memorial = store.findMemorialById(entry.memorial_id);
  if (!memorial || memorial.user_id !== req.user.id) {
    const error = new Error('No tienes acceso a este mensaje.');
    error.status = 403;
    return res.render('errors/403', {
      pageTitle: 'Acceso restringido',
      metaDescription: 'No tienes permisos para ver esta página.',
      bodyClass: 'page-error'
    });
  }
  store.deleteGuestbookEntry(entry.id);
  req.flash('success', 'El mensaje se eliminó definitivamente.');
  res.redirect(req.body.back === 'memorial' ? `/panel/memoriales/${memorial.id}#libro` : '/panel/mensajes');
});

/* -------------------------------------------------------- crear memorial */

router.get('/nuevo', (req, res) => {
  if (req.user.credits < 1) {
    req.flash('info', 'Para crear un memorial primero elige un plan. Tus recuerdos están seguros: puedes comenzar en cuanto tengas tu memorial disponible.');
    return res.redirect('/panel/planes');
  }
  res.render('panel/nuevo', {
    pageTitle: 'Nuevo memorial',
    metaDescription: 'Crea un memorial digital para tu ser querido o mascota.',
    bodyClass: 'page-panel page-create',
    errors: [],
    values: {
      kind: 'persona',
      full_name: '',
      relationship: '',
      birth_date: '',
      death_date: '',
      epitaph: '',
      biography: '',
      theme: 'jardin',
      is_public: true,
      allow_guestbook: true
    }
  });
});

router.post(
  '/memoriales',
  photoSingle,
  csrfProtect,
  asyncHandler((req, res, next) => {
    const { errors, values } = validateMemorial(req.body);

    if (errors.length) {
      cleanupTemp(req.file);
      return res.status(422).render('panel/nuevo', {
        pageTitle: 'Nuevo memorial',
        metaDescription: 'Crea un memorial digital para tu ser querido o mascota.',
        bodyClass: 'page-panel page-create',
        errors,
        values
      });
    }

    if (req.user.credits < 1) {
      cleanupTemp(req.file);
      req.flash('error', 'No tienes memoriales disponibles. Elige un plan para continuar.');
      return res.redirect('/panel/planes');
    }

    let upload = null;
    (async () => {
      try {
        if (req.file) {
          upload = await media.processImage(req.file.path);
          media.removeQuiet(req.file.path);
        }

        const consumed = store.consumeCredit(req.user.id);
        if (!consumed) {
          if (upload) {
            media.deleteUpload(upload.filename);
            media.deleteUpload(upload.thumb);
          }
          req.flash('error', 'No tienes memoriales disponibles. Elige un plan para continuar.');
          return res.redirect('/panel/planes');
        }

        let memorial;
        try {
          memorial = store.createMemorial(req.user.id, values);
          if (upload) {
            const photoId = store.addPhoto(memorial.id, {
              filename: upload.filename,
              thumb: upload.thumb,
              caption: 'Foto principal'
            });
            store.setMemorialMainPhoto(memorial.id, upload.filename, upload.thumb);
            store.reorderPhotos(memorial.id, [photoId, ...store.listPhotos(memorial.id).filter((p) => p.id !== photoId).map((p) => p.id)]);
          }
        } catch (error) {
          store.addCredits(req.user.id, 1);
          if (upload) {
            media.deleteUpload(upload.filename);
            media.deleteUpload(upload.thumb);
          }
          throw error;
        }

        req.flash(
          'success',
          `${memorial.full_name} ya tiene su memorial. Te entregamos su enlace, código QR y certificado de propiedad.`
        );
        return res.redirect(`/panel/memoriales/${memorial.id}?creado=1`);
      } catch (error) {
        cleanupTemp(req.file);
        return next(error);
      }
    })();
  })
);

/* -------------------------------------------------------- editar memorial */

router.get('/memoriales/:id', loadMemorialOwned, asyncHandler(async (req, res, next) => {
  try {
    const memorial = req.memorial;
    const photos = store.listPhotos(memorial.id);
    const guestbook = store.listGuestbook(memorial.id, { limit: 200, includeHidden: true });
    const publicUrl = `${util.baseUrl(req)}/m/${memorial.slug}`;
    const qrInline = await qrDataUrl(publicUrl, { margin: 0, width: 480 });
    res.render('panel/editar', {
      pageTitle: `${memorial.full_name} · Administrar memorial`,
      metaDescription: `Administra el memorial digital de ${memorial.full_name}.`,
      bodyClass: 'page-panel page-edit',
      memorial,
      photos,
      guestbook,
      publicUrl,
      qrInline,
      views: memorial.views,
      candleCount: store.countCandles(memorial.id),
      messageCount: store.countGuestbook(memorial.id),
      hiddenCount: guestbook.filter((g) => g.hidden).length,
      hasCustomMusic: !!memorial.music_path,
      span: util.yearsLabel(memorial),
      creado: req.query.creado === '1',
      errors: []
    });
  } catch (error) {
    next(error);
  }
}));

router.post('/memoriales/:id', loadMemorialOwned, (req, res) => {
  const { errors, values } = validateMemorial(req.body);
  if (errors.length) {
    req.flash('error', errors[0]);
    return res.redirect(`/panel/memoriales/${req.memorial.id}#detalles`);
  }
  store.updateMemorial(req.memorial.id, values);
  req.flash('success', 'Los datos del memorial se guardaron.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#detalles`);
});

router.post('/memoriales/:id/enlace', loadMemorialOwned, (req, res) => {
  // Sin texto no se toca el enlace: `slugify('')` devuelve «memorial» y
  // borraría la dirección actual del memorial.
  const requested = String(req.body.slug || '').trim();
  const slug = requested ? util.slugify(requested) : '';
  if (slug.length < 3) {
    req.flash('error', 'El enlace debe tener al menos 3 caracteres (letras, números o guiones).');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#compartir`);
  }
  if (['panel', 'm', 'api', 'demo', 'certificado', 'admin', 'registro', 'ingresar', 'cuenta'].includes(slug)) {
    req.flash('error', 'Ese enlace está reservado. Prueba con otro.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#compartir`);
  }
  if (store.isSlugTaken(slug, req.memorial.id)) {
    req.flash('error', 'Ese enlace ya está en uso por otro memorial. Prueba con otro.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#compartir`);
  }
  store.changeSlug(req.memorial.id, slug);
  req.flash('success', 'El enlace del memorial se actualizó. Recuerda compartir el nuevo enlace y QR.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#compartir`);
});

/* --------------------------------------------------------------- fotos */

router.post('/memoriales/:id/foto-principal', loadMemorialOwned, photoSingle, csrfProtect, asyncHandler(async (req, res, next) => {
  try {
    if (!req.file) {
      req.flash('error', 'Selecciona una foto para usar como imagen principal.');
      return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
    }
    const remaining = config.maxPhotos - store.countPhotos(req.memorial.id);
    if (remaining <= 0) {
      cleanupTemp(req.file);
      req.flash('error', 'El memorial ya tiene sus 10 fotos. Elimina una para reemplazarla.');
      return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
    }
    const upload = await media.processImage(req.file.path);
    media.removeQuiet(req.file.path);
    const photoId = store.addPhoto(req.memorial.id, { filename: upload.filename, thumb: upload.thumb });
    const order = [photoId, ...store.listPhotos(req.memorial.id).filter((p) => p.id !== photoId).map((p) => p.id)];
    store.reorderPhotos(req.memorial.id, order);
    store.setMemorialMainPhoto(req.memorial.id, upload.filename, upload.thumb);
    req.flash('success', 'La foto principal se actualizó.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
  } catch (error) {
    cleanupTemp(req.file);
    if (error.status === 400) {
      req.flash('error', error.message);
      return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
    }
    return next(error);
  }
}));

router.post('/memoriales/:id/fotos', loadMemorialOwned, photoArray, csrfProtect, asyncHandler((req, res, next) => {
  const files = req.files || [];
  if (!files.length) {
    req.flash('error', 'Selecciona al menos una foto para subir.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
  }

  const existing = store.countPhotos(req.memorial.id);
  const remaining = Math.max(0, config.maxPhotos - existing);
  if (remaining <= 0) {
    cleanupTemp(files);
    req.flash('error', 'El memorial ya alcanzó el máximo de 10 fotos. Elimina una para subir otra.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
  }

  const selected = files.slice(0, remaining);
  const discarded = files.slice(remaining);
  cleanupTemp(discarded);

  (async () => {
    let added = 0;
    const failures = [];
    for (const file of selected) {
      try {
        const upload = await media.processImage(file.path);
        media.removeQuiet(file.path);
        store.addPhoto(req.memorial.id, { filename: upload.filename, thumb: upload.thumb });
        added += 1;
      } catch (error) {
        cleanupTemp(file);
        failures.push(error.message || 'Una foto no se pudo procesar.');
      }
    }

    let message = added
      ? `${added} ${added === 1 ? 'foto se agregó' : 'fotos se agregaron'} al memorial.`
      : 'No pudimos agregar las fotos.';
    if (discarded.length) message += ` Se omitieron ${discarded.length} por el límite de 10 fotos.`;
    if (failures.length) message += ` ${failures[0]}`;
    req.flash(added ? 'success' : 'error', message);
    return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
  })().catch(next);
}));

router.post('/memoriales/:id/fotos/:photoId/mover', loadMemorialOwned, (req, res) => {
  const photo = store.findPhoto(Number(req.params.photoId));
  if (!photo || photo.memorial_id !== req.memorial.id) {
    req.flash('error', 'La foto no existe.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
  }
  const direction = req.body.direction === 'up' ? -1 : 1;
  const order = store.listPhotos(req.memorial.id).map((item) => item.id);
  const index = order.indexOf(photo.id);
  const target = index + direction;
  if (index >= 0 && target >= 0 && target < order.length) {
    [order[index], order[target]] = [order[target], order[index]];
    store.reorderPhotos(req.memorial.id, order);
    req.flash('success', 'Cambiamos el orden de la galería.');
  }
  res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
});

router.post('/memoriales/:id/fotos/:photoId/principal', loadMemorialOwned, (req, res) => {
  const photo = store.findPhoto(Number(req.params.photoId));
  if (!photo || photo.memorial_id !== req.memorial.id) {
    req.flash('error', 'La foto no existe.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
  }
  const order = [photo.id, ...store.listPhotos(req.memorial.id).filter((p) => p.id !== photo.id).map((p) => p.id)];
  store.reorderPhotos(req.memorial.id, order);
  store.setMemorialMainPhoto(req.memorial.id, photo.filename, photo.thumb);
  req.flash('success', 'Esta foto ahora es la imagen principal del memorial.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
});

router.post('/memoriales/:id/fotos/:photoId/descripcion', loadMemorialOwned, (req, res) => {
  const photo = store.findPhoto(Number(req.params.photoId));
  if (!photo || photo.memorial_id !== req.memorial.id) {
    req.flash('error', 'La foto no existe.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
  }
  const caption = String(req.body.caption || '').trim().slice(0, 140);
  store.updatePhotoCaption(photo.id, caption);
  req.flash('success', 'La descripción de la foto se guardó.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
});

router.post('/memoriales/:id/fotos/:photoId/eliminar', loadMemorialOwned, (req, res) => {
  const photo = store.findPhoto(Number(req.params.photoId));
  if (!photo || photo.memorial_id !== req.memorial.id) {
    req.flash('error', 'La foto no existe.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
  }
  media.deleteUpload(photo.filename);
  media.deleteUpload(photo.thumb);
  store.deletePhoto(photo.id);
  if (req.memorial.main_photo === photo.filename) {
    const next = store.listPhotos(req.memorial.id)[0];
    if (next) {
      store.setMemorialMainPhoto(req.memorial.id, next.filename, next.thumb);
      store.reorderPhotos(req.memorial.id, [next.id, ...store.listPhotos(req.memorial.id).filter((p) => p.id !== next.id).map((p) => p.id)]);
    } else {
      store.setMemorialMainPhoto(req.memorial.id, null, null);
    }
  }
  req.flash('success', 'La foto se eliminó del memorial.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#fotos`);
});

/* --------------------------------------------------------------- video */

router.post('/memoriales/:id/video', loadMemorialOwned, videoSingle, csrfProtect, asyncHandler(async (req, res, next) => {
  try {
    if (!req.file) {
      req.flash('error', 'Selecciona un video MP4 o MOV de hasta 60 segundos.');
      return res.redirect(`/panel/memoriales/${req.memorial.id}#video`);
    }
    const upload = await media.saveVideo(req.file.path);
    if (req.memorial.video_path) media.deleteUpload(req.memorial.video_path);
    store.setMemorialVideo(req.memorial.id, upload.filename, upload.duration);
    req.flash('success', 'El video se subió correctamente.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#video`);
  } catch (error) {
    cleanupTemp(req.file);
    if (error.status === 400) {
      req.flash('error', error.message);
      return res.redirect(`/panel/memoriales/${req.memorial.id}#video`);
    }
    return next(error);
  }
}));

router.post('/memoriales/:id/video/eliminar', loadMemorialOwned, (req, res) => {
  if (req.memorial.video_path) media.deleteUpload(req.memorial.video_path);
  store.clearMemorialVideo(req.memorial.id);
  req.flash('success', 'El video se quitó del memorial.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#video`);
});

/* --------------------------------------------------------------- música */

router.post('/memoriales/:id/musica', loadMemorialOwned, audioSingle, csrfProtect, asyncHandler(async (req, res, next) => {
  try {
    if (!req.file) {
      req.flash('error', 'Selecciona un archivo MP3 para la música del memorial.');
      return res.redirect(`/panel/memoriales/${req.memorial.id}#musica`);
    }
    const upload = await media.saveAudio(req.file.path);
    if (req.memorial.music_path) media.deleteUpload(req.memorial.music_path);
    store.setMemorialMusic(req.memorial.id, upload.filename);
    req.flash('success', 'La música quedó guardada. Sonará cuando alguien abra el memorial.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#musica`);
  } catch (error) {
    cleanupTemp(req.file);
    if (error.status === 400) {
      req.flash('error', error.message);
      return res.redirect(`/panel/memoriales/${req.memorial.id}#musica`);
    }
    return next(error);
  }
}));

router.post('/memoriales/:id/musica/eliminar', loadMemorialOwned, (req, res) => {
  if (req.memorial.music_path) media.deleteUpload(req.memorial.music_path);
  store.setMemorialMusic(req.memorial.id, null);
  req.flash('success', 'Se quitó la música personalizada. El memorial usará la melodía suave por defecto.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#musica`);
});

/* --------------------------------------------------------- libro de visitas */

router.post('/memoriales/:id/libro/:entryId/ocultar', loadMemorialOwned, (req, res) => {
  const entry = store.findGuestbookEntry(Number(req.params.entryId));
  if (!entry || entry.memorial_id !== req.memorial.id) {
    req.flash('error', 'El mensaje no existe.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#libro`);
  }
  const hidden = req.path.endsWith('/mostrar') ? 0 : 1;
  store.setGuestbookHidden(entry.id, hidden);
  req.flash('success', hidden ? 'El mensaje quedó oculto del memorial público.' : 'El mensaje vuelve a estar visible.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#libro`);
});

router.post('/memoriales/:id/libro/:entryId/mostrar', loadMemorialOwned, (req, res) => {
  const entry = store.findGuestbookEntry(Number(req.params.entryId));
  if (!entry || entry.memorial_id !== req.memorial.id) {
    req.flash('error', 'El mensaje no existe.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#libro`);
  }
  store.setGuestbookHidden(entry.id, false);
  req.flash('success', 'El mensaje vuelve a estar visible.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#libro`);
});

router.post('/memoriales/:id/libro/:entryId/eliminar', loadMemorialOwned, (req, res) => {
  const entry = store.findGuestbookEntry(Number(req.params.entryId));
  if (!entry || entry.memorial_id !== req.memorial.id) {
    req.flash('error', 'El mensaje no existe.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#libro`);
  }
  store.deleteGuestbookEntry(entry.id);
  req.flash('success', 'El mensaje se eliminó definitivamente.');
  res.redirect(`/panel/memoriales/${req.memorial.id}#libro`);
});

/* ------------------------------------------------------- compartir / QR */

router.get('/memoriales/:id/compartir', loadMemorialOwned, asyncHandler(async (req, res, next) => {
  try {
    const publicUrl = `${util.baseUrl(req)}/m/${req.memorial.slug}`;
    const qrInline = await qrDataUrl(publicUrl, { margin: 0, width: 720 });
    res.render('panel/compartir', {
      pageTitle: 'Compartir memorial',
      metaDescription: 'Comparte el memorial con tu familia y amigos.',
      bodyClass: 'page-panel',
      memorial: req.memorial,
      publicUrl,
      qrInline,
      qrSvg: null,
      certificateUrl: `/panel/memoriales/${req.memorial.id}/certificado`
    });
  } catch (error) {
    next(error);
  }
}));

router.get('/memoriales/:id/qr.png', loadMemorialOwned, asyncHandler(async (req, res, next) => {
  try {
    const url = `${util.baseUrl(req)}/m/${req.memorial.slug}`;
    const buffer = await qrBuffer(url, { width: 1200, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr-${safeFileName(req.memorial.full_name)}.png"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}));

router.get('/memoriales/:id/exportar', loadMemorialOwned, (req, res) => {
  const data = store.exportMemorialData(req.memorial.id);
  if (!data) {
    const error = new Error('Memorial no encontrado');
    error.status = 404;
    return res.render('errors/404', {
      pageTitle: 'Memorial no disponible',
      metaDescription: 'El memorial que buscas no existe.',
      bodyClass: 'page-error'
    });
  }
  const payload = {
    generado_el: new Date().toISOString(),
    sitio: 'www.jardinmemorial.cl',
    titular: { nombre: req.user.name, email: req.user.email },
    memorial: {
      nombre: data.memorial.full_name,
      tipo: data.memorial.kind,
      relacion: data.memorial.relationship,
      nacimiento: data.memorial.birth_date,
      partida: data.memorial.death_date,
      epitafio: data.memorial.epitaph,
      historia: data.memorial.biography,
      enlace: `/m/${data.memorial.slug}`,
      certificado: data.memorial.certificate_code,
      creado: data.memorial.created_at
    },
    fotos: data.photos.map((photo) => ({
      descripcion: photo.caption,
      archivo: `/uploads/${photo.filename}`
    })),
    libro_de_visitas: data.guestbook.map((entry) => ({
      nombre: entry.name,
      ciudad: entry.city,
      mensaje: entry.message,
      vela: !!entry.candle,
      fecha: entry.created_at,
      visible: !entry.hidden
    })),
    velas: data.candles.length
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="memorial-${util.slugify(data.memorial.full_name)}.json"`
  );
  res.send(JSON.stringify(payload, null, 2));
});

router.get('/memoriales/:id/tarjeta', loadMemorialOwned, asyncHandler(async (req, res, next) => {
  try {
    const buffer = await generatePoster({ memorial: req.memorial, siteUrl: util.baseUrl(req) });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tarjeta-${safeFileName(req.memorial.full_name)}.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}));

router.get('/memoriales/:id/certificado', loadMemorialOwned, asyncHandler(async (req, res, next) => {
  try {
    const buffer = await generateCertificate({
      memorial: req.memorial,
      owner: req.user,
      siteUrl: util.baseUrl(req)
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="certificado-${safeFileName(req.memorial.full_name)}.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}));

/* --------------------------------------------------------------- eliminar */

router.post('/memoriales/:id/eliminar', loadMemorialOwned, (req, res) => {
  const confirmation = String(req.body.confirmation || '').trim();
  if (confirmation.toLowerCase() !== req.memorial.full_name.trim().toLowerCase()) {
    req.flash('error', 'Escribe el nombre exacto del memorial para confirmar su eliminación.');
    return res.redirect(`/panel/memoriales/${req.memorial.id}#ajustes`);
  }

  const photos = store.listPhotos(req.memorial.id);
  photos.forEach((photo) => {
    media.deleteUpload(photo.filename);
    media.deleteUpload(photo.thumb);
  });
  if (req.memorial.video_path) media.deleteUpload(req.memorial.video_path);
  if (req.memorial.music_path) media.deleteUpload(req.memorial.music_path);

  store.deleteMemorial(req.memorial.id);
  req.flash('success', `El memorial de ${req.memorial.full_name} se eliminó definitivamente.`);
  res.redirect('/panel');
});

module.exports = router;
