/* Jardín Memorial — interacciones generales */
(function () {
  'use strict';

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ------------------------------------------------------------- header */
  var header = $('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --------------------------------------------------------------- nav */
  var navToggle = $('[data-nav-toggle]');
  var nav = $('#site-nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('nav-open', open);
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  /* ----------------------------------------------------------- reveals */
  var reveals = $$('.reveal');
  if (reveals.length) {
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      reveals.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      reveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  }

  /* -------------------------------------------------------------- flash */
  $$('.flash').forEach(function (flash, index) {
    var close = $('.flash__close', flash);
    var hide = function () {
      if (flash.classList.contains('is-hiding')) return;
      flash.classList.add('is-hiding');
      window.setTimeout(function () {
        if (flash.parentNode) flash.parentNode.removeChild(flash);
      }, 380);
    };
    if (close) close.addEventListener('click', hide);
    window.setTimeout(hide, 6200 + index * 600);
  });


  /* ------------------------------------------------ cookies en vista previa */
  (function () {
    // Solo tiene sentido dentro de un marco (la vista previa). Fuera de él las
    // cookies son de primera parte y no hay nada que avisar.
    var embedded = window.self !== window.top;
    if (!embedded || typeof window.fetch !== 'function') return;

    var showBar = function (message) {
      if (document.querySelector('.cookie-warning')) return;

      var bar = document.createElement('div');
      bar.className = 'cookie-warning';
      bar.setAttribute('role', 'alert');

      var text = document.createElement('span');
      text.textContent = message;

      var action = document.createElement('a');
      action.href = window.location.href;
      action.target = '_blank';
      action.rel = 'noopener';
      action.textContent = 'Abrir en una pestaña nueva';

      bar.appendChild(text);
      bar.appendChild(action);
      document.body.insertBefore(bar, document.body.firstChild);
    };

    // Se pregunta al servidor qué cookies recibió: es la comprobación real,
    // no una suposición a partir de document.cookie.
    window
      .fetch('/api/sonda', { credentials: 'include', cache: 'no-store' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        if (data && !data.cookies) {
          showBar(
            'Esta vista previa bloquea las cookies de sesión, así que los formularios no pueden guardar tu cuenta. Ábrela en una pestaña nueva para ingresar, crear la cuenta o probar la demo.'
          );
        }
      })
      .catch(function () {
        /* si la sonda falla no se muestra nada */
      });
  })();

  /* ------------------------------------------------- errores de formulario */
  (function () {
    var errors = $('.form-errors');
    if (!errors) return;
    // Si el envío falló, el aviso debe quedar a la vista aunque la página
    // vuelva a cargar con el formulario desplazado.
    try {
      errors.setAttribute('tabindex', '-1');
      errors.focus({ preventScroll: true });
      errors.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (_) {
      /* navegador antiguo: sin desplazamiento */
    }
  })();

  /* ------------------------------------------------------------ confirm */
  $$('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      var message = form.getAttribute('data-confirm') || '¿Confirmas esta acción?';
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    });
  });

  /* --------------------------------------------------------------- copy */
  $$('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      var selector = button.getAttribute('data-copy');
      var target = selector ? document.querySelector(selector) : null;
      var value = target ? (target.value || target.textContent) : button.getAttribute('data-copy-value');
      if (!value) return;

      var done = function () {
        var original = button.getAttribute('data-copy-label') || button.textContent;
        if (button.tagName === 'BUTTON') {
          button.classList.add('is-copied');
          var label = $('.copy-label', button);
          if (label) {
            var previous = label.textContent;
            label.textContent = 'Copiado';
            window.setTimeout(function () {
              label.textContent = previous;
            }, 2200);
          } else if (button.getAttribute('data-copy-text') === 'true') {
            button.textContent = 'Copiado';
            window.setTimeout(function () {
              button.textContent = original;
            }, 2200);
          }
        }
        if (window.jmToast) window.jmToast('Enlace copiado al portapapeles', 'success');
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(value).then(done).catch(function () {
          fallbackCopy(value, done);
        });
      } else {
        fallbackCopy(value, done);
      }
    });
  });

  function fallbackCopy(value, done) {
    var area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } catch (error) {
      /* silencioso */
    }
    document.body.removeChild(area);
  }

  /* ---------------------------------------------------------- toasts */
  var toastHost = null;
  window.jmToast = function (message, type) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'flash-stack';
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
    var toast = document.createElement('div');
    toast.className = 'flash flash--' + (type || 'info');
    toast.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><div></div>';
    toast.querySelector('div').textContent = message;
    toastHost.appendChild(toast);
    window.setTimeout(function () {
      toast.classList.add('is-hiding');
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 380);
    }, 3200);
  };

  /* -------------------------------------------------------- file inputs */
  $$('[data-file-zone]').forEach(function (zone) {
    var input = $('input[type="file"]', zone);
    var output = $('[data-file-name]', zone);
    var submitTarget = zone.getAttribute('data-file-zone');
    var submit = submitTarget ? document.querySelector(submitTarget) : null;
    if (!input) return;

    var update = function () {
      var files = input.files;
      if (!files || !files.length) {
        if (output) {
          output.classList.remove('is-visible');
          output.textContent = '';
        }
        if (submit) submit.disabled = true;
        return;
      }
      if (submit) submit.disabled = false;
      if (output) {
        var names = Array.prototype.map.call(files, function (f) {
          return f.name;
        });
        var text = names.length > 2 ? names.slice(0, 2).join(', ') + ' y ' + (names.length - 2) + ' más' : names.join(', ');
        output.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span></span>';
        output.querySelector('span').textContent = text;
        output.classList.add('is-visible');
      }

      var previewSelector = zone.getAttribute('data-preview');
      var preview = previewSelector ? document.querySelector(previewSelector) : null;
      if (preview && files[0] && /^image\//.test(files[0].type)) {
        var reader = new FileReader();
        reader.onload = function (event) {
          if (preview.tagName === 'IMG') {
            preview.src = event.target.result;
            preview.classList.remove('is-hidden');
          } else {
            preview.style.backgroundImage = 'url(' + event.target.result + ')';
          }
        };
        reader.readAsDataURL(files[0]);
      }
    };

    input.addEventListener('change', update);
    if (submit) submit.disabled = !input.files || !input.files.length;

    ['dragenter', 'dragover'].forEach(function (type) {
      zone.addEventListener(type, function (event) {
        event.preventDefault();
        zone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      zone.addEventListener(type, function (event) {
        event.preventDefault();
        zone.classList.remove('is-dragover');
      });
    });
    zone.addEventListener('drop', function (event) {
      if (event.dataTransfer && event.dataTransfer.files.length) {
        input.files = event.dataTransfer.files;
        update();
      }
    });
  });

  /* ----------------------------------------------------------- counters */
  $$('[data-counter]').forEach(function (input) {
    var target = document.querySelector(input.getAttribute('data-counter'));
    if (!target) return;
    var max = input.getAttribute('maxlength') || 160;
    var update = function () {
      target.textContent = input.value.length + ' / ' + max;
      target.classList.toggle('is-limit', input.value.length > Number(max) * 0.9);
    };
    update();
    input.addEventListener('input', update);
  });

  /* --------------------------------------------------------------- print */
  $$('[data-print]').forEach(function (button) {
    button.addEventListener('click', function () {
      window.print();
    });
  });

  /* ----------------------------------------------------- password toggle */
  $$('[data-toggle-password]').forEach(function (button) {
    button.addEventListener('click', function () {
      var target = document.querySelector(button.getAttribute('data-toggle-password'));
      if (!target) return;
      var show = target.type === 'password';
      target.type = show ? 'text' : 'password';
      button.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      button.classList.toggle('is-on', show);
    });
  });

  /* -------------------------------------------------------- subnav active */
  var subnavLinks = $$('.subnav a[href^="#"]');
  if (subnavLinks.length && 'IntersectionObserver' in window) {
    var sections = subnavLinks
      .map(function (link) {
        return document.querySelector(link.getAttribute('href'));
      })
      .filter(Boolean);

    var setActive = function (id) {
      subnavLinks.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
      });
    };

    var sectionObserver = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (entry) {
            return entry.isIntersecting;
          })
          .sort(function (a, b) {
            return a.boundingClientRect.top - b.boundingClientRect.top;
          });
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }
})();
