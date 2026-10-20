'use strict';

const config = require('./config');
const { parseDateOnly } = require('./util');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function isEmail(value) {
  return EMAIL_RE.test(String(value || '').trim()) && String(value).trim().length <= 190;
}

function validateRegistration(body) {
  const errors = [];
  const name = clean(body.name, 80);
  const email = clean(body.email, 190).toLowerCase();
  const password = String(body.password || '');
  const confirm = String(body.password_confirm || '');

  if (name.length < 2) errors.push('Escribe tu nombre completo.');
  if (!isEmail(email)) errors.push('Ingresa un correo electrónico válido.');
  if (password.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres.');
  if (password !== confirm) errors.push('Las contraseñas no coinciden.');
  if (String(body.website || '').trim()) errors.push('No pudimos validar el formulario.');

  return { errors, values: { name, email, password } };
}

function validateLogin(body) {
  const errors = [];
  const email = clean(body.email, 190).toLowerCase();
  const password = String(body.password || '');
  if (!email) errors.push('Ingresa tu correo.');
  if (!password) errors.push('Ingresa tu contraseña.');
  return { errors, values: { email, password } };
}

function validateProfile(body) {
  const errors = [];
  const name = clean(body.name, 80);
  if (name.length < 2) errors.push('Escribe tu nombre completo.');
  return { errors, values: { name } };
}

function validatePasswordChange(body) {
  const errors = [];
  const current = String(body.current_password || '');
  const password = String(body.new_password || '');
  const confirm = String(body.new_password_confirm || '');
  if (!current) errors.push('Ingresa tu contraseña actual.');
  if (password.length < 8) errors.push('La nueva contraseña debe tener al menos 8 caracteres.');
  if (password !== confirm) errors.push('Las contraseñas nuevas no coinciden.');
  if (current && password && current === password) errors.push('La nueva contraseña debe ser distinta a la actual.');
  return { errors, values: { current, password } };
}

function validateMemorial(body) {
  const errors = [];
  const kind = body.kind === 'mascota' ? 'mascota' : 'persona';
  const fullName = clean(body.full_name, 90).replace(/\s+/g, ' ');
  const relationship = clean(body.relationship, 70);
  const birthDate = clean(body.birth_date, 10);
  const deathDate = clean(body.death_date, 10);
  const epitaph = clean(body.epitaph, 160).replace(/\s+/g, ' ');
  const biography = String(body.biography || '').trim().slice(0, 6000);
  const theme = config.themes[body.theme] ? body.theme : 'jardin';
  const isPublic = body.is_public === 'on' || body.is_public === '1' || body.is_public === 'true';
  const allowGuestbook = body.allow_guestbook === 'on' || body.allow_guestbook === '1' || body.allow_guestbook === 'true';

  if (fullName.length < 2) errors.push('Escribe el nombre de quien quieres recordar.');
  if (!birthDate && !deathDate) errors.push('Agrega al menos una fecha (nacimiento o partida) para el memorial.');
  if (birthDate && !parseDateOnly(birthDate)) errors.push('La fecha de nacimiento no es válida.');
  if (deathDate && !parseDateOnly(deathDate)) errors.push('La fecha de partida no es válida.');
  if (birthDate && deathDate) {
    const birth = parseDateOnly(birthDate);
    const death = parseDateOnly(deathDate);
    if (birth && death) {
      const birthTime = Date.UTC(birth.year, birth.month - 1, birth.day);
      const deathTime = Date.UTC(death.year, death.month - 1, death.day);
      if (deathTime < birthTime) errors.push('La fecha de partida no puede ser anterior al nacimiento.');
      if (death.year - birth.year > 130) errors.push('Revisa las fechas: el rango supera los 130 años.');
    }
  }
  if (epitaph.length > 160) errors.push('La frase de recuerdo no puede superar los 160 caracteres.');

  return {
    errors,
    values: {
      kind,
      full_name: fullName,
      relationship,
      birth_date: birthDate || null,
      death_date: deathDate || null,
      epitaph,
      biography,
      theme,
      is_public: isPublic,
      allow_guestbook: allowGuestbook
    }
  };
}

function validateGuestbook(body) {
  const errors = [];
  const name = clean(body.name, 60).replace(/\s+/g, ' ');
  const city = clean(body.city, 60).replace(/\s+/g, ' ');
  const message = String(body.message || '').trim().slice(0, 1200);
  const candle = body.candle === 'on' || body.candle === '1';
  if (name.length < 2) errors.push('Escribe tu nombre.');
  if (message.length < 3) errors.push('Escribe unas palabras para el memorial.');
  if (message.length > 1200) errors.push('El mensaje no puede superar los 1200 caracteres.');
  if (String(body.website || '').trim()) errors.push('No pudimos validar el formulario.');
  return { errors, values: { name, city, message, candle } };
}

module.exports = {
  clean,
  isEmail,
  validateRegistration,
  validateLogin,
  validateProfile,
  validatePasswordChange,
  validateMemorial,
  validateGuestbook
};
