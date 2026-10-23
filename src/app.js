'use strict';

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const config = require('./config');
const store = require('./store');
const util = require('./util');
const { sessionLoader, flashMiddleware, COOKIE } = require('./auth');
const paymentsRoutes = require('./routes/payments');
const { install: installEmbedSession } = require('./embed-session');
const { csrfCreate } = require('./security');
const assets = require('./assets');
const media = require('./media');
const { icon, brandMark } = require('./icons');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const panelRoutes = require('./routes/panel');
const memorialRoutes = require('./routes/memorial');
const settings = require('./settings');

// Credenciales guardadas desde el panel (si las hay) antes de atender la
// primera petición. El entorno siempre tiene prioridad.
settings.apply();

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', config.viewsDir);

app.use(
  express.static(config.publicDir, {
    maxAge: '7d',
    setHeaders(res, filePath) {
      if (/\.(woff2?|jpg|jpeg|png|webp|svg|mp3|ico)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
    }
  })
);

app.use(
  '/uploads',
  express.static(config.uploadsDir, {
    maxAge: '30d',
    immutable: true,
    fallthrough: true,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  })
);

// Diagnóstico opcional de la vista previa: registra host, protocolo y referer.
if (process.env.DEBUG_REQUESTS === '1') {
  app.use((req, res, next) => {
    const safeUrl = req.originalUrl.replace(/([?&])s=[^&]*/g, '$1s=…');
    console.log(
      `[req] ${req.method} ${safeUrl} host=${req.get('host') || '-'} ` +
        `xfp=${req.get('x-forwarded-proto') || '-'} xfh=${req.get('x-forwarded-host') || '-'} ` +
        `ref=${req.get('referer') || '-'}`
    );
    next();
  });
}

// Deja rastro de los errores en el log: ayuda a diagnosticar formularios que
// fallan en el navegador sin tener que reproducir el problema a ciegas.
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      // El token de sesión de la vista previa viaja en `s`: no se registra.
      const safeUrl = req.originalUrl.replace(/([?&])s=[^&]*/g, '$1s=…');
      console.log(`[${res.statusCode}] ${req.method} ${safeUrl}`);
    }
  });
  next();
});

app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(expressLayouts);
app.set('layout', 'layout');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!config.embedMode) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  );
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      `frame-ancestors 'self'${config.embedOrigins.length ? ' ' + config.embedOrigins.join(' ') : ''}`,
      "base-uri 'self'",
      // En la vista previa el formulario debe poder apuntar al host embebido
      // aunque el documento tenga un origen opaco (iframe con sandbox).
      `form-action 'self'${config.embedOrigins.length ? ' ' + config.embedOrigins.join(' ') : ''}`
    ].join('; ')
  );
  next();
});

app.use(flashMiddleware);
app.use(sessionLoader);
app.use(csrfCreate);
// Propaga la sesión por enlace cuando el navegador bloquea cookies en el iframe.
installEmbedSession(app);

app.use((req, res, next) => {
  res.locals.csrfToken = req.cookies.jm_csrf || '';
  res.locals.site = {
    name: config.siteName,
    domain: config.domain,
    email: config.contactEmail,
    instagram: config.instagram,
    whatsapp: config.whatsapp,
    url: util.baseUrl(req)
  };
  res.locals.currentPath = req.path;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.pageTitle = null;
  res.locals.metaDescription =
    'Crea un memorial digital para recordar a tus seres queridos y mascotas: enlace único, código QR, galería, música y certificado de propiedad.';
  res.locals.bodyClass = '';
  res.locals.ogImage = '/img/hero-garden.jpg';
  res.locals.extraCss = null;
  res.locals.extraJs = null;
  res.locals.query = req.query;
  res.locals.helpers = util;
  if (!res.locals.user) res.locals.user = null;
  res.locals.icon = icon;
  res.locals.brandMark = brandMark;
  res.locals.config = config;
  res.locals.assetVersion = assets.version;
  res.locals.activeNav = '';
  res.locals.hideFooter = false;

  // Integración con WordPress: la app se muestra dentro de una página del
  // sitio. `?embed=1` oculta el encabezado y el pie propios (el tema ya los
  // tiene) y deja una cookie para no perder ese modo al navegar.
  if (req.query.embed === '1') {
    res.cookie('jm_embed', '1', {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: false,
      sameSite: 'lax',
      secure: req.secure,
      path: '/'
    });
  } else if (req.query.embed === '0') {
    res.clearCookie('jm_embed', { path: '/' });
  }
  res.locals.embeddedView =
    req.query.embed === '1' || req.cookies.jm_embed === '1';
  // El encabezado y el pie propios se conservan dentro del iframe: la página de
  // WordPress usa una plantilla sin el encabezado del tema, así que la app
  // aporta la navegación. Para incrustarla en una página normal del tema (con
  // su propio encabezado) se pide `?chrome=0` —preferencia que se guarda en una
  // cookie para no perderla al navegar— o se fija EMBED_CHROME=1.
  const chromeParam = String(req.query.chrome || '');
  if (res.locals.embeddedView && (chromeParam === '0' || chromeParam === '1')) {
    res.cookie('jm_chrome', chromeParam, {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: false,
      sameSite: 'lax',
      secure: req.secure,
      path: '/'
    });
  }
  const chromePref =
    chromeParam === '0' || chromeParam === '1'
      ? chromeParam
      : String(req.cookies.jm_chrome || '');
  res.locals.chromeless =
    chromePref === '0' ? true : chromePref === '1' ? false : config.hideSiteChrome;
  res.locals.paymentsMode = config.paymentsMode;
  res.locals.payment = {
    provider: config.paymentProvider,
    name:
      config.paymentProvider === 'mercadopago'
        ? 'Mercado Pago'
        : config.paymentProvider === 'flow'
          ? 'Flow'
          : 'Demostración',
    warning: config.paymentWarning
  };
  res.locals.flowEnv = config.flow.env;
  res.locals.mpEnv = config.mercadopago.env;
  next();
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, service: 'jardin-memorial', time: new Date().toISOString() });
});

