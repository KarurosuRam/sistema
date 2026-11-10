/* Cliente HTTP mínimo para la API de Amapola. */
(function () {
  'use strict';

  const TOKEN_KEY = 'amapola.token';
  // Respaldo en memoria por si el navegador bloquea localStorage (por ejemplo,
  // en un iframe de terceros o en modo privado estricto).
  let memoryToken = null;

  const API = {
    get token() {
      try {
        return localStorage.getItem(TOKEN_KEY) || memoryToken;
      } catch {
        return memoryToken;
      }
    },
    setToken(token) {
      memoryToken = token;
      try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
      } catch {}
    },
    async request(path, { method = 'GET', body, quiet = false } = {}) {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (API.token) headers.Authorization = `Bearer ${API.token}`;

      let res;
      try {
        res = await fetch('/api' + path, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw new Error('No pudimos conectar con el servidor. Revisa tu conexión.');
      }

      let data = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }

      if (!res.ok) {
        if (res.status === 401 && API.token) {
          API.setToken(null);
          if (!quiet) window.dispatchEvent(new CustomEvent('amapola:unauthorized'));
        }
        const err = new Error((data && data.error) || 'Ocurrió un error inesperado.');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    get(path, opts) {
      return API.request(path, opts);
    },
    post(path, body, opts) {
      return API.request(path, { ...opts, method: 'POST', body: body || {} });
    },
    patch(path, body, opts) {
      return API.request(path, { ...opts, method: 'PATCH', body: body || {} });
    },
  };

  window.API = API;
})();
