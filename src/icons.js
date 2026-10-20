'use strict';

/**
 * Iconos de línea (trazo 1.5) consistentes con la identidad visual.
 * Se exponen como helper `icon(nombre, tamaño, clase)` en las vistas.
 */
const PATHS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  'arrow-right': '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  'arrow-left': '<path d="M20 12H5"/><path d="m11 18-6-6 6-6"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.15-1.15"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v2"/><path d="M20 20h-3"/><path d="M14 20h2"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/><path d="m12 6.5.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.6l2-.3z"/>',
  certificate: '<path d="M6 3h9l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v6h6"/><path d="M8 13h5"/><path d="M8 16.5h3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/>',
  images: '<path d="M17 3H7a2 2 0 0 0-2 2v14"/><rect x="17" y="7" width="4" height="4" rx=".5"/><path d="M9 7h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="2"/><path d="m7 21 5-4 5 4"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>',
  'volume-off': '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M9 5v14"/><path d="M15 5v14"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="M8 7h8"/><path d="M8 10h5"/>',
  heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1.1-1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 22l7.8-7.6 1.1-1a5.5 5.5 0 0 0-.1-7.8z"/>',
  flame: '<path d="M12 22c4 0 7-2.8 7-6.6 0-4.4-4.4-7.3-4.4-11.4C11.8 6 10.5 8.3 10.5 10c0 1.4.6 2.4.6 2.4S9 11.5 9 9.2C7.2 11 5 13.2 5 15.4 5 19.2 8 22 12 22z"/>',
  candle: '<path d="M12 2c1.6 1.6 2.4 2.8 2.4 4a2.4 2.4 0 0 1-4.8 0c0-1.2.8-2.4 2.4-4z"/><rect x="8" y="10" width="8" height="11" rx="1"/><path d="M8 13h8"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>',
  shield: '<path d="m12 3 8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z"/><path d="m8.5 12 2.3 2.3 4.7-4.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 21c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M18 14.5c2 .9 3.5 2.7 3.5 5"/>',
  'user-plus': '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3.1-7 7-7 1.3 0 2.5.3 3.5.9"/><path d="M18 14v7"/><path d="M14.5 17.5h7"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 6.5L21 6"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
  whatsapp: '<path d="M20.5 11.6A8.5 8.5 0 0 1 7 19.3L3.5 20.5l1.3-3.4A8.5 8.5 0 1 1 20.5 11.6z"/><path d="M8.8 8.2c.3-.1.6 0 .8.4l.8 1.5c.2.3.1.6-.1.9l-.5.6c.7 1.4 1.8 2.4 3.3 3l.6-.6c.2-.2.5-.3.8-.2l1.6.7c.3.2.4.5.3.8-.4 1-1.4 1.5-2.4 1.4-3.3-.4-6-3-6.3-6.2-.1-1 .4-1.9 1.1-2.3z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  'map-pin': '<path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.8"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.5-.7L3 21l1.8-5.2A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.4 17.4 0 0 1-3 4.1"/><path d="M6.5 6.5C3.6 8.4 2 12 2 12s3.6 7 10 7a10.8 10.8 0 0 0 4.3-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4"/><path d="m8.6 13.5 6.8 4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.7l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  wallet: '<rect x="2.5" y="5" width="19" height="15" rx="2.5"/><path d="M2.5 10h19"/><path d="M16 15h2"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/>',
  leaf: '<path d="M20.5 3.5C11 3.5 4 8 4 15.5A4.5 4.5 0 0 0 8.5 20C16 20 20.5 13 20.5 3.5z"/><path d="M4 21C7 15 11.5 11 18 8.5"/>',
  flower: '<circle cx="12" cy="10" r="2.6"/><path d="M12 7.4c-1.5-4 2-6.4 3.4-3.2.9 2-.9 3-3.4 3.2z"/><path d="M14.6 10c4-1.5 6.4 2 3.2 3.4-2 .9-3-.9-3.2-3.4z"/><path d="M12 12.6c-1.5 4-5 2.4-3.4-.6.9-1.8 2.7-1.4 3.4.6z"/><path d="M9.4 10c-4-1.5-2.4-5 .6-3.4 1.8.9 1.4 2.7-.6 3.4z"/><path d="M12 14v8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9 6.3 6.3"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1 6.3 17.7"/><path d="m17.7 6.3 1.4-1.4"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>',
  sparkles: '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/><path d="M5 3.5 5.6 5 7 5.6 5.6 6.2 5 7.7 4.4 6.2 3 5.6 4.4 5z"/>',
  camera: '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M12 8S9.5 3 7 3a2.5 2.5 0 0 0 0 5z"/><path d="M12 8s2.5-5 5-5a2.5 2.5 0 0 1 0 5z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
  'more-horizontal': '<circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  'zoom-in': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6"/><path d="M8 11h6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>'
};

function icon(name, size, className) {
  const path = PATHS[name];
  if (!path) return '';
  const dimension = Number(size) || 20;
  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} width="${dimension}" height="${dimension}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

function brandMark(size, className) {
  const dimension = Number(size) || 40;
  const cls = className ? ` ${className}` : '';
  return `<svg class="brand__mark${cls}" width="${dimension}" height="${dimension}" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    <circle cx="24" cy="24" r="22.5" stroke="currentColor" stroke-width="1" opacity=".45"/>
    <path d="M24 39V19" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M24 27c-5.5.2-8.6-2.4-9-7.6 5.3-.4 8.5 2.2 9 7.6Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M24 21c.3-5.6 3.2-8.6 8.4-9.2.6 5.4-2.4 8.7-8.4 9.2Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M24 33c4.6.1 7.2-2 7.7-6.3-4.5-.3-7.2 1.9-7.7 6.3Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="24" cy="12" r="1.4" fill="currentColor"/>
  </svg>`;
}

module.exports = { icon, brandMark, PATHS };
