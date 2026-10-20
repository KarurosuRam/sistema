/* Jardín Memorial — experiencia del memorial */
(function () {
  'use strict';

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* --------------------------------------------------------------- topbar */
  var top = $('.mem-top');
  if (top) {
    var onScroll = function () {
      top.classList.toggle('is-scrolled', window.scrollY > 80);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------- audio */
  var audio = $('#mem-audio');
  var audioBox = $('.mem-audio');
  var audioBtn = $('[data-audio-toggle]');
  var audioHint = $('[data-audio-hint]');
  var hintTimer = null;

  function setPlaying(playing) {
    if (!audioBox) return;
    audioBox.classList.toggle('is-playing', playing);
    if (audioBtn) {
      audioBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      var label = $('.mem-audio__label', audioBtn);
      if (label) label.textContent = playing ? 'Silenciar' : 'Escuchar';
      audioBtn.setAttribute('aria-label', playing ? 'Silenciar la música del memorial' : 'Reproducir la música del memorial');
    }
  }

  function showHint(message) {
    if (!audioHint) return;
    if (message) audioHint.textContent = message;
    audioHint.classList.add('is-visible');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(function () {
      audioHint.classList.remove('is-visible');
    }, 7000);
  }

  if (audio && audioBtn) {
    audio.volume = 0.55;

    var attemptPlay = function () {
      var promise = audio.play();
      if (promise && promise.catch) {
        promise
          .then(function () {
            setPlaying(true);
          })
          .catch(function () {
            setPlaying(false);
            showHint('Toca para escuchar la música de este memorial');
          });
      }
    };

    var startOnce = function () {
      attemptPlay();
      document.removeEventListener('pointerdown', startOnce);
      document.removeEventListener('keydown', startOnce);
    };

    audioBtn.addEventListener('click', function () {
      if (audio.paused) {
        audio.play().then(function () {
          setPlaying(true);
        }).catch(function () {
          showHint('Tu navegador bloqueó el audio. Vuelve a intentarlo.');
        });
      } else {
        audio.pause();
        setPlaying(false);
      }
      if (audioHint) audioHint.classList.remove('is-visible');
    });

    audio.addEventListener('play', function () {
      setPlaying(true);
    });
    audio.addEventListener('pause', function () {
      setPlaying(false);
    });

    attemptPlay();
    document.addEventListener('pointerdown', startOnce, { once: true });
    document.addEventListener('keydown', startOnce, { once: true });
  }

  /* ------------------------------------------------------------- lightbox */
  var photos = $$('[data-lightbox]');
  var lightbox = $('#lightbox');
  if (photos.length && lightbox) {
    var img = $('.lightbox__img', lightbox);
    var caption = $('.lightbox__caption', lightbox);
    var counter = $('.lightbox__counter', lightbox);
    var index = 0;
    var lastFocus = null;

    var render = function (i) {
      index = (i + photos.length) % photos.length;
      var figure = photos[index];
      var full = figure.getAttribute('data-src');
      img.src = full;
      img.alt = figure.getAttribute('data-alt') || '';
      var text = figure.getAttribute('data-caption') || '';
      caption.textContent = text;
      caption.style.display = text ? 'block' : 'none';
      counter.textContent = index + 1 + ' / ' + photos.length;
    };

    var open = function (i, trigger) {
      lastFocus = trigger || document.activeElement;
      render(i);
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      var closeBtn = $('.lightbox__close', lightbox);
      if (closeBtn) closeBtn.focus();
    };

    var close = function () {
      lightbox.classList.remove('is-open');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    photos.forEach(function (figure, i) {
      figure.addEventListener('click', function () {
        open(i, figure);
      });
    });

    $$('[data-lightbox-close]', lightbox).forEach(function (btn) {
      btn.addEventListener('click', close);
    });
    var prev = $('[data-lightbox-prev]', lightbox);
    var next = $('[data-lightbox-next]', lightbox);
    if (prev) prev.addEventListener('click', function () { render(index - 1); });
    if (next) next.addEventListener('click', function () { render(index + 1); });

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) close();
    });

    document.addEventListener('keydown', function (event) {
      if (!lightbox.classList.contains('is-open')) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') render(index - 1);
      if (event.key === 'ArrowRight') render(index + 1);
    });

    // Gestos en móvil
    var touchX = null;
    lightbox.addEventListener('touchstart', function (event) {
      touchX = event.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', function (event) {
      if (touchX === null) return;
      var delta = event.changedTouches[0].clientX - touchX;
      if (Math.abs(delta) > 50) render(index + (delta < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }

  /* ---------------------------------------------------------- share sheet */
  var shareBtn = $('[data-share-open]');
  var shareSheet = $('#share-sheet');
  if (shareBtn && shareSheet) {
    shareBtn.addEventListener('click', function () {
      shareSheet.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      var focusable = $('[data-share-close]', shareSheet);
      if (focusable) focusable.focus();
    });
    $$('[data-share-close]', shareSheet).forEach(function (btn) {
      btn.addEventListener('click', function () {
        shareSheet.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
    shareSheet.addEventListener('click', function (event) {
      if (event.target === shareSheet) {
        shareSheet.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && shareSheet.classList.contains('is-open')) {
        shareSheet.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  }

  /* --------------------------------------------------------------- copy */
  $$('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      var target = document.querySelector(button.getAttribute('data-copy'));
      var value = target ? target.value : button.getAttribute('data-copy-value');
      if (!value) return;
      var done = function () {
        button.classList.add('is-copied');
        if (window.jmToast) window.jmToast('Enlace copiado', 'success');
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(value).then(done).catch(function () {
          fallback(value, done);
        });
      } else {
        fallback(value, done);
      }
    });
  });

  function fallback(value, done) {
    var area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } catch (error) {
      /* noop */
    }
    document.body.removeChild(area);
  }

  /* ------------------------------------------------------------- candles */
  var candleForm = $('[data-candle-form]');
  if (candleForm) {
    candleForm.addEventListener('submit', function () {
      var row = $('.candle-row');
      if (!row) return;
      var candle = document.createElement('div');
      candle.className = 'candle';
      candle.innerHTML = '<span class="candle__flame"></span><span class="candle__stick"></span>';
      row.appendChild(candle);
      while (row.children.length > 36) row.removeChild(row.firstElementChild);
    });
  }

  /* ------------------------------------------------------- smooth anchors */
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = link.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  });
})();
