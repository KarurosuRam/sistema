'use strict';

const express = require('express');
const store = require('../store');
const { hashPassword, verifyPassword, createRateLimiter, csrfProtect } = require('../security');
const { startSession, endSession, afterLogin, requireGuest, requireAuth } = require('../auth');
const util = require('../util');
const { safeNextPath } = require('../util');
const config = require('../config');
const passwordReset = require('../password-reset');
const mailer = require('../mailer');
const {
  validateRegistration,
  validateLogin,
  validateProfile,
  validatePasswordChange,
  validatePasswordReset,
  isEmail
} = require('../validation');

const router = express.Router();

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: 'Demasiados intentos de ingreso. Espera 15 minutos antes de volver a intentarlo.',
  keyPrefix: 'login'
});
const recoveryLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 8,
  message: 'Pediste varios enlaces de recuperación. Espera unos minutos antes de intentarlo otra vez.',
  keyPrefix: 'recuperar'
});
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Se crearon demasiadas cuentas desde tu conexión. Inténtalo más tarde.',
  keyPrefix: 'register'
});

router.get('/registro', requireGuest, (req, res) => {
  res.render('auth/registro', {
    pageTitle: 'Crea tu cuenta',
    metaDescription: 'Crea tu cuenta en Jardín Memorial y comienza a preservar los recuerdos de tus seres queridos.',
    bodyClass: 'page-auth',
    activeNav: 'registro',
    errors: [],
    values: {},
    next: safeNextPath(req.query.next) || ''
  });
});

router.post('/registro', registerLimiter, requireGuest, csrfProtect, (req, res, next) => {
  const { errors, values } = validateRegistration(req.body);
  const nextPath = safeNextPath(req.body.next) || '';

  if (!errors.length && store.findUserByEmail(values.email)) {
    errors.push('Ya existe una cuenta con este correo. ¿Quieres ingresar?');
  }

  if (errors.length) {
    return res.status(422).render('auth/registro', {
      pageTitle: 'Crea tu cuenta',
      metaDescription: 'Crea tu cuenta en Jardín Memorial.',
      bodyClass: 'page-auth',
      activeNav: 'registro',
      errors,
      values: { name: values.name, email: values.email },
      next: nextPath
    });
  }

  try {
    const user = store.createUser({
      name: values.name,
      email: values.email,
      passwordHash: hashPassword(values.password)
    });
    const token = startSession(req, res, user.id);
    registerLimiter.reset(req);
    req.flash('success', `Te damos la bienvenida, ${user.name.split(' ')[0]}. Tu cuenta está lista: cuando quieras puedes crear tu primer memorial.`);
    return afterLogin(req, res, token, nextPath || '/');
  } catch (error) {
    return next(error);
  }
});

router.get('/ingresar', requireGuest, (req, res) => {
  res.render('auth/ingresar', {
    pageTitle: 'Ingresa a tu cuenta',
    metaDescription: 'Ingresa a tu cuenta de Jardín Memorial para administrar tus memoriales.',
    bodyClass: 'page-auth',
    activeNav: 'ingresar',
    errors: [],
    values: {},
    next: safeNextPath(req.query.next) || ''
  });
});

router.post('/ingresar', loginLimiter, requireGuest, csrfProtect, (req, res) => {
  const { errors, values } = validateLogin(req.body);
  const nextPath = safeNextPath(req.body.next) || '/';

  if (errors.length) {
    return res.status(422).render('auth/ingresar', {
      pageTitle: 'Ingresa a tu cuenta',
      metaDescription: 'Ingresa a tu cuenta de Jardín Memorial.',
      bodyClass: 'page-auth',
      activeNav: 'ingresar',
      errors,
      values: { email: values.email },
      next: nextPath === '/' ? '' : nextPath
    });
  }

  const user = store.findUserByEmail(values.email);
  if (!user || !verifyPassword(values.password, user.password_hash)) {
    return res.status(401).render('auth/ingresar', {
      pageTitle: 'Ingresa a tu cuenta',
      metaDescription: 'Ingresa a tu cuenta de Jardín Memorial.',
      bodyClass: 'page-auth',
      activeNav: 'ingresar',
      errors: ['El correo o la contraseña no son correctos.'],
      values: { email: values.email },
      next: nextPath === '/' ? '' : nextPath
    });
  }

  const token = startSession(req, res, user.id);
  loginLimiter.reset(req);
  req.flash('success', `Hola de nuevo, ${user.name.split(' ')[0]}. Ya estás dentro de tu cuenta.`);
  return afterLogin(req, res, token, nextPath);
});