app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/', paymentsRoutes);
app.use('/panel', panelRoutes);
app.use('/m', memorialRoutes);

app.get('/sitemap.xml', (req, res, next) => {
  try {
    const base = util.baseUrl(req);
    const staticPaths = ['/', '/planes', '/como-funciona', '/memoriales', '/preguntas-frecuentes', '/registro'];
    const memorials = store.listPublicMemorials({ limit: 500 });
    const items = [
      ...staticPaths.map((p) => ({ loc: `${base}${p}`, priority: p === '/' ? '1.0' : '0.7' })),
      ...memorials.map((m) => ({ loc: `${base}/m/${m.slug}`, priority: '0.8', lastmod: m.updated_at }))
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
      .map(
        (item) =>
          `  <url><loc>${item.loc}</loc>${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : ''}<priority>${item.priority}</priority></url>`
      )
      .join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  } catch (error) {
    next(error);
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /panel\nDisallow: /ingresar\nSitemap: ${util.baseUrl(req)}/sitemap.xml\n`);
});

// 404
app.use((req, res) => {
  res.status(404).render('errors/404', {
    pageTitle: 'Página no encontrada',
    metaDescription: 'La página que buscas no existe o fue movida.',
    bodyClass: 'page-error'
  });
});

// Manejo central de errores
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const cleanup = [];
  if (req.file) cleanup.push(req.file.path);
  if (Array.isArray(req.files)) req.files.forEach((f) => cleanup.push(f.path));
  cleanup.forEach((f) => media.removeQuiet(f));

  const referer = req.get('referer');
  let backTo = '/panel';
  try {
    if (referer) {
      const parsed = new URL(referer);
      if (parsed.host === req.get('host')) backTo = parsed.pathname + parsed.search;
    }
  } catch (_) {
    /* noop */
  }

  // Sin referer confiable, volvemos a la pantalla de origen conocida.
  if (!referer) {
    const owned = /^\/panel\/memoriales\/(\d+)/.exec(req.path);
    if (owned) backTo = `/panel/memoriales/${owned[1]}`;
    else if (req.path.startsWith('/panel/comprar')) backTo = '/panel/planes';
    else if (req.path === '/panel/memoriales') backTo = '/panel/nuevo';
    else if (!req.path.startsWith('/panel')) backTo = '/';
  }

  const isUploadError =
    error instanceof require('multer').MulterError || error.status === 400 || error.status === 413;
  if (!req.user && (error.status === 400 || error instanceof require('multer').MulterError)) {
    backTo = req.path.startsWith('/registro') ? '/registro' : req.path;
  }

  if (error.csrf || isUploadError) {
    let message = error.message || 'No pudimos procesar el archivo.';
    if (error.code === 'LIMIT_FILE_SIZE') message = 'El archivo es demasiado grande para el límite permitido.';
    if (error.code === 'LIMIT_FILE_COUNT') message = 'Subiste más archivos de los permitidos.';
    if (error.code === 'LIMIT_UNEXPECTED_FILE') message = 'El tipo de archivo no es el esperado.';
    req.flash('error', message);
    return res.redirect(backTo);
  }

  if (error.status === 404) {
    return res.status(404).render('errors/404', {
      pageTitle: 'Memorial no disponible',
      metaDescription: 'El memorial que buscas no existe o es privado.',
      bodyClass: 'page-error',
      hideFooter: false
    });
  }

  if (error.status === 403) {
    return res.status(403).render('errors/403', {
      pageTitle: 'Acceso restringido',
      metaDescription: 'No tienes permisos para ver esta página.',
      bodyClass: 'page-error'
    });
  }

  if (error.status === 429) {
    return res.status(429).render('errors/429', {
      pageTitle: 'Demasiados intentos',
      metaDescription: 'Espera un momento antes de volver a intentarlo.',
      bodyClass: 'page-error',
      retryMessage: error.message
    });
  }

  console.error('[error]', req.method, req.originalUrl, error);
  return res.status(500).render('errors/500', {
    pageTitle: 'Algo salió mal',
    metaDescription: 'Ocurrió un error inesperado. Inténtalo nuevamente.',
    bodyClass: 'page-error'
  });
});

module.exports = app;
