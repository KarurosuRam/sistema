/* Jardín Memorial — comportamiento de la parte pública.
   Sin dependencias salvo qrcode.min.js, que solo se usa si hay un QR en la
   página. Todo se engancha con atributos data-* para no pelear con el tema. */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  /* ------------------------------------------------------------ confirmar */
  function bindConfirm() {
    document.querySelectorAll('form[data-jm-confirm]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        var message = form.getAttribute('data-jm-confirm') || '¿Confirmas esta acción?';
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      });
    });
  }

  /* ------------------------------------------------------------- lightbox */
  function bindLightbox() {
    var box = document.querySelector('[data-jm-lightbox]');
    if (!box) {
      return;
    }
    var image = box.querySelector('img');

    document.querySelectorAll('[data-jm-zoom]').forEach(function (item) {
      item.addEventListener('click', function () {
        var src = item.getAttribute('data-jm-zoom') || item.getAttribute('src');
        if (!src || !image) {
          return;
        }
        image.src = src;
        image.alt = item.getAttribute('alt') || '';
        box.setAttribute('data-open', '1');
      });
    });

    function close() {
      box.setAttribute('data-open', '0');
      image.removeAttribute('src');
    }

    box.addEventListener('click', close);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        close();
      }
    });
  }

  /* ------------------------------------------------------------------ QR */
  function bindQr() {
    document.querySelectorAll('[data-jm-qr]').forEach(function (holder) {
      var url = holder.getAttribute('data-jm-qr');
      if (!url || holder.getAttribute('data-jm-qr-done') === '1') {
        return;
      }
      holder.setAttribute('data-jm-qr-done', '1');

      if (typeof QRCode === 'undefined') {
        // Sin librería: se deja el enlace visible, que siempre funciona.
        holder.innerHTML = '<a href="' + url + '">' + url + '</a>';
        return;
      }

      new QRCode(holder, {
        text: url,
        width: 240,
        height: 240,
        colorDark: '#0a0a0a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    });
  }

  /* -------------------------------------------------------------- copiar */
  function bindCopy() {
    document.querySelectorAll('[data-jm-copy]').forEach(function (button) {
      button.addEventListener('click', function () {
        var value = button.getAttribute('data-jm-copy');
        var original = button.textContent;

        function done() {
          button.textContent = 'Copiado';
          setTimeout(function () {
            button.textContent = original;
          }, 1800);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(done, function () {
            window.prompt('Copia este enlace:', value);
          });
        } else {
          window.prompt('Copia este enlace:', value);
        }
      });
    });
  }

  /* --------------------------------------------------------------- audio */
  function bindAudio() {
    var player = document.querySelector('[data-jm-audio] audio');
    var toggle = document.querySelector('[data-jm-audio-toggle]');
    if (!player || !toggle) {
      return;
    }

    player.volume = 0.55;

    function paint() {
      toggle.textContent = player.paused ? '▶' : '❚❚';
      toggle.setAttribute('aria-label', player.paused ? 'Reproducir música' : 'Pausar música');
    }

    toggle.addEventListener('click', function () {
      if (player.paused) {
        player.play().catch(function () {});
      } else {
        player.pause();
      }
      paint();
    });

    player.addEventListener('play', paint);
    player.addEventListener('pause', paint);
    paint();

    // Los navegadores bloquean el audio automático: se intenta y, si falla, el
    // botón queda a la vista para que la persona lo active.
    player.play().catch(function () {});
  }

  /* --------------------------------------------------------- contador texto */
  function bindCounters() {
    document.querySelectorAll('[data-jm-maxlength]').forEach(function (field) {
      var max = parseInt(field.getAttribute('data-jm-maxlength'), 10);
      var target = document.querySelector(field.getAttribute('data-jm-counter'));
      if (!max || !target) {
        return;
      }
      function paint() {
        target.textContent = field.value.length + ' / ' + max;
      }
      field.addEventListener('input', paint);
      paint();
    });
  }

  ready(function () {
    bindConfirm();
    bindLightbox();
    bindQr();
    bindCopy();
    bindAudio();
    bindCounters();
  });
})();