router.post('/salir', requireAuth, csrfProtect, (req, res) => {
  endSession(req, res);
  req.flash('info', 'Tu sesión se cerró correctamente. Te esperamos pronto.');
  res.redirect('/');
});

/* ------------------------------------------------- recuperar contraseña -- */

/** Enlaces absolutos: el correo y el QR se leen fuera del sitio. */
function resetLink(req, token) {
  return `${util.baseUrl(req)}/restablecer/${encodeURIComponent(token)}`;
}

/**
 * Las páginas de recuperación nunca se indexan y el token no viaja como
 * referente a ningún otro sitio (va en la URL).
 */
function privacidadRecuperacion(req, res, next) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  return next();
}

router.use(['/recuperar', '/restablecer'], privacidadRecuperacion);

router.get('/recuperar', (req, res) => {
  if (req.user) return res.redirect('/cuenta');
  res.render('auth/recuperar', {
    pageTitle: 'Recuperar tu contraseña',
    metaDescription: 'Pide un enlace para elegir una nueva contraseña en Jardín Memorial.',
    bodyClass: 'page-auth',
    activeNav: 'ingresar',
    errors: [],
    values: {},
    enviado: false,
    enlacePrueba: null,
    correoConfigurado: mailer.isConfigured()
  });
});

router.post('/recuperar', recoveryLimiter, csrfProtect, async (req, res, next) => {
  if (req.user) return res.redirect('/cuenta');

  const email = String(req.body.email || '').trim();
  const errors = [];
  if (!email) errors.push('Escribe el correo de tu cuenta.');
  else if (!isEmail(email)) errors.push('Escribe un correo válido.');

  if (errors.length) {
    return res.status(422).render('auth/recuperar', {
      pageTitle: 'Recuperar tu contraseña',
      metaDescription: 'Pide un enlace para elegir una nueva contraseña en Jardín Memorial.',
      bodyClass: 'page-auth',
      activeNav: 'ingresar',
      errors,
      values: { email },
      enviado: false,
      enlacePrueba: null,
      correoConfigurado: mailer.isConfigured()
    });
  }

  const user = store.findUserByEmail(email);
  let enlacePrueba = null;

  // La respuesta es la misma exista o no la cuenta: así no se puede usar este
  // formulario para averiguar qué correos están registrados.
  if (user) {
    try {
      passwordReset.purgeOld();
      const { token, minutes } = passwordReset.createToken(user.id, { ip: req.ip });
      const link = resetLink(req, token);

      const envio = await mailer.sendPasswordReset({ user, link, minutes });
      // No se reinicia el límite al enviar: así nadie puede usar este formulario
      // para llenar de correos la bandeja de otra persona.
      if (!envio.sent) {
        if (envio.skipped) {
          console.log(`[recuperar] Sin correo configurado. Enlace para ${user.email}: ${link}`);
        }
        // En desarrollo o vista previa el enlace se muestra para poder probar el
        // circuito completo; en producción el dueño lo genera en el panel.
        if (process.env.NODE_ENV !== 'production') enlacePrueba = link;
      }
    } catch (error) {
      console.error('[recuperar]', error.message);
      return next(error);
    }
  }

  return res.render('auth/recuperar', {
    pageTitle: 'Revisa tu correo',
    metaDescription: 'Te enviamos un enlace para elegir una nueva contraseña.',
    bodyClass: 'page-auth',
    activeNav: 'ingresar',
    errors: [],
    values: { email },
    enviado: true,
    enlacePrueba,
    correoConfigurado: mailer.isConfigured()
  });
});

router.get('/restablecer/:token', (req, res) => {
  const row = passwordReset.findToken(req.params.token);
  if (!row) {
    return res.status(410).render('auth/restablecer', {
      pageTitle: 'Enlace vencido',
      metaDescription: 'El enlace para cambiar la contraseña ya no es válido.',
      bodyClass: 'page-auth',
      activeNav: 'ingresar',
      valido: false,
      token: '',
      valor: '',
      errors: []
    });
  }

  return res.render('auth/restablecer', {
    pageTitle: 'Elige una nueva contraseña',
    metaDescription: 'Elige una nueva contraseña para tu cuenta de Jardín Memorial.',
    bodyClass: 'page-auth',
    activeNav: 'ingresar',
    valido: true,
    token: req.params.token,
    valor: row.email,
    errors: []
  });
});

