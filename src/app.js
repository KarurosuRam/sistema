'use strict';

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');

const config = require('./config');
const store = require('./store');
const util = require('./util');
const { sessionLoader, flashMiddleware, COOKIE } = require('./auth');
const { csrfCreate } = require('./security');
const media = require('./media');
const { icon, brandMark } = require('./icons');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const panelRoutes = require('./routes/panel');
const memorialRoutes = require('./routes/memorial');

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

app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(expressLayouts);
app.set('layout', 'layout');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
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
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
  next();
});

app.use(flashMiddleware);
app.use(sessionLoader);
app.use(csrfCreate);

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
  res.locals.activeNav = '';
  res.locals.hideFooter = false;
  next();
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, service: 'jardin-memorial', time: new Date().toISOString() });
});

app.use('/', publicRoutes);
app.use('/', authRoutes);
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
