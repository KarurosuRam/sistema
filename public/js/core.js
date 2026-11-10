/* Núcleo de la aplicación: estado, utilidades, navegación y layout. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* Iconos                                                            */
  /* ---------------------------------------------------------------- */
  const PATHS = {
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    barChart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    money: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    flower: '<path d="M12 8.4c1.9 2.4 1.9 4.7 0 7.2-1.9-2.5-1.9-4.8 0-7.2Z"/><path d="M12 15.6c2.7-1.4 4.9-1.2 6.6 1-2.7.5-4.9.2-6.6-1Z"/><path d="M12 15.6c-1.7 1.2-3.9 1.5-6.6 1 1.7-2.2 3.9-2.4 6.6-1Z"/><path d="M12 15.6V21"/>',
    whatsapp: null, // se dibuja aparte (relleno)
  };

  function icon(name, cls = '') {
    if (name === 'whatsapp') {
      return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.2 5.07 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13c-1.48 0-2.93-.4-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24z"/></svg>`;
    }
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  }

  /* ---------------------------------------------------------------- */
  /* Estado                                                            */
  /* ---------------------------------------------------------------- */
  const state = {
    user: null,
    unread: 0,
    provider: null,
    services: [],
    staff: [],
    catalogLoaded: false,
  };

  const App = {
    state,
    pages: {},
    icons: icon,
  };
  window.App = App;

  /* ---------------------------------------------------------------- */
  /* Utilidades                                                        */
  /* ---------------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const moneyFmt = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  });
  const money = (n) => moneyFmt.format(Number(n) || 0);

  function parseISODate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }

  function longDate(iso, opts = {}) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('es-CL', {
      weekday: opts.weekday === false ? undefined : 'long',
      day: 'numeric',
      month: 'long',
      year: opts.year ? 'numeric' : undefined,
      timeZone: 'UTC',
    }).format(parseISODate(iso));
  }

  function shortDate(iso) {
    return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
      .format(parseISODate(iso))
      .replace('.', '');
  }

  function dateParts(iso) {
    const dt = parseISODate(iso);
    return {
      day: String(dt.getUTCDate()).padStart(2, '0'),
      month: new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' })
        .format(dt)
        .replace('.', '')
        .toUpperCase(),
      weekday: new Intl.DateTimeFormat('es-CL', { weekday: 'short', timeZone: 'UTC' })
        .format(dt)
        .replace('.', ''),
    };
  }

  function timeAgo(sqlDate) {
    if (!sqlDate) return '';
    const dt = new Date(String(sqlDate).replace(' ', 'T') + 'Z');
    const diff = (Date.now() - dt.getTime()) / 1000;
    if (diff < 60) return 'recién';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 172800) return 'ayer';
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
    return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'America/Santiago' }).format(dt);
  }

  const initials = (name) =>
    String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');

  const STATUS = {
    pending: { label: 'Pendiente', cls: 'pending' },
    confirmed: { label: 'Confirmada', cls: 'confirmed' },
    completed: { label: 'Completada', cls: 'completed' },
    cancelled: { label: 'Cancelada', cls: 'cancelled' },
  };
  const statusBadge = (status) => {
    const s = STATUS[status] || { label: status, cls: 'info' };
    return `<span class="badge badge--${s.cls}">${esc(s.label)}</span>`;
  };

  const WA_LABELS = {
    sent: { label: 'Enviado por WhatsApp', cls: 'sent', detail: 'Entregado a WhatsApp' },
    simulated: { label: 'Copia simulada', cls: 'simulated', detail: 'Guardado en el buzón de salida' },
    failed: { label: 'No se pudo enviar', cls: 'failed', detail: 'Error de envío' },
  };
  const waBadge = (status) => {
    if (!status) return '<span class="badge">Sin copia</span>';
    const s = WA_LABELS[status] || { label: status, cls: 'info' };
    return `<span class="badge badge--${s.cls} badge--icon">${icon('whatsapp')} ${esc(s.label)}</span>`;
  };

  function toast(message, type = 'info') {
    const root = $('#toast-root');
    const el = document.createElement('div');
    const ico = type === 'ok' ? 'checkCircle' : type === 'error' ? 'alert' : 'info';
    el.className = `toast toast--${type}`;
    el.innerHTML = `${icon(ico)}<span>${esc(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 260);
    }, 4600);
  }

  /* ---------------------------------------------------------------- */
  /* Modal                                                             */
  /* ---------------------------------------------------------------- */
  function openModal({ title, body, footer = '', wide = false, onMount }) {
    closeModal();
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal ${wide ? 'modal--wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal__head">
          <h2>${esc(title)}</h2>
          <button class="icon-close" data-action="close-modal" aria-label="Cerrar">${icon('x')}</button>
        </div>
        <div class="modal__body">${body}</div>
        ${footer ? `<div class="modal__foot">${footer}</div>` : ''}
      </div>`;
    $('#overlay-root').appendChild(wrap);
    document.body.classList.add('is-locked');
    if (onMount) onMount(wrap);
    return wrap;
  }

  function closeModal() {
    $('#overlay-root').innerHTML = '';
    document.body.classList.remove('is-locked');
  }

  function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false }) {
    return new Promise((resolve) => {
      openModal({
        title,
        body: `<p class="muted" style="font-size:14px">${esc(message)}</p>`,
        footer: `<button class="btn btn--ghost" data-dialog="cancel">Cancelar</button>
                 <button class="btn ${danger ? 'btn--danger' : ''}" data-dialog="ok">${esc(confirmLabel)}</button>`,
        onMount(wrap) {
          wrap.addEventListener('click', (e) => {
            if (e.target === wrap) {
              closeModal();
              resolve(false);
              return;
            }
            const btn = e.target.closest('[data-dialog]');
            if (!btn) return;
            closeModal();
            resolve(btn.dataset.dialog === 'ok');
          });
        },
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Layout                                                            */
  /* ---------------------------------------------------------------- */
  function navLinks(path) {
    const isAdmin = state.user?.role === 'admin';
    const link = (href, label, active, extra = '') =>
      `<a class="nav__link ${active ? 'is-active' : ''}" href="${href}" ${extra}>${esc(label)}</a>`;
    if (isAdmin) {
      return (
        link('#/admin', 'Panel', path.startsWith('admin')) +
        link('#/admin/agenda', 'Agenda', path === 'admin/agenda') +
        link('#/admin/mensajes', 'Mensajes', path === 'admin/mensajes') +
        link('#/', 'Ver sitio', path === '')
      );
    }
    return (
      link('#/', 'Servicios', false, 'data-scroll="servicios"') +
      link('#/', 'Equipo', false, 'data-scroll="equipo"') +
      link('#/reservar', 'Reservar', path === 'reservar') +
      (state.user
        ? link('#/mis-reservas', 'Mis reservas', path === 'mis-reservas') +
          `<a class="nav__link ${path === 'mensajes' ? 'is-active' : ''}" href="#/mensajes">Mensajes${
            state.unread ? `<span class="badge-dot">${state.unread}</span>` : ''
          }</a>`
        : '')
    );
  }

  function headerHTML(path) {
    const user = state.user;
    return `
    <header class="site-header" id="site-header">
      <div class="container nav">
        <a class="brand" href="#/">
          <span class="brand__mark">${icon('flower')}</span>
          <span class="brand__name">amapola</span>
          <span class="brand__tag">peluquería</span>
        </a>
        <nav class="nav__links">${navLinks(path)}</nav>
        <div class="nav__actions">
          ${user
            ? `<a class="nav__user" href="#/cuenta" title="Mi cuenta">
                 <span class="avatar">${esc(initials(user.name))}</span>
                 <span><span class="nav__user-name">${esc(user.name.split(' ')[0])}</span><span class="nav__user-role">${user.role === 'admin' ? 'Administración' : 'Clienta'}</span></span>
               </a>
               <button class="icon-btn" data-action="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon('logout')}</button>`
            : '<a class="btn btn--ghost btn--sm" href="#/login">Ingresar</a>'}
          ${user?.role === 'admin'
            ? ''
            : `<a class="btn btn--sm" href="#/reservar">Reservar hora</a>`}
          <button class="nav__toggle" data-action="toggle-menu" aria-label="Menú" aria-expanded="false">${icon('menu')}</button>
        </div>
      </div>
      <div class="mobile-menu" id="mobile-menu">
        ${navLinks(path)}
        ${user ? '<a href="#/cuenta">Mi cuenta</a><a href="#" data-action="logout">Cerrar sesión</a>' : '<a href="#/login">Ingresar</a>'}
        ${user?.role === 'admin' ? '<a href="#/admin">Panel de administración</a>' : ''}
      </div>
    </header>`;
  }

  function footerHTML() {
    return `
    <footer class="footer">
      <div class="container">
        <div class="footer__grid">
          <div>
            <div class="brand" style="margin-bottom:14px">
              <span class="brand__mark">${icon('flower')}</span>
              <span class="brand__name">amapola</span>
            </div>
            <p class="footer__note">Peluquería boutique en Providencia. Color, corte y cuidado capilar con atención personalizada desde 2014.</p>
            <p style="margin-top:18px">${`<span class="wa-pill">${icon('whatsapp')} Confirmaciones y recordatorios por WhatsApp</span>`}</p>
          </div>
          <div>
            <h4>Reservas</h4>
            <ul>
              <li><a href="#/reservar">Reservar una hora</a></li>
              <li><a href="#/mis-reservas">Mis reservas</a></li>
              <li><a href="#/mensajes">Mis mensajes</a></li>
              <li><a href="#/login">Iniciar sesión</a></li>
            </ul>
          </div>
          <div>
            <h4>Horario</h4>
            <ul>
              <li>Martes a viernes · 10:00 – 19:00</li>
              <li>Jueves y viernes · hasta 20:00</li>
              <li>Sábado · 10:00 – 17:00</li>
              <li class="muted">Domingo y lunes cerrado</li>
            </ul>
          </div>
          <div>
            <h4>Contacto</h4>
            <ul>
              <li>Av. Italia 1450, Providencia</li>
              <li>Santiago, Chile</li>
              <li><a href="tel:+56223456789">+56 2 2345 6789</a></li>
              <li><a href="mailto:hola@amapola.cl">hola@amapola.cl</a></li>
            </ul>
          </div>
        </div>
        <div class="footer__bottom">
          <span>© ${new Date().getFullYear()} Amapola Peluquería · Todos los derechos reservados.</span>
          <a href="#/admin">Acceso administración</a>
        </div>
      </div>
    </footer>`;
  }

  function paint(page, isAdminArea) {
    const app = $('#app');
    app.innerHTML = `${headerHTML(parseHash().path)}
      <main class="fade-up" id="main">${page.html}</main>
      ${isAdminArea ? '' : footerHTML()}`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ---------------------------------------------------------------- */
  /* Router                                                            */
  /* ---------------------------------------------------------------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    return { path: path || '', query: new URLSearchParams(query) };
  }

  const ROUTES = {
    '': 'home',
    inicio: 'home',
    reservar: 'booking',
    login: 'login',
    registro: 'register',
    'mis-reservas': 'myBookings',
    mensajes: 'myMessages',
    cuenta: 'account',
    admin: 'adminDashboard',
    'admin/agenda': 'adminAgenda',
    'admin/mensajes': 'adminMessages',
    'admin/clientas': 'adminClients',
    'admin/servicios': 'adminServices',
    'admin/equipo': 'adminTeam',
    'admin/envios': 'adminOutbox',
  };

  const PROTECTED = ['myBookings', 'myMessages', 'account'];
  const ADMIN_PAGES = ['adminDashboard', 'adminAgenda', 'adminMessages', 'adminClients', 'adminServices', 'adminTeam', 'adminOutbox'];

  let renderToken = 0;

  async function render() {
    const { path, query } = parseHash();
    const pageName = ROUTES[path] || 'notFound';
    const isAdminArea = ADMIN_PAGES.includes(pageName);

    if (PROTECTED.includes(pageName) && !state.user) {
      location.replace(`#/login?next=${encodeURIComponent(path)}`);
      return;
    }
    if (isAdminArea && state.user?.role !== 'admin') {
      toast('Inicia sesión como administración para ver el panel.', 'error');
      location.hash = state.user ? '#/' : `#/login?next=${encodeURIComponent(path)}`;
      return;
    }

    const token = ++renderToken;
    const app = $('#app');
    if (!app.innerHTML) {
      app.innerHTML = `${headerHTML(path)}<main>${loadingHTML()}</main>`;
    } else {
      app.innerHTML = `${headerHTML(path)}<main class="fade-up" id="main">${loadingHTML()}</main>${isAdminArea ? '' : footerHTML()}`;
    }

    if (!state.catalogLoaded) {
      try {
        const [svc, stf] = await Promise.all([API.get('/services'), API.get('/staff')]);
        state.services = svc.services;
        state.staff = stf.staff;
        state.catalogLoaded = true;
      } catch (err) {
        console.warn(err);
      }
    }
    if (token !== renderToken) return;

    const page = App.pages[pageName];
    if (!page) {
      paint({ html: notFoundHTML() }, false);
      return;
    }
    try {
      const result = await page({ query, path });
      if (token !== renderToken) return;
      paint(result, isAdminArea);
      if (result.mount) await result.mount($('#main'), { query, path });
    } catch (err) {
      console.error(err);
      paint(
        {
          html: `<div class="container section--tight"><div class="card" style="margin-top:32px"><h2 style="font-size:24px;margin-bottom:8px">Algo salió mal</h2><p class="muted">${esc(err.message)}</p><a class="btn" href="#/" style="margin-top:18px">Volver al inicio</a></div></div>`,
        },
        isAdminArea
      );
    }
  }

  function notFoundHTML() {
    return `<section class="container section"><h1 style="font-size:48px">404</h1><p class="muted">No encontramos esta página.</p><a href="#/" class="btn" style="margin-top:20px">Volver al inicio</a></section>`;
  }

  const loadingHTML = () =>
    '<div class="container"><div class="loading"><span class="spinner"></span><span>Cargando…</span></div></div>';

  function navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /* ---------------------------------------------------------------- */
  /* Eventos globales                                                  */
  /* ---------------------------------------------------------------- */
  function bindGlobal() {
    window.addEventListener('hashchange', render);

    document.addEventListener('click', async (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === 'toggle-menu') {
          const menu = $('#mobile-menu');
          const open = menu.classList.toggle('is-open');
          actionEl.setAttribute('aria-expanded', String(open));
          return;
        }
        if (action === 'close-modal') {
          e.preventDefault();
          closeModal();
          return;
        }
        if (action === 'logout') {
          e.preventDefault();
          try {
            await API.post('/auth/logout');
          } catch {}
          API.setToken(null);
          Object.assign(state, { user: null, unread: 0 });
          toast('Cerraste sesión. ¡Hasta pronto!', 'ok');
          navigate('#/');
          return;
        }
      }

      const scrollEl = e.target.closest('[data-scroll]');
      if (scrollEl) {
        e.preventDefault();
        const target = scrollEl.dataset.scroll;
        if (parseHash().path !== '') {
          location.hash = '#/';
          setTimeout(() => scrollToSection(target), 260);
        } else {
          scrollToSection(target);
        }
        $('#mobile-menu')?.classList.remove('is-open');
        return;
      }

      const backdrop = e.target.classList?.contains('modal-backdrop') ? e.target : null;
      if (backdrop) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    window.addEventListener(
      'scroll',
      () => {
        const header = $('#site-header');
        if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
      },
      { passive: true }
    );

    window.addEventListener('amapola:unauthorized', () => {
      Object.assign(state, { user: null, unread: 0 });
      toast('Tu sesión expiró. Vuelve a ingresar.', 'error');
      navigate('#/login');
    });
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------------------------------------------------------- */
  /* Arranque                                                          */
  /* ---------------------------------------------------------------- */
  async function boot() {
    bindGlobal();
    if (API.token) {
      try {
        const data = await API.get('/auth/me', { quiet: true });
        state.user = data.user;
        state.unread = data.unreadMessages || 0;
        state.provider = data.provider;
      } catch {
        API.setToken(null);
      }
    }
    if (!location.hash) location.replace('#/');
    render();
  }

  App.utils = {
    $,
    $$,
    esc,
    icon,
    money,
    longDate,
    shortDate,
    dateParts,
    timeAgo,
    initials,
    statusBadge,
    waBadge,
    toast,
    openModal,
    closeModal,
    confirmDialog,
    loadingHTML,
    navigate,
    render,
    parseHash,
    scrollToSection,
    refreshSession: async () => {
      const data = await API.get('/auth/me', { quiet: true });
      state.user = data.user;
      state.unread = data.unreadMessages || 0;
      state.provider = data.provider;
    },
  };

  window.addEventListener('DOMContentLoaded', boot);
})();
