'use strict';

const express = require('express');
const store = require('../store');
const { hashPassword, verifyPassword, createRateLimiter, csrfProtect } = require('../security');
const { startSession, endSession, requireGuest, requireAuth } = require('../auth');
const { safeNextPath } = require('../util');
const { validateRegistration, validateLogin, validateProfile, validatePasswordChange } = require('../validation');

const router = express.Router();

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: 'Demasiados intentos de ingreso. Espera 15 minutos antes de volver a intentarlo.',
  keyPrefix: 'login'
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
    startSession(req, res, user.id);
    registerLimiter.reset(req);
    req.flash('success', `Te damos la bienvenida, ${user.name.split(' ')[0]}. Tu cuenta está lista: cuando quieras puedes crear tu primer memorial.`);
    return res.redirect(nextPath || '/');
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

  startSession(req, res, user.id);
  loginLimiter.reset(req);
  req.flash('success', `Hola de nuevo, ${user.name.split(' ')[0]}. Ya estás dentro de tu cuenta.`);
  return res.redirect(nextPath);
});

router.post('/salir', requireAuth, csrfProtect, (req, res) => {
  endSession(req, res);
  req.flash('info', 'Tu sesión se cerró correctamente. Te esperamos pronto.');
  res.redirect('/');
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
