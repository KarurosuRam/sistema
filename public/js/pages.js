/* Páginas públicas y de clientas: inicio, acceso, reservas y mensajes. */
(function () {
  'use strict';

  const App = window.App;
  const { esc, icon, money, longDate, shortDate, dateParts, timeAgo, initials, statusBadge, waBadge, toast, openModal, confirmDialog, navigate } = App.utils;
  const { $, $$ } = App.utils;

  const DRAFT_KEY = 'amapola.bookingDraft';
  const todayISO = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return parts;
  };
  const addDays = (iso, n) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };
  const monthKey = (iso) => {
    const [y, m] = iso.split('-').map(Number);
    return { y, m };
  };

  /* ================================================================== */
  /* Inicio                                                             */
  /* ================================================================== */
  App.pages.home = async function () {
    const services = App.state.services.slice(0, 6);
    const staff = App.state.staff;

    const html = `
    <section class="hero">
      <div class="container">
        <div class="hero__grid">
          <div class="hero__copy">
            <span class="eyebrow">Peluquería boutique · Providencia</span>
            <h1>Tu próximo <em>look</em> empieza con una reserva.</h1>
            <p class="hero__lead">Elige tu servicio, tu estilista y la hora que más te acomode. Confirmamos en tu cuenta y te llega una copia a tu WhatsApp, para que no se te olvide nada.</p>
            <div class="hero__actions">
              <a class="btn" href="#/reservar">Reservar mi hora ${icon('arrowRight')}</a>
              <a class="btn btn--ghost" href="#/" data-scroll="servicios">Ver servicios</a>
            </div>
            <div class="hero__meta">
              <div class="hero__meta-item"><strong>+1.800</strong><span>clientas felices</span></div>
              <div class="hero__meta-item"><strong>4,9 ★</strong><span>valoración promedio</span></div>
              <div class="hero__meta-item"><strong>10 años</strong><span>cuidando tu cabello</span></div>
            </div>
          </div>
          <div class="hero__media">
            <img src="/img/hero.jpg" alt="Interior de la peluquería Amapola con una clienta frente al espejo" />
            <div class="hero__float">${icon('whatsapp', 'icon-wa')} Recordatorio enviado</div>
            <div class="hero__stamp">
              <span class="avatar">${esc(initials(staff[1]?.name || 'Fernanda'))}</span>
              <div>
                <strong>${esc(staff[1]?.name || 'Fernanda')} · ${esc(staff[1]?.specialty || 'Color')}</strong>
                <span>Hoy 16:00 · reserva confirmada</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="container">
        <div class="steps">
          <div class="step">
            <div class="step__num">1</div>
            <h3>Elige tu servicio</h3>
            <p>Corte, color, mechas o un tratamiento. Cada servicio muestra su duración y valor antes de reservar.</p>
          </div>
          <div class="step">
            <div class="step__num">2</div>
            <h3>Selecciona día y hora</h3>
            <p>Verás solo los horarios realmente disponibles según la agenda de cada estilista.</p>
          </div>
          <div class="step">
            <div class="step__num">3</div>
            <h3>Recibe tu copia</h3>
            <p>La confirmación queda en tu cuenta y una copia llega a tu WhatsApp, con todos los detalles.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="servicios">
      <div class="container">
        <div class="section__head">
          <span class="eyebrow">Servicios</span>
          <h2>Precios claros, sin sorpresas</h2>
          <p>Elige el servicio que necesitas y reserva en menos de un minuto. Todos incluyen asesoría personalizada.</p>
        </div>
        <div class="grid-3">
          ${services
            .map(
              (s) => `
            <article class="service-card">
              <div class="service-card__top">
                <h3>${esc(s.name)}</h3>
                <span class="service-card__price">${money(s.price)}</span>
              </div>
              <p>${esc(s.description)}</p>
              <div class="service-card__meta">
                <span class="row gap-4">${icon('clock')} ${s.duration} min</span>
                <span class="row gap-4">${icon('sparkle')} Incluye asesoría</span>
              </div>
              <div class="service-card__foot">
                <span class="small muted">Agenda disponible esta semana</span>
                <a class="btn btn--soft btn--sm" href="#/reservar?service=${s.id}">Reservar</a>
              </div>
            </article>`
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="container">
        <div class="wa-showcase">
          <div class="wa-showcase__grid">
            <div>
              <span class="eyebrow">Recordatorios automáticos</span>
              <h2>Tu cuenta y tu WhatsApp, siempre sincronizados.</h2>
              <p>Cada mensaje que el equipo escribe desde la administración —confirmaciones, recordatorios, promociones— queda guardado en tu cuenta y se envía como copia a tu WhatsApp.</p>
              <ul class="wa-list">
                <li>${icon('checkCircle')}<span><strong>Confirmación inmediata</strong> al reservar, con servicio, estilista, día y hora.</span></li>
                <li>${icon('bell')}<span><strong>Recordatorio el día anterior</strong> para que no se te pase la hora.</span></li>
                <li>${icon('message')}<span><strong>Mensajes del equipo</strong> visibles en tu cuenta, con la misma copia en tu teléfono.</span></li>
              </ul>
              <a class="btn btn--ghost" href="#/login" style="margin-top:26px;color:var(--cream);border-color:rgba(251,246,239,.3)">Ver mi cuenta</a>
            </div>
            <div>
              <div class="phone">
                <div class="phone__screen">
                  <div class="phone__bar">
                    <span class="avatar">A</span>
                    <div><div class="phone__name">Amapola Peluquería</div><div class="phone__status">cuenta de empresa oficial</div></div>
                  </div>
                  <div class="phone__chat">
                    <div class="bubble"><strong>Reserva recibida</strong>Hola María, recibimos tu reserva de Corte y secado con Fernanda el miércoles 12 de noviembre a las 16:00 hrs.<span class="bubble__time">10:00</span></div>
                    <div class="bubble bubble--out">¡Gracias! Ahí estaré 💛<span class="bubble__time">10:02 ✓✓</span></div>
                    <div class="bubble"><strong>Recordatorio de tu reserva</strong>Hola María, te esperamos mañana a las 16:00. Si no puedes venir, avísanos por aquí.<span class="bubble__time">09:00 ✓✓</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="equipo">
      <div class="container">
        <div class="section__head">
          <span class="eyebrow">El equipo</span>
          <h2>Manos expertas, trato cercano</h2>
          <p>Nuestro equipo se especializa en distintos estilos para que elijas a quien mejor te entienda.</p>
        </div>
        <div class="grid-3">
          ${staff
            .map(
              (s) => `
            <article class="card team-card">
              <div class="avatar avatar--staff" style="background:${esc(s.color)}22;color:${esc(s.color)}">${esc(initials(s.name))}</div>
              <h3 class="team-card__name">${esc(s.name)}</h3>
              <div class="team-card__spec">${esc(s.specialty)}</div>
              <p class="team-card__days">Martes a sábado · agenda abierta</p>
              <a class="link small" href="#/reservar?staff=${s.id}">Reservar con ${esc(s.name)}</a>
            </article>`
            )
            .join('')}
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="container">
        <div class="grid-3">
          <div class="card card--flat">
            <div class="row gap-8" style="color:var(--gold);margin-bottom:10px">${'★'.repeat(5)}</div>
            <p style="font-family:var(--serif);font-size:18px;line-height:1.4">“Reservé desde el celular en dos minutos y el recordatorio me llegó al WhatsApp. Impecable.”</p>
            <p class="small muted" style="margin-top:14px">Isidora M. · clienta desde 2021</p>
          </div>
          <div class="card card--flat">
            <div class="row gap-8" style="color:var(--gold);margin-bottom:10px">${'★'.repeat(5)}</div>
            <p style="font-family:var(--serif);font-size:18px;line-height:1.4">“Las mechas quedaron exactamente como las quería. Valentina entiende a la primera.”</p>
            <p class="small muted" style="margin-top:14px">Catalina R. · clienta desde 2019</p>
          </div>
          <div class="card card--flat">
            <div class="row gap-8" style="color:var(--gold);margin-bottom:10px">${'★'.repeat(5)}</div>
            <p style="font-family:var(--serif);font-size:18px;line-height:1.4">“Me encanta poder ver mis horas y los mensajes en un solo lugar. Súper ordenado.”</p>
            <p class="small muted" style="margin-top:14px">Javiera P. · clienta desde 2022</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:26px;flex-wrap:wrap;padding:38px 40px;background:linear-gradient(120deg,#fffdfa,#f6ece2)">
          <div>
            <h2 style="font-size:clamp(26px,3vw,34px);margin-bottom:8px">¿Te esperamos esta semana?</h2>
            <p class="muted">Quedan horas disponibles. Reserva y recibe la confirmación al instante.</p>
          </div>
          <a class="btn" href="#/reservar">Reservar hora ${icon('arrowRight')}</a>
        </div>
      </div>
    </section>`;

    return { html };
  };

  /* ================================================================== */
  /* Acceso                                                             */
  /* ================================================================== */
  function authShell({ title, subtitle, body, side = 'login' }) {
    return `
    <section class="auth">
      <div class="auth__aside">
        <img src="/img/${side === 'login' ? 'hero' : 'detail'}.jpg" alt="" />
        <div class="auth__aside-text">
          <blockquote>“El detalle que hace la diferencia está en cómo te sientes al salir.”</blockquote>
          <cite>Amapola Peluquería · Providencia</cite>
        </div>
      </div>
      <div class="auth__main">
        <div class="auth__box">
          <h1>${esc(title)}</h1>
          <p>${subtitle}</p>
          <div id="auth-error"></div>
          ${body}
        </div>
      </div>
    </section>`;
  }

  const DEMO_LOGIN = `
    <div class="demo-box">
      <div class="row between" style="margin-bottom:6px">
        <span class="tiny" style="color:var(--muted)">Cuentas de demostración</span>
      </div>
      <div class="demo-box__row">
        <span>Clienta · <code>cliente@demo.cl</code> / <code>cliente123</code></span>
        <button class="btn btn--ghost btn--xs" data-fill="cliente@demo.cl|cliente123">Usar</button>
      </div>
      <div class="demo-box__row">
        <span>Admin · <code>admin@amapola.cl</code> / <code>admin123</code></span>
        <button class="btn btn--ghost btn--xs" data-fill="admin@amapola.cl|admin123">Usar</button>
      </div>
    </div>`;

  App.pages.login = async function ({ query }) {
    const next = query.get('next') || '';
    const html = authShell({
      title: 'Hola de nuevo',
      subtitle: 'Ingresa para ver tus reservas y los mensajes de tu cuenta.',
      body: `
        <form id="login-form" novalidate>
          <label class="field">
            <span class="label">Correo electrónico</span>
            <input class="input" type="email" name="email" placeholder="tu@correo.cl" autocomplete="email" required />
          </label>
          <label class="field">
            <span class="label">Contraseña</span>
            <input class="input" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required />
          </label>
          <button class="btn btn--block" type="submit">Ingresar ${icon('arrowRight')}</button>
        </form>
        ${DEMO_LOGIN}
        <p class="small muted" style="margin-top:20px;text-align:center">
          ¿Primera vez por aquí? <a class="link" href="#/registro${next ? `?next=${encodeURIComponent(next)}` : ''}">Crea tu cuenta</a>
        </p>`,
      side: 'login',
    });

    return {
      html,
      mount(root) {
        const form = $('#login-form', root);
        $$('[data-fill]', root).forEach((btn) => {
          btn.addEventListener('click', () => {
            const [email, password] = btn.dataset.fill.split('|');
            form.email.value = email;
            form.password.value = password;
            form.querySelector('button[type=submit]').focus();
          });
        });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const box = $('#auth-error', root);
          box.innerHTML = '';
          const submit = form.querySelector('button[type=submit]');
          submit.disabled = true;
          submit.textContent = 'Ingresando…';
          try {
            const data = await API.post('/auth/login', {
              email: form.email.value,
              password: form.password.value,
            });
            API.setToken(data.token);
            App.state.user = data.user;
            await App.utils.refreshSession();
            toast(`¡Bienvenida ${data.user.name.split(' ')[0]}!`, 'ok');
            if (data.user.role === 'admin') navigate('#/admin');
            else if (next) navigate('#/' + next.replace(/^\/?#?\/?/, ''));
            else navigate('#/');
          } catch (err) {
            box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
            submit.disabled = false;
            submit.innerHTML = `Ingresar ${icon('arrowRight')}`;
          }
        });
      },
    };
  };

  App.pages.register = async function ({ query }) {
    const next = query.get('next') || '';
    const html = authShell({
      title: 'Crea tu cuenta',
      subtitle: 'Reserva más rápido y recibe cada mensaje en tu cuenta y en tu WhatsApp.',
      body: `
        <form id="register-form" novalidate>
          <label class="field">
            <span class="label">Nombre completo</span>
            <input class="input" name="name" placeholder="María González" autocomplete="name" required />
          </label>
          <div class="field-row">
            <label class="field">
              <span class="label">Correo</span>
              <input class="input" type="email" name="email" placeholder="tu@correo.cl" autocomplete="email" required />
            </label>
            <label class="field">
              <span class="label">WhatsApp</span>
              <input class="input" name="phone" placeholder="+56 9 8765 4321" autocomplete="tel" required />
            </label>
          </div>
          <label class="field">
            <span class="label">Contraseña</span>
            <input class="input" type="password" name="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password" required />
          </label>
          <p class="hint" style="margin:-4px 0 16px">Usaremos tu número solo para enviarte la copia por WhatsApp de las confirmaciones y mensajes del salón.</p>
          <button class="btn btn--block" type="submit">Crear cuenta ${icon('arrowRight')}</button>
        </form>
        <p class="small muted" style="margin-top:20px;text-align:center">
          ¿Ya tienes cuenta? <a class="link" href="#/login${next ? `?next=${encodeURIComponent(next)}` : ''}">Ingresa aquí</a>
        </p>`,
      side: 'register',
    });

    return {
      html,
      mount(root) {
        const form = $('#register-form', root);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const box = $('#auth-error', root);
          box.innerHTML = '';
          const submit = form.querySelector('button[type=submit]');
          submit.disabled = true;
          submit.textContent = 'Creando cuenta…';
          try {
            const data = await API.post('/auth/register', {
              name: form.name.value,
              email: form.email.value,
              phone: form.phone.value,
              password: form.password.value,
            });
            API.setToken(data.token);
            await App.utils.refreshSession();
            toast('¡Tu cuenta está lista! Te enviamos la bienvenida a tu WhatsApp.', 'ok');
            navigate(next ? '#/' + next.replace(/^\/?#?\/?/, '') : '#/reservar');
          } catch (err) {
            box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
            submit.disabled = false;
            submit.innerHTML = `Crear cuenta ${icon('arrowRight')}`;
          }
        });
      },
    };
  };

  /* ================================================================== */
  /* Reserva                                                            */
  /* ================================================================== */
  App.pages.booking = async function ({ query }) {
    let draft = {
      serviceId: null,
      staffId: null,
      date: null,
      time: null,
      notes: '',
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (saved && saved.serviceId) draft = { ...draft, ...saved };
    } catch {}
    if (query.get('service')) draft.serviceId = Number(query.get('service'));
    if (query.get('staff')) draft.staffId = Number(query.get('staff'));

    const services = App.state.services;
    const staff = App.state.staff;
    let availability = null;
    let monthCursor = monthKey(draft.date || todayISO());
    let busy = false;

    const save = () => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    };
    const selectedService = () => services.find((s) => s.id === Number(draft.serviceId)) || null;
    const selectedStaff = () => staff.find((s) => s.id === Number(draft.staffId)) || null;

    async function loadAvailability() {
      if (!draft.serviceId || !draft.date) {
        availability = null;
        return;
      }
      try {
        availability = await API.get(
          `/availability?date=${draft.date}&serviceId=${draft.serviceId}`
        );
      } catch {
        availability = null;
      }
    }

    function timeSlots() {
      if (!availability || availability.closed || !draft.staffId) return null;
      const member = availability.staff.find((s) => s.id === Number(draft.staffId));
      return member ? member.slots : [];
    }

    function calendarHTML() {
      const { y, m } = monthCursor;
      const first = new Date(Date.UTC(y, m - 1, 1));
      const startOffset = (first.getUTCDay() + 6) % 7; // lunes primero
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const today = todayISO();
      const maxDate = addDays(today, 60);
      const monthName = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(Date.UTC(y, m - 1, 15))
      );
      const canPrev = `${y}-${String(m).padStart(2, '0')}` > today.slice(0, 7);
      const canNext = `${y}-${String(m).padStart(2, '0')}` < maxDate.slice(0, 7);

      let cells = '';
      for (let i = 0; i < startOffset; i++) cells += '<div></div>';
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const disabled = iso < today || iso > maxDate || wd === 0 || wd === 1;
        const cls = [
          'mini-cal__day',
          iso === today ? 'is-today' : '',
          iso === draft.date ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        cells += `<button type="button" class="${cls}" data-date="${iso}" ${disabled ? 'disabled' : ''} title="${
          disabled ? 'Cerrado o no disponible' : longDate(iso)
        }">${d}</button>`;
      }

      return `
        <div class="mini-cal">
          <div class="mini-cal__head">
            <button type="button" class="mini-cal__nav" data-month="-1" ${canPrev ? '' : 'disabled'} aria-label="Mes anterior">${icon('chevronLeft')}</button>
            <span class="mini-cal__title">${esc(monthName)}</span>
            <button type="button" class="mini-cal__nav" data-month="1" ${canNext ? '' : 'disabled'} aria-label="Mes siguiente">${icon('chevronRight')}</button>
          </div>
          <div class="mini-cal__dow">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<div>${d}</div>`).join('')}</div>
          <div class="mini-cal__grid">${cells}</div>
          <p class="hint" style="margin-top:10px">Atendemos de martes a sábado. Los días en gris están cerrados.</p>
        </div>`;
    }

    function slotsHTML() {
      if (!draft.date) return '<div class="empty-state"><strong>Elige una fecha</strong>Selecciona un día en el calendario para ver los horarios disponibles.</div>';
      if (!draft.staffId)
        return `<div class="empty-state"><strong>Elige a tu estilista</strong>Los horarios dependen de la agenda de cada profesional.</div>`;
      if (availability?.closed)
        return `<div class="empty-state"><strong>Sin atención ese día</strong>${esc(availability.reason || '')}</div>`;
      const slots = timeSlots();
      if (!slots || !slots.length)
        return '<div class="empty-state"><strong>No quedan horas</strong>Ese día está completo para este servicio. Prueba con otra fecha o estilista.</div>';
      return `<div class="slot-grid">${slots
        .map(
          (t) =>
            `<button type="button" class="slot ${draft.time === t ? 'is-selected' : ''}" data-time="${t}">${t}</button>`
        )
        .join('')}</div>`;
    }

    function stepState(step) {
      const done = {
        1: !!draft.serviceId,
        2: !!draft.staffId,
        3: !!draft.time,
      }[step];
      const active =
        (step === 1 && !draft.serviceId) ||
        (step === 2 && draft.serviceId && !draft.staffId) ||
        (step === 3 && draft.serviceId && draft.staffId && !draft.time) ||
        (step === 4 && draft.time);
      return `${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`;
    }

    function bodyHTML() {
      const svc = selectedService();
      return `
        <div class="stepper">
          <div class="stepper__item ${stepState(1)}"><span>1</span> Servicio</div>
          <div class="stepper__item ${stepState(2)}"><span>2</span> Estilista</div>
          <div class="stepper__item ${stepState(3)}"><span>3</span> Fecha y hora</div>
          <div class="stepper__item ${stepState(4)}"><span>4</span> Confirmar</div>
        </div>

        <div class="panel">
          <div class="panel__head">
            <h2>¿Qué te vas a hacer?</h2>
            <span class="panel__step-label">Paso 1</span>
          </div>
          <div class="choice-grid">
            ${services
              .map(
                (s) => `
              <button type="button" class="choice ${Number(draft.serviceId) === s.id ? 'is-selected' : ''}" data-service="${s.id}">
                <div class="choice__title"><span>${esc(s.name)}</span><span class="choice__price">${money(s.price)}</span></div>
                <div class="choice__sub">${s.duration} min · ${esc(s.description).slice(0, 70)}</div>
              </button>`
              )
              .join('')}
          </div>
        </div>

        <div class="panel" ${!draft.serviceId ? 'style="opacity:.55"' : ''}>
          <div class="panel__head">
            <h2>¿Con quién?</h2>
            <span class="panel__step-label">Paso 2</span>
          </div>
          <div class="choice-grid">
            ${staff
              .map(
                (m) => `
              <button type="button" class="choice choice--staff ${Number(draft.staffId) === m.id ? 'is-selected' : ''}" data-staff="${m.id}" ${!draft.serviceId ? 'disabled' : ''}>
                <span class="avatar" style="background:${esc(m.color)}22;color:${esc(m.color)}">${esc(initials(m.name))}</span>
                <span>
                  <span class="choice__title">${esc(m.name)}</span>
                  <span class="choice__sub">${esc(m.specialty)}</span>
                </span>
              </button>`
              )
              .join('')}
          </div>
        </div>

        <div class="panel" ${!draft.staffId ? 'style="opacity:.55"' : ''}>
          <div class="panel__head">
            <h2>Fecha y hora</h2>
            <span class="panel__step-label">Paso 3</span>
          </div>
          ${draft.staffId ? `${calendarHTML()}${slotsHTML()}` : `<div class="empty-state"><strong>Primero elige a tu estilista</strong>Luego podrás ver su agenda disponible.</div>`}
        </div>`;
    }

    function summaryHTML() {
      const svc = selectedService();
      const member = selectedStaff();
      const ready = svc && member && draft.date && draft.time;
      return `
        <div class="card summary">
          <h3 style="font-size:20px;margin-bottom:4px">Tu reserva</h3>
          <p class="small muted" style="margin-bottom:16px">Revisa los detalles antes de confirmar.</p>
          <div class="summary__row"><span>Servicio</span><span>${svc ? esc(svc.name) : '—'}</span></div>
          <div class="summary__row"><span>Estilista</span><span>${member ? esc(member.name) : '—'}</span></div>
          <div class="summary__row"><span>Fecha</span><span>${draft.date ? esc(longDate(draft.date)) : '—'}</span></div>
          <div class="summary__row"><span>Hora</span><span>${draft.time ? esc(draft.time) + ' hrs' : '—'}</span></div>
          <div class="summary__row"><span>Duración</span><span>${svc ? svc.duration + ' min' : '—'}</span></div>
          <label class="field" style="margin-top:16px">
            <span class="label">Comentarios (opcional)</span>
            <textarea class="textarea" id="booking-notes" rows="3" placeholder="Alergias, referencias, si prefieres tijera…" style="min-height:74px">${esc(draft.notes)}</textarea>
          </label>
          <div class="summary__total"><span class="muted small">Valor referencial</span><strong>${svc ? money(svc.price) : '—'}</strong></div>
          <div class="summary__note">
            ${icon('whatsapp')}
            <span>Al confirmar, la reserva queda en <strong>tu cuenta</strong> y enviamos una copia a <strong>tu WhatsApp</strong>.</span>
          </div>
          ${
            App.state.user
              ? `<button class="btn btn--block" id="confirm-booking" ${ready ? '' : 'disabled'}>Confirmar reserva ${icon('check')}</button>
                 <p class="hint" style="text-align:center">Reservas como ${esc(App.state.user.name.split(' ')[0])} · ${esc(App.state.user.phone)}</p>`
              : `<a class="btn btn--block" href="#/login?next=reservar">Ingresar para confirmar</a>
                 <p class="hint" style="text-align:center">¿No tienes cuenta? <a class="link" href="#/registro?next=reservar">Créala aquí</a></p>`
          }
        </div>`;
    }

    function shellHTML() {
      return `
        <section class="container">
          <div class="page-head">
            <span class="eyebrow">Reserva en línea</span>
            <h1 style="margin-top:12px">Agenda tu visita</h1>
            <p>Elige servicio, estilista y horario. Nosotros nos encargamos del resto.</p>
          </div>
          <div class="booking-layout">
            <div id="booking-main">${bodyHTML()}</div>
            <div id="booking-side">${summaryHTML()}</div>
          </div>
        </section>`;
    }

    return {
      html: shellHTML(),
      mount(root) {
        const main = () => $('#main');

        async function repaint() {
          save();
          const host = $('#main');
          host.innerHTML = shellHTML();
          bind(host);
        }

        async function pickService(id) {
          if (draft.serviceId === id) return;
          draft.serviceId = id;
          draft.time = null;
          if (draft.date) await loadAvailability();
          await repaint();
          const el = $('#booking-main');
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        async function pickStaff(id) {
          draft.staffId = id;
          draft.time = null;
          if (draft.date) await loadAvailability();
          await repaint();
        }

        async function pickDate(iso) {
          draft.date = iso;
          draft.time = null;
          await loadAvailability();
          await repaint();
        }

        async function pickTime(time) {
          draft.time = time;
          await repaint();
        }

        async function confirmBooking() {
          if (!App.state.user) return navigate('#/login?next=reservar');
          if (busy) return;
          busy = true;
          const btn = $('#confirm-booking');
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'Confirmando…';
          }
          try {
            const notes = $('#booking-notes')?.value || draft.notes;
            const { appointment } = await API.post('/appointments', {
              serviceId: draft.serviceId,
              staffId: draft.staffId,
              date: draft.date,
              time: draft.time,
              notes,
            });
            try {
              sessionStorage.removeItem(DRAFT_KEY);
            } catch {}
            await App.utils.refreshSession();
            toast('¡Reserva creada! Enviamos la copia a tu WhatsApp.', 'ok');
            $('#main').innerHTML = successHTML(appointment);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch (err) {
            toast(err.message, 'error');
            busy = false;
            // el horario pudo ocuparse mientras tanto: refrescamos la disponibilidad
            await loadAvailability();
            await repaint();
          }
        }

        function successHTML(appt) {
          return `
          <section class="container section--tight">
            <div class="card" style="max-width:620px;margin:24px auto;text-align:center;padding:44px 36px">
              <div class="avatar avatar--lg" style="margin:0 auto 18px;background:var(--sage-soft);color:var(--sage)">${icon('check')}</div>
              <h1 style="font-size:32px;margin-bottom:10px">¡Reserva confirmada!</h1>
              <p class="muted" style="max-width:42ch;margin:0 auto 22px">Te esperamos. Enviamos los detalles a tu cuenta y una copia a tu WhatsApp al ${esc(App.state.user?.phone || '')}.</p>
              <div style="text-align:left;background:var(--cream);border-radius:var(--r);padding:18px 20px;margin-bottom:22px">
                <div class="summary__row"><span>Servicio</span><span>${esc(appt.service.name)}</span></div>
                <div class="summary__row"><span>Estilista</span><span>${esc(appt.staff.name)}</span></div>
                <div class="summary__row"><span>Fecha</span><span>${esc(appt.dateLabel)}</span></div>
                <div class="summary__row"><span>Hora</span><span>${esc(appt.time)} hrs</span></div>
                <div class="summary__row"><span>Estado</span><span>${statusBadge(appt.status)}</span></div>
              </div>
              <div class="row gap-8 center wrap">
                <a class="btn" href="#/mis-reservas">Ver mis reservas</a>
                <a class="btn btn--ghost" href="#/reservar" id="book-again">Reservar otra hora</a>
              </div>
              <p class="hint" style="margin-top:18px">¿Necesitas cambiarla? Escríbenos por WhatsApp o cancela desde tu cuenta.</p>
            </div>
          </section>`;
        }

        function bind(host) {
          $$('[data-service]', host).forEach((b) => b.addEventListener('click', () => pickService(Number(b.dataset.service))));
          $$('[data-staff]', host).forEach((b) => {
            if (!b.disabled) b.addEventListener('click', () => pickStaff(Number(b.dataset.staff)));
          });
          $$('[data-date]', host).forEach((b) => {
            if (!b.disabled) b.addEventListener('click', () => pickDate(b.dataset.date));
          });
          $$('[data-month]', host).forEach((b) => {
            if (b.disabled) return;
            b.addEventListener('click', () => {
              const delta = Number(b.dataset.month);
              const dt = new Date(Date.UTC(monthCursor.y, monthCursor.m - 1 + delta, 1));
              monthCursor = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1 };
              const active = document.activeElement;
              repaint().then(() => {
                if (active) document.querySelector(`[data-month="${delta}"]`)?.focus();
              });
            });
          });
          $$('[data-time]', host).forEach((b) => b.addEventListener('click', () => pickTime(b.dataset.time)));
          const notes = $('#booking-notes', host);
          if (notes) notes.addEventListener('input', () => { draft.notes = notes.value; });
          const confirm = $('#confirm-booking', host);
          if (confirm) confirm.addEventListener('click', confirmBooking);
        }

        bind(root);
        (async () => {
          if (draft.date && draft.serviceId) {
            await loadAvailability();
            // si el horario guardado ya no existe, lo limpiamos
            if (draft.time) {
              const slots = timeSlots() || [];
              if (!slots.includes(draft.time)) draft.time = null;
            }
            await repaint();
          }
        })();
      },
    };
  };

  /* ================================================================== */
  /* Mis reservas                                                       */
  /* ================================================================== */
  App.pages.myBookings = async function () {
    const { appointments } = await API.get('/appointments');
    const today = todayISO();
    const upcoming = appointments.filter(
      (a) => a.date >= today && (a.status === 'pending' || a.status === 'confirmed')
    );
    const history = appointments
      .filter((a) => !upcoming.includes(a))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    const card = (a, isUpcoming) => {
      const d = dateParts(a.date);
      const canCancel = isUpcoming;
      return `
      <article class="appt-card">
        <div class="appt-date"><strong>${d.day}</strong><span>${d.month}</span></div>
        <div class="appt-body">
          <div class="row between wrap gap-8">
            <h3>${esc(a.service.name)}</h3>
            ${statusBadge(a.status)}
          </div>
          <div class="appt-meta">
            <span>${icon('clock')} ${esc(a.time)} hrs · ${a.service.duration} min</span>
            <span>${icon('user')} ${esc(a.staff.name)}</span>
            <span>${icon('money')} ${money(a.service.price)}</span>
          </div>
          <p class="small muted" style="margin-top:6px">${esc(a.dateLabel)}</p>
          ${a.notes ? `<p class="small muted" style="margin-top:4px">“${esc(a.notes)}”</p>` : ''}
        </div>
        <div class="appt-actions">
          ${
            canCancel
              ? `<button class="btn btn--danger btn--sm" data-cancel="${a.id}">Cancelar</button>`
              : `<a class="btn btn--ghost btn--sm" href="#/reservar?service=${a.service.id}">Repetir</a>`
          }
        </div>
      </article>`;
    };

    const html = `
      <section class="container" style="padding-bottom:70px">
        <div class="account-head">
          <span class="avatar">${esc(initials(App.state.user.name))}</span>
          <div class="grow">
            <h1>Mis reservas</h1>
            <p class="muted small">${esc(App.state.user.name)} · ${esc(App.state.user.phone)}</p>
          </div>
          <a class="btn" href="#/reservar">Nueva reserva ${icon('plus')}</a>
        </div>
        <div class="tabs">
          <button class="tab is-active" data-tab="upcoming">Próximas (${upcoming.length})</button>
          <button class="tab" data-tab="history">Historial (${history.length})</button>
        </div>
        <div id="appt-upcoming">
          ${
            upcoming.length
              ? upcoming.map((a) => card(a, true)).join('')
              : `<div class="empty-state" style="background:var(--paper);border:1px dashed var(--line-strong);border-radius:var(--r)"><strong>No tienes reservas próximas</strong>Agenda tu próxima visita cuando quieras.<br><a class="btn btn--sm" href="#/reservar" style="margin-top:14px">Reservar hora</a></div>`
          }
        </div>
        <div id="appt-history" class="hidden">
          ${
            history.length
              ? history.map((a) => card(a, false)).join('')
              : '<div class="empty-state"><strong>Aún no hay historial</strong>Tus visitas anteriores aparecerán aquí.</div>'
          }
        </div>
      </section>`;

    return {
      html,
      mount(root) {
        $$('[data-tab]', root).forEach((tab) =>
          tab.addEventListener('click', () => {
            $$('[data-tab]', root).forEach((t) => t.classList.toggle('is-active', t === tab));
            $('#appt-upcoming', root).classList.toggle('hidden', tab.dataset.tab !== 'upcoming');
            $('#appt-history', root).classList.toggle('hidden', tab.dataset.tab !== 'history');
          })
        );

        $$('[data-cancel]', root).forEach((btn) =>
          btn.addEventListener('click', async () => {
            const ok = await confirmDialog({
              title: 'Cancelar reserva',
              message:
                'Podrás cancelar hasta 2 horas antes de tu hora. Si ya pasó ese plazo, escríbenos por WhatsApp.',
              confirmLabel: 'Sí, cancelar',
              danger: true,
            });
            if (!ok) return;
            try {
              await API.patch(`/appointments/${btn.dataset.cancel}`, { status: 'cancelled' });
              await App.utils.refreshSession();
              toast('Reserva cancelada.', 'ok');
              App.utils.render();
            } catch (err) {
              toast(err.message, 'error');
            }
          })
        );
      },
    };
  };

  /* ================================================================== */
  /* Mis mensajes                                                       */
  /* ================================================================== */
  App.pages.myMessages = async function () {
    const { messages } = await API.get('/messages');
    App.state.unread = messages.filter((m) => !m.read).length;

    function itemHTML(m, active) {
      return `
        <button class="msg-item ${m.read ? '' : 'is-unread'} ${active ? 'is-active' : ''}" data-msg="${m.id}">
          <div class="msg-item__top">
            <span class="msg-item__title">${esc(m.title)}</span>
            <span class="msg-item__date">${timeAgo(m.createdAt)}</span>
          </div>
          <div class="msg-item__preview">${esc(m.body)}</div>
        </button>`;
    }

    function detailHTML(m) {
      if (!m)
        return `<div class="empty-state"><strong>Sin mensajes</strong>Cuando el salón te escriba, lo verás aquí.</div>`;
      const wa = m.whatsapp;
      const waOk = wa && wa.status !== 'failed';
      return `
        <div class="inbox__detail-head">
          <div>
            <div class="row gap-8" style="margin-bottom:10px">
              <span class="badge badge--${esc(m.kind)}">${esc(m.kindLabel)}</span>
              ${waBadge(wa?.status)}
            </div>
            <h2>${esc(m.title)}</h2>
            <p class="small muted">${esc(new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santiago' }).format(new Date(String(m.createdAt).replace(' ', 'T') + 'Z')))}</p>
          </div>
        </div>
        <div class="msg-body">${esc(m.body)}</div>
        ${
          wa
            ? `<div class="wa-copy ${waOk ? '' : 'wa-copy--failed'}">
                 ${icon('whatsapp')}
                 <div>
                   <strong>${waOk ? 'Copia enviada a tu WhatsApp' : 'No pudimos enviar la copia'}</strong>
                   <span>${waOk ? `${esc(wa.phone)} · ${wa.status === 'simulated' ? 'modo demostración (revisa el buzón de salida)' : 'entregado'}` : esc(wa.error || 'Intenta contactar al salón.')}</span>
                 </div>
               </div>`
            : ''
        }
        <div style="margin-top:22px;padding-top:18px;border-top:1px solid var(--line)" class="row gap-8 wrap">
          <a class="btn btn--ghost btn--sm" href="#/reservar">Reservar hora</a>
          <a class="btn btn--ghost btn--sm" href="#/mis-reservas">Ver mis reservas</a>
        </div>`;
    }

    let selectedId = messages.find((m) => !m.read)?.id || messages[0]?.id || null;
    const selected = () => messages.find((m) => m.id === selectedId) || null;

    const html = `
      <section class="container" style="padding-bottom:70px">
        <div class="account-head">
          <div class="grow">
            <span class="eyebrow">Tu cuenta</span>
            <h1 style="margin-top:10px">Mensajes</h1>
            <p class="muted small">Confirmaciones, recordatorios y novedades del salón. Cada mensaje se envía también a tu WhatsApp.</p>
          </div>
          <button class="btn btn--ghost btn--sm" id="read-all" ${messages.some((m) => !m.read) ? '' : 'disabled'}>
            ${icon('check')} Marcar todo como leído
          </button>
        </div>
        ${
          messages.length
            ? `<div class="inbox">
                 <div class="inbox__list">
                   <div class="inbox__toolbar">
                     <span class="tiny" style="color:var(--muted)">${messages.length} mensajes</span>
                     <span class="badge badge--${messages.some((m) => !m.read) ? 'promotion' : 'info'}">${messages.filter((m) => !m.read).length} sin leer</span>
                   </div>
                   ${messages.map((m) => itemHTML(m, m.id === selectedId)).join('')}
                 </div>
                 <div class="inbox__detail" id="msg-detail">${detailHTML(selected())}</div>
               </div>`
            : `<div class="card" style="text-align:center;padding:50px 24px">
                 <div class="avatar avatar--lg" style="margin:0 auto 16px">${icon('bell')}</div>
                 <h2 style="font-size:24px;margin-bottom:8px">Todavía no tienes mensajes</h2>
                 <p class="muted">Cuando reserves o el equipo te escriba, lo verás aquí y también en tu WhatsApp.</p>
                 <a class="btn" href="#/reservar" style="margin-top:20px">Reservar hora</a>
               </div>`
        }
      </section>`;

    return {
      html,
      mount(root) {
        async function select(id) {
          selectedId = id;
          $$('[data-msg]', root).forEach((b) => b.classList.toggle('is-active', Number(b.dataset.msg) === id));
          const m = selected();
          $('#msg-detail', root).innerHTML = detailHTML(m);
          if (m && !m.read) {
            try {
              await API.post(`/messages/${m.id}/read`);
              m.read = true;
              const btn = $(`[data-msg="${m.id}"]`, root);
              btn?.classList.remove('is-unread');
              await App.utils.refreshSession();
              const badge = $('.inbox__toolbar .badge', root);
              if (badge) badge.textContent = `${messages.filter((x) => !x.read).length} sin leer`;
              const headerBadge = $('.nav__actions .badge-dot');
              if (headerBadge) {
                headerBadge.textContent = App.state.unread;
                if (!App.state.unread) headerBadge.remove();
              }
            } catch {}
          }
        }

        $$('[data-msg]', root).forEach((b) => b.addEventListener('click', () => select(Number(b.dataset.msg))));

        $('#read-all', root)?.addEventListener('click', async () => {
          try {
            await API.post('/messages/read-all');
            messages.forEach((m) => (m.read = true));
            await App.utils.refreshSession();
            toast('Todos los mensajes quedaron como leídos.', 'ok');
            App.utils.render();
          } catch (err) {
            toast(err.message, 'error');
          }
        });

        // marca como leído el mensaje abierto por defecto
        const initial = selected();
        if (initial && !initial.read) select(initial.id);
      },
    };
  };

  /* ================================================================== */
  /* Mi cuenta                                                          */
  /* ================================================================== */
  App.pages.account = async function () {
    const user = App.state.user;
    const provider = App.state.provider || {};
    const html = `
      <section class="container" style="padding-bottom:70px">
        <div class="account-head">
          <span class="avatar">${esc(initials(user.name))}</span>
          <div class="grow">
            <h1>Mi cuenta</h1>
            <p class="muted small">${esc(user.email)} · ${user.role === 'admin' ? 'Administración' : 'Clienta'}</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="#/mensajes">${icon('bell')} Mis mensajes</a>
        </div>
        <div class="grid-2" style="align-items:start">
          <div class="card">
            <h2 style="font-size:22px;margin-bottom:4px">Datos personales</h2>
            <p class="small muted" style="margin-bottom:20px">Tu número de WhatsApp se usa para enviarte la copia de cada mensaje.</p>
            <div id="account-error"></div>
            <form id="account-form">
              <label class="field"><span class="label">Nombre</span><input class="input" name="name" value="${esc(user.name)}" required /></label>
              <label class="field"><span class="label">Correo</span><input class="input" value="${esc(user.email)}" disabled /></label>
              <label class="field"><span class="label">WhatsApp</span><input class="input" name="phone" value="${esc(user.phone)}" required /></label>
              <label class="field"><span class="label">Nueva contraseña (opcional)</span><input class="input" type="password" name="password" placeholder="Déjalo vacío para no cambiarla" autocomplete="new-password" /></label>
              <button class="btn" type="submit">Guardar cambios</button>
            </form>
          </div>
          <div class="stack gap-16">
            <div class="card">
              <div class="row gap-12" style="margin-bottom:12px">
                <span class="avatar" style="background:#eaf7ee;color:#2f9e44">${icon('whatsapp')}</span>
                <div><h3 style="font-size:18px">Copias por WhatsApp</h3><p class="tiny" style="color:var(--muted)">${esc(provider.label || 'WhatsApp')}</p></div>
              </div>
              <p class="small muted">Recibirás en ${esc(user.phone)} una copia de cada confirmación, recordatorio o mensaje que el salón envíe a tu cuenta.</p>
              ${provider.live === false ? '<p class="hint" style="margin-top:10px">El sistema está en modo demostración: las copias se registran en el buzón de salida en lugar de enviarse.</p>' : ''}
            </div>
            <div class="card">
              <h3 style="font-size:18px;margin-bottom:12px">Accesos rápidos</h3>
              <div class="stack gap-8">
                <a class="btn btn--ghost btn--block" href="#/reservar">Reservar nueva hora</a>
                <a class="btn btn--ghost btn--block" href="#/mis-reservas">Ver mis reservas</a>
                ${user.role === 'admin' ? '<a class="btn btn--dark btn--block" href="#/admin">Ir al panel</a>' : ''}
              </div>
            </div>
          </div>
        </div>
      </section>`;

    return {
      html,
      mount(root) {
        const form = $('#account-form', root);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const box = $('#account-error', root);
          box.innerHTML = '';
          const btn = form.querySelector('button[type=submit]');
          btn.disabled = true;
          try {
            const payload = { name: form.name.value, phone: form.phone.value };
            if (form.password.value) payload.password = form.password.value;
            const { user: updated } = await API.patch('/auth/me', payload);
            App.state.user = updated;
            toast('Datos actualizados.', 'ok');
            App.utils.render();
          } catch (err) {
            box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
            btn.disabled = false;
          }
        });
      },
    };
  };
})();