router.post('/restablecer/:token', recoveryLimiter, csrfProtect, (req, res) => {
  const row = passwordReset.findToken(req.params.token);
  if (!row) {
    return res.status(410).render('auth/restablecer', {
      pageTitle: 'Enlace vencido',
      metaDescription: 'El enlace para cambiar la contraseña ya no es válido.',
      bodyClass: 'page-auth',
      activeNav: 'ingresar',
      valido: false,
      token: '',
      valor: '',
      errors: []
    });
  }

  const { errors, values } = validatePasswordReset(req.body);
  if (errors.length) {
    return res.status(422).render('auth/restablecer', {
      pageTitle: 'Elige una nueva contraseña',
      metaDescription: 'Elige una nueva contraseña para tu cuenta de Jardín Memorial.',
      bodyClass: 'page-auth',
      activeNav: 'ingresar',
      valido: true,
      token: req.params.token,
      valor: row.email,
      errors
    });
  }

  // Se gasta el token antes de cambiar la clave: si dos pestañas envían el
  // formulario a la vez, solo la primera gana.
  if (!passwordReset.consumeToken(row.id)) {
    return res.status(410).render('auth/restablecer', {
      pageTitle: 'Enlace ya utilizado',
      metaDescription: 'El enlace para cambiar la contraseña ya fue utilizado.',
      bodyClass: 'page-auth',
      activeNav: 'ingresar',
      valido: false,
      token: '',
      valor: '',
      errors: []
    });
  }

  store.updateUserPassword(row.user_id, hashPassword(values.password));
  passwordReset.invalidateUser(row.user_id);
  // Cualquier sesión abierta con la clave anterior deja de valer.
  store.deleteUserSessions(row.user_id);

  recoveryLimiter.reset(req);
  req.flash('success', 'Tu contraseña se cambió. Ya puedes ingresar con la nueva.');
  return res.redirect('/ingresar');
});

router.get('/cuenta', requireAuth, (req, res) => {
  res.render('cuenta', {
    pageTitle: 'Mi cuenta',
    metaDescription: 'Administra tus datos y tu contraseña en Jardín Memorial.',
    bodyClass: 'page-account',
    activeNav: 'cuenta',
    errors: [],
    pwdErrors: [],
    values: { name: req.user.name },
    purchases: store.listPurchases(req.user.id, 50),
    memorialCount: store.listMemorialsByUser(req.user.id).length
  });
});

router.post('/cuenta', requireAuth, csrfProtect, (req, res) => {
  const { errors, values } = validateProfile(req.body);
  if (errors.length) {
    return res.status(422).render('cuenta', {
      pageTitle: 'Mi cuenta',
      metaDescription: 'Administra tus datos en Jardín Memorial.',
      bodyClass: 'page-account',
      activeNav: 'cuenta',
      errors,
      pwdErrors: [],
      values,
      purchases: store.listPurchases(req.user.id, 50),
      memorialCount: store.listMemorialsByUser(req.user.id).length
    });
  }
  store.updateUserProfile(req.user.id, values);
  req.flash('success', 'Tus datos se actualizaron.');
  res.redirect('/cuenta');
});

router.post('/cuenta/contrasena', requireAuth, csrfProtect, (req, res) => {
  const { errors, values } = validatePasswordChange(req.body);
  if (!errors.length && !verifyPassword(values.current, req.user.password_hash)) {
    errors.push('La contraseña actual no es correcta.');
  }
  if (errors.length) {
    return res.status(422).render('cuenta', {
      pageTitle: 'Mi cuenta',
      metaDescription: 'Administra tu contraseña en Jardín Memorial.',
      bodyClass: 'page-account',
      activeNav: 'cuenta',
      errors: [],
      pwdErrors: errors,
      values: { name: req.user.name },
      purchases: store.listPurchases(req.user.id, 50),
      memorialCount: store.listMemorialsByUser(req.user.id).length
    });
  }
  store.updateUserPassword(req.user.id, hashPassword(values.password));
  req.flash('success', 'Tu contraseña se cambió correctamente.');
  res.redirect('/cuenta');
});

module.exports = router;
