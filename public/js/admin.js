/* Panel de administración: agenda, mensajes con copia a WhatsApp, clientas y catálogo. */
(function () {
  'use strict';

  const App = window.App;
  const { esc, icon, money, longDate, shortDate, timeAgo, initials, statusBadge, waBadge, toast, openModal, closeModal, confirmDialog, navigate } = App.utils;
  const { $, $$ } = App.utils;

  const todayISO = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const addDays = (iso, n) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };

  const NAV = [
    { key: 'adminDashboard', href: '#/admin', label: 'Resumen', ico: 'grid' },
    { key: 'adminAgenda', href: '#/admin/agenda', label: 'Agenda', ico: 'calendar' },
    { key: 'adminMessages', href: '#/admin/mensajes', label: 'Mensajes', ico: 'message' },
    { key: 'adminClients', href: '#/admin/clientas', label: 'Clientas', ico: 'users' },
    { key: 'adminServices', href: '#/admin/servicios', label: 'Servicios', ico: 'scissors' },
    { key: 'adminTeam', href: '#/admin/equipo', label: 'Equipo', ico: 'sparkle' },
    { key: 'adminOutbox', href: '#/admin/envios', label: 'Envíos WhatsApp', ico: 'whatsapp' },
  ];

  function shell(activeKey, { title, subtitle, actions = '', content }) {
    return `
      <div class="admin-shell">
        <aside class="sidebar">
          <div class="sidebar__title">Administración</div>
          ${NAV.map(
            (n) => `<a class="side-link ${n.key === activeKey ? 'is-active' : ''}" href="${n.href}">
              ${icon(n.ico)}
              <span>${n.label}</span>
              ${n.key === 'adminMessages' && App.state.unread ? `<span class="badge-dot">${App.state.unread}</span>` : ''}
            </a>`
          ).join('')}
        </aside>
        <div class="dash-main">
          <div class="dash-head">
            <div>
              <h1>${esc(title)}</h1>
              <p>${esc(subtitle)}</p>
            </div>
            <div class="row gap-8 wrap">${actions}</div>
          </div>
          ${content}
        </div>
      </div>`;
  }

  /* ================================================================== */
  /* Utilidades compartidas                                             */
  /* ================================================================== */
  async function loadClients(q = '') {
    const { clients } = await API.get(`/admin/clients?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    return clients;
  }

  async function notifyStatus(appointmentId, status, label) {
    try {
      await API.patch(`/appointments/${appointmentId}`, { status, notify: true });
      toast(`${label}. Se avisó a la clienta por su cuenta y WhatsApp.`, 'ok');
      App.utils.render();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function openAppointmentDetail(appt) {
    const isPending = appt.status === 'pending';
    const isOpen = ['pending', 'confirmed'].includes(appt.status);
    openModal({
      title: appt.service.name,
      body: `
        <div class="row gap-8 wrap" style="margin-bottom:16px">${statusBadge(appt.status)}<span class="badge">${esc(appt.staff.name)}</span></div>
        <div class="summary__row"><span>Clienta</span><span>${esc(appt.user.name)}</span></div>
        <div class="summary__row"><span>Contacto</span><span>${esc(appt.user.phone)}</span></div>
        <div class="summary__row"><span>Fecha</span><span>${esc(appt.dateLabel)}</span></div>
        <div class="summary__row"><span>Hora</span><span>${esc(appt.time)} hrs · ${appt.service.duration} min</span></div>
        <div class="summary__row"><span>Valor</span><span>${money(appt.service.price)}</span></div>
        ${appt.notes ? `<p class="small muted" style="margin-top:14px;padding:12px;background:var(--cream);border-radius:10px">“${esc(appt.notes)}”</p>` : ''}`,
      wide: false,
      footer: `
        ${isPending ? `<button class="btn" data-act="confirmed">Confirmar reserva</button>` : ''}
        ${isOpen ? `<button class="btn btn--ghost" data-act="completed">Marcar completada</button>` : ''}
        ${isOpen ? `<button class="btn btn--danger" data-act="cancelled">Cancelar</button>` : ''}
        <a class="btn btn--dark" href="#/admin/mensajes?user=${appt.user.id}">Enviar mensaje</a>`,
      onMount(wrap) {
        $$('[data-act]', wrap).forEach((btn) =>
          btn.addEventListener('click', async () => {
            const status = btn.dataset.act;
            const labels = { confirmed: 'Reserva confirmada', completed: 'Reserva completada', cancelled: 'Reserva cancelada' };
            closeModal();
            await notifyStatus(appt.id, status, labels[status]);
          })
        );
      },
    });
  }

  async function openNewAppointmentModal({ date } = {}) {
    const [clientsData, srv, stf] = await Promise.all([
      API.get('/admin/clients?limit=100'),
      API.get('/services'),
      API.get('/staff'),
    ]);
    const clients = clientsData.clients;
    if (!clients.length) return toast('Primero debe existir al menos una clienta registrada.', 'error');
    const services = srv.services;
    const staff = stf.staff;

    const dateValue = date || todayISO();
    openModal({
      title: 'Nueva reserva',
      wide: true,
      body: `
        <div id="appt-form-error"></div>
        <div class="field-row">
          <label class="field"><span class="label">Clienta</span>
            <select class="select" id="appt-client">${clients
              .map((c) => `<option value="${c.id}">${esc(c.name)} · ${esc(c.phone)}</option>`)
              .join('')}</select>
          </label>
          <label class="field"><span class="label">Servicio</span>
            <select class="select" id="appt-service">${services
              .map((s) => `<option value="${s.id}">${esc(s.name)} · ${s.duration} min</option>`)
              .join('')}</select>
          </label>
        </div>
        <div class="field-row">
          <label class="field"><span class="label">Estilista</span>
            <select class="select" id="appt-staff">${staff
              .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
              .join('')}</select>
          </label>
          <label class="field"><span class="label">Fecha</span>
            <input class="input" type="date" id="appt-date" value="${dateValue}" min="${todayISO()}" max="${addDays(todayISO(), 60)}" />
          </label>
        </div>
        <label class="field"><span class="label">Hora disponible</span>
          <select class="select" id="appt-time"><option value="">Cargando horarios…</option></select>
        </label>
        <label class="field"><span class="label">Notas internas (opcional)</span>
          <input class="input" id="appt-notes" placeholder="Preferencias, alergias…" />
        </label>`,
      footer: `<button class="btn btn--ghost" data-action="close-modal">Cancelar</button>
               <button class="btn" id="appt-create">Crear reserva ${icon('check')}</button>`,
      onMount(wrap) {
        const sel = { client: $('#appt-client', wrap), service: $('#appt-service', wrap), staff: $('#appt-staff', wrap), date: $('#appt-date', wrap), time: $('#appt-time', wrap) };

        async function refreshSlots(keep) {
          sel.time.innerHTML = '<option value="">Cargando…</option>';
          try {
            const av = await API.get(`/availability?date=${sel.date.value}&serviceId=${sel.service.value}`);
            const member = av.staff.find((s) => s.id === Number(sel.staff.value));
            const slots = av.closed ? [] : member?.slots || [];
            sel.time.innerHTML = slots.length
              ? slots.map((t) => `<option value="${t}" ${keep === t ? 'selected' : ''}>${t} hrs</option>`).join('')
              : '<option value="">Sin horarios disponibles</option>';
          } catch {
            sel.time.innerHTML = '<option value="">Error al cargar horarios</option>';
          }
        }
        ['change'].forEach((evt) => {
          sel.service.addEventListener(evt, () => refreshSlots());
          sel.staff.addEventListener(evt, () => refreshSlots());
          sel.date.addEventListener(evt, () => refreshSlots());
        });
        refreshSlots();

        $('#appt-create', wrap).addEventListener('click', async () => {
          const btn = $('#appt-create', wrap);
          btn.disabled = true;
          try {
            await API.post('/appointments', {
              userId: Number(sel.client.value),
              serviceId: Number(sel.service.value),
              staffId: Number(sel.staff.value),
              date: sel.date.value,
              time: sel.time.value,
              notes: $('#appt-notes', wrap).value,
            });
            closeModal();
            toast('Reserva creada y mensaje enviado a la clienta.', 'ok');
            App.utils.render();
          } catch (err) {
            $('#appt-form-error', wrap).innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
            btn.disabled = false;
          }
        });
      },
    });
  }

  async function sendTomorrowReminders(triggerBtn) {
    const ok = await confirmDialog({
      title: 'Enviar recordatorios',
      message:
        'Se enviará un recordatorio a cada clienta con reserva mañana, en su cuenta y por WhatsApp. Quienes ya lo recibieron no se repiten.',
      confirmLabel: 'Enviar recordatorios',
    });
    if (!ok) return;
    if (triggerBtn) triggerBtn.disabled = true;
    try {
      const res = await API.post('/admin/reminders/tomorrow');
      if (!res.total) toast('No hay reservas agendadas para mañana.', 'info');
      else
        toast(
          `Recordatorios: ${res.sent} enviados, ${res.skipped} ya enviados${res.failed ? `, ${res.failed} fallidos` : ''}.`,
          res.failed ? 'error' : 'ok'
        );
      await App.utils.refreshSession();
      App.utils.render();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      if (triggerBtn) triggerBtn.disabled = false;
    }
  }

  function providerBanner(provider) {
    return `
      <div class="card" style="display:flex;gap:14px;align-items:flex-start;background:${provider?.live ? '#f1f8ec' : '#fdf7ea'};border-color:${provider?.live ? '#d9e8cf' : '#ecdfc4'}">
        <span class="avatar" style="background:${provider?.live ? '#e2f2d9' : '#f6ebd8'};color:${provider?.live ? '#3f7a2c' : '#8a6425'}">${icon('whatsapp')}</span>
        <div class="grow">
          <strong style="font-size:13.5px">${esc(provider?.label || 'WhatsApp')}${provider?.live ? '' : ' · modo demostración'}</strong>
          <p class="small muted" style="margin-top:2px">${esc(provider?.hint || '')}</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="#/admin/envios">Ver envíos</a>
      </div>`;
  }

  /* ================================================================== */
  /* Resumen                                                            */
  /* ================================================================== */
  App.pages.adminDashboard = async function () {
    const data = await API.get('/admin/stats');
    const { stats, week, upcoming, provider } = data;
    const max = Math.max(1, ...week.map((w) => w.count));
    const today = todayISO();

    const content = `
      ${providerBanner(provider)}
      <div class="stat-grid" style="margin-top:16px">
        <div class="stat">
          <div class="stat__label">${icon('calendar')} Reservas hoy</div>
          <div class="stat__value">${stats.todayCount}</div>
        </div>
        <div class="stat">
          <div class="stat__label">${icon('clock')} Por confirmar</div>
          <div class="stat__value">${stats.pending} <small>reservas</small></div>
        </div>
        <div class="stat">
          <div class="stat__label">${icon('message')} Mensajes sin leer</div>
          <div class="stat__value">${stats.unread} <small>en cuentas</small></div>
        </div>
        <div class="stat stat--accent">
          <div class="stat__label">${icon('money')} Facturado este mes</div>
          <div class="stat__value">${money(stats.revenue)}</div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="row between" style="margin-bottom:8px">
            <h2 style="font-size:19px">Próximas reservas</h2>
            <a class="link small" href="#/admin/agenda">Ver agenda</a>
          </div>
          ${upcoming.length
            ? upcoming
                .map((a) => {
                  const d = new Date(a.date + 'T12:00:00Z');
                  return `<button class="list-row" data-appt="${a.id}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left">
                    <span class="list-row__date"><strong>${String(d.getUTCDate()).padStart(2, '0')}</strong><span>${new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' }).format(d).replace('.', '')}</span></span>
                    <span class="list-row__body"><strong>${esc(a.user.name)} · ${esc(a.service.name)}</strong><span>${esc(a.time)} hrs · ${esc(a.staff.name)}</span></span>
                    ${statusBadge(a.status)}
                  </button>`;
                })
                .join('')
            : '<p class="empty-state" style="padding:24px">Sin reservas próximas.</p>'}
        </div>

        <div class="card">
          <div class="row between" style="margin-bottom:4px">
            <h2 style="font-size:19px">Agenda de la semana</h2>
            <span class="badge">${stats.weekCount} reservas</span>
          </div>
          <div class="chart">
            ${week
              .map(
                (w) => `<div class="chart__col" title="${esc(w.label)}: ${w.count} reservas">
                  <div class="chart__bar ${w.date === today ? 'is-today' : ''}" style="height:${Math.max(10, (w.count / max) * 100)}%">${w.count}</div>
                  <span class="chart__day ${w.date === today ? 'is-today' : ''}">${esc(w.short)}</span>
                </div>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="dash-grid" style="margin-top:20px">
        <div class="card">
          <h2 style="font-size:19px;margin-bottom:14px">Acciones rápidas</h2>
          <div class="row gap-8 wrap">
            <a class="btn btn--sm" href="#/admin/mensajes">${icon('send')} Enviar mensaje</a>
            <button class="btn btn--ghost btn--sm" id="reminders-btn">${icon('bell')} Recordatorios de mañana</button>
            <button class="btn btn--ghost btn--sm" id="new-appt-btn">${icon('plus')} Nueva reserva</button>
            <a class="btn btn--ghost btn--sm" href="#/admin/envios">${icon('whatsapp')} Buzón de WhatsApp</a>
          </div>
          <hr class="divider" style="margin:20px 0" />
          <div class="row between wrap gap-12">
            <div><span class="tiny muted">Enviados hoy por WhatsApp</span><div style="font-family:var(--serif);font-size:24px">${stats.waToday}</div></div>
            <div><span class="tiny muted">Fallidos (histórico)</span><div style="font-family:var(--serif);font-size:24px;color:${stats.waFailed ? 'var(--danger)' : 'inherit'}">${stats.waFailed}</div></div>
            <div><span class="tiny muted">Clientas registradas</span><div style="font-family:var(--serif);font-size:24px">${stats.clients}</div></div>
          </div>
        </div>

        <div class="card">
          <h2 style="font-size:19px;margin-bottom:10px">Hoy en el salón</h2>
          ${week[0] && week[0].count
            ? `<p class="small muted" style="margin-bottom:14px">${week[0].count} reserva(s) para hoy.</p>
               <a class="btn btn--block" href="#/admin/agenda">Abrir la agenda de hoy</a>`
            : `<p class="small muted" style="margin-bottom:14px">No hay reservas para hoy. Buen momento para enviar una promoción.</p>
               <a class="btn btn--block btn--ghost" href="#/admin/mensajes">Enviar novedad</a>`}
          <div class="summary__note" style="background:var(--rose-soft);color:var(--rose-600)">
            ${icon('info')}
            <span>Cada mensaje enviado desde <strong>Mensajes</strong> queda en la cuenta de la clienta y se copia automáticamente a su WhatsApp.</span>
          </div>
        </div>
      </div>`;

    return {
      html: shell('adminDashboard', {
        title: 'Resumen del salón',
        subtitle: `Hoy es ${longDate(today)} · todo lo importante en un vistazo`,
        actions: `<a class="btn btn--ghost btn--sm" href="#/admin/agenda">${icon('calendar')} Agenda</a>
                  <a class="btn btn--sm" href="#/admin/mensajes">${icon('send')} Enviar mensaje</a>`,
        content,
      }),
      mount(root) {
        $('#reminders-btn', root)?.addEventListener('click', (e) => sendTomorrowReminders(e.currentTarget));
        $('#new-appt-btn', root)?.addEventListener('click', () => openNewAppointmentModal());
        $$('[data-appt]', root).forEach((btn) =>
          btn.addEventListener('click', async () => {
            const { appointments } = await API.get('/appointments');
            const appt = appointments.find((a) => a.id === Number(btn.dataset.appt));
            if (appt) openAppointmentDetail(appt);
          })
        );
      },
    };
  };

  /* ================================================================== */
  /* Agenda                                                             */
  /* ================================================================== */
  App.pages.adminAgenda = async function ({ query }) {
    let storedDate = null;
    try {
      storedDate = sessionStorage.getItem('amapola.agendaDate');
    } catch {}
    let date = query.get('date') || storedDate || todayISO();
    const setDate = (value) => {
      date = value;
      try {
        sessionStorage.setItem('amapola.agendaDate', value);
      } catch {}
    };
    let status = 'all';
    let appointments = [];
    let loading = true;

    async function load() {
      const data = await API.get(`/appointments?date=${date}&status=${status}`);
      appointments = data.appointments;
      loading = false;
    }
    await load();

    const active = appointments.filter((a) => ['pending', 'confirmed'].includes(a.status));
    const summary = {
      pending: appointments.filter((a) => a.status === 'pending').length,
      confirmed: appointments.filter((a) => a.status === 'confirmed').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      revenue: active.reduce((s, a) => s + a.service.price, 0),
    };

    function rowsHTML() {
      if (loading) return '<div class="loading"><span class="spinner"></span></div>';
      if (!appointments.length)
        return `<div class="empty-state"><strong>Sin reservas este día</strong>Puedes crear una reserva manual con el botón “Nueva reserva”.</div>`;
      return `
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Hora</th><th>Clienta</th><th>Servicio</th><th>Estilista</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
            <tbody>
              ${appointments
                .map(
                  (a) => `<tr>
                    <td class="cell-main mono">${esc(a.time)}</td>
                    <td><div class="cell-main">${esc(a.user.name)}</div><div class="cell-sub">${esc(a.user.phone)}</div></td>
                    <td><div class="cell-main">${esc(a.service.name)}</div><div class="cell-sub">${a.service.duration} min · ${money(a.service.price)}</div></td>
                    <td>${esc(a.staff.name)}</td>
                    <td>${statusBadge(a.status)}</td>
                    <td>
                      <div class="table-actions">
                        ${a.status === 'pending' ? `<button class="icon-btn" title="Confirmar" data-confirm="${a.id}">${icon('check')}</button>` : ''}
                        ${['pending', 'confirmed'].includes(a.status) ? `<button class="icon-btn icon-btn--danger" title="Cancelar" data-cancel="${a.id}">${icon('x')}</button>` : ''}
                        <button class="icon-btn" title="Ver detalle" data-detail="${a.id}">${icon('eye')}</button>
                      </div>
                    </td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    }

    const content = `
      <div class="card" style="margin-bottom:18px">
        <div class="row between wrap gap-12">
          <div class="row gap-8 wrap">
            <button class="icon-btn" id="prev-day" title="Día anterior">${icon('chevronLeft')}</button>
            <input class="input" type="date" id="agenda-date" value="${date}" style="width:160px" />
            <button class="icon-btn" id="next-day" title="Día siguiente">${icon('chevronRight')}</button>
            <button class="btn btn--ghost btn--sm" id="today-btn">Hoy</button>
          </div>
          <div class="row gap-8 wrap">
            <select class="select" id="agenda-status" style="width:150px">
              <option value="all" ${status === 'all' ? 'selected' : ''}>Todos los estados</option>
              <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pendientes</option>
              <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>Confirmadas</option>
              <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completadas</option>
              <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Canceladas</option>
            </select>
            <button class="btn btn--sm" id="new-appt">${icon('plus')} Nueva reserva</button>
          </div>
        </div>
        <div class="row gap-24 wrap" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
          <span class="small"><strong style="font-family:var(--serif);font-size:19px">${appointments.length}</strong> <span class="muted">reservas</span></span>
          <span class="small"><strong style="font-family:var(--serif);font-size:19px">${summary.pending}</strong> <span class="muted">pendientes</span></span>
          <span class="small"><strong style="font-family:var(--serif);font-size:19px">${summary.confirmed}</strong> <span class="muted">confirmadas</span></span>
          <span class="small"><strong style="font-family:var(--serif);font-size:19px">${summary.completed}</strong> <span class="muted">completadas</span></span>
          <span class="small" style="margin-left:auto"><span class="muted">Estimado del día:</span> <strong style="font-family:var(--serif);font-size:19px">${money(summary.revenue)}</strong></span>
        </div>
      </div>
      <h2 style="font-size:20px;margin-bottom:12px">${esc(longDate(date))}</h2>
      <div id="agenda-rows">${rowsHTML()}</div>`;

    return {
      html: shell('adminAgenda', {
        title: 'Agenda',
        subtitle: 'Gestiona las reservas del día y confirma a tus clientas',
        actions: `<button class="btn btn--ghost btn--sm" id="reminders-btn">${icon('bell')} Recordatorios de mañana</button>`,
        content,
      }),
      mount(root) {
        async function refresh() {
          $('#agenda-rows', root).innerHTML = '<div class="loading"><span class="spinner"></span></div>';
          await load();
          $('#agenda-rows', root).innerHTML = rowsHTML();
          bindRows();
        }
        function bindRows() {
          $$('[data-confirm]', root).forEach((b) =>
            b.addEventListener('click', () => notifyStatus(Number(b.dataset.confirm), 'confirmed', 'Reserva confirmada'))
          );
          $$('[data-cancel]', root).forEach((b) =>
            b.addEventListener('click', async () => {
              const ok = await confirmDialog({
                title: 'Cancelar reserva',
                message: 'La clienta recibirá el aviso en su cuenta y una copia por WhatsApp.',
                confirmLabel: 'Cancelar reserva',
                danger: true,
              });
              if (ok) notifyStatus(Number(b.dataset.cancel), 'cancelled', 'Reserva cancelada');
            })
          );
          $$('[data-detail]', root).forEach((b) =>
            b.addEventListener('click', () => {
              const appt = appointments.find((a) => a.id === Number(b.dataset.detail));
              if (appt) openAppointmentDetail(appt);
            })
          );
        }
        bindRows();

        $('#prev-day', root).addEventListener('click', async () => {
          setDate(addDays(date, -1));
          $('#agenda-date', root).value = date;
          await refresh();
        });
        $('#next-day', root).addEventListener('click', async () => {
          setDate(addDays(date, 1));
          $('#agenda-date', root).value = date;
          await refresh();
        });
        $('#today-btn', root).addEventListener('click', async () => {
          setDate(todayISO());
          $('#agenda-date', root).value = date;
          await refresh();
        });
        $('#agenda-date', root).addEventListener('change', async (e) => {
          setDate(e.target.value);
          await refresh();
        });
        $('#agenda-status', root).addEventListener('change', async (e) => {
          status = e.target.value;
          await refresh();
        });
        $('#new-appt', root).addEventListener('click', () => openNewAppointmentModal({ date }));
        $('#reminders-btn', root).addEventListener('click', (e) => sendTomorrowReminders(e.currentTarget));
      },
    };
  };

  /* ================================================================== */
  /* Mensajes (compositor + copia a WhatsApp)                           */
  /* ================================================================== */
  const TEMPLATES = [
    {
      id: 'reminder',
      label: 'Recordatorio',
      kind: 'reminder',
      title: 'Recordatorio de tu reserva',
      body: 'Hola {nombre}, te recordamos tu {servicio} con {estilista} el {fecha} a las {hora} hrs. Si no puedes asistir, avísanos por aquí. ¡Te esperamos!',
    },
    {
      id: 'confirm',
      label: 'Confirmación',
      kind: 'confirmation',
      title: 'Tu reserva está confirmada',
      body: 'Hola {nombre}, confirmamos tu {servicio} para el {fecha} a las {hora} hrs con {estilista}. ¡Nos vemos en Amapola!',
    },
    {
      id: 'promo',
      label: 'Promoción',
      kind: 'promotion',
      title: '20% en tratamientos capilares',
      body: 'Hola {nombre}, este mes celebramos nuestro aniversario con 20% de descuento en todos los tratamientos capilares. Puedes reservar desde tu cuenta o respondernos por aquí.',
    },
    {
      id: 'welcome',
      label: 'Bienvenida',
      kind: 'info',
      title: '¡Bienvenida a Amapola!',
      body: 'Hola {nombre}, nos alegra tenerte por aquí. En tu cuenta encontrarás tus reservas y cada mensaje que te enviemos. Cualquier cosa, escríbenos.',
    },
    {
      id: 'notice',
      label: 'Aviso',
      kind: 'info',
      title: 'Cambio de horario',
      body: 'Hola {nombre}, te contamos que este sábado atenderemos hasta las 15:00 hrs. Si tienes una reserva para más tarde, te contactaremos para reagendar.',
    },
  ];

  App.pages.adminMessages = async function () {
    const [{ clients }, { messages: recent }] = await Promise.all([
      API.get('/admin/clients?limit=100'),
      API.get('/admin/messages'),
    ]);
    const preselected = App.utils.parseHash().query.get('user');

    const content = `
      <div class="composer-grid">
        <div class="composer">
          <div class="row between wrap gap-12" style="margin-bottom:18px">
            <div>
              <h2 style="font-size:20px">Nuevo mensaje</h2>
              <p class="small muted">Se guarda en la cuenta de la clienta y se copia a su WhatsApp.</p>
            </div>
            <div class="audience-toggle" id="audience-toggle">
              <button data-audience="user" class="is-active">Una clienta</button>
              <button data-audience="all">Todas</button>
            </div>
          </div>
          <div id="composer-error"></div>

          <div class="template-list" id="templates">
            ${TEMPLATES.map((t) => `<button type="button" class="chip" data-template="${t.id}">${esc(t.label)}</button>`).join('')}
            <button type="button" class="chip" data-template="blank">Desde cero</button>
          </div>

          <div id="audience-fields">
            <label class="field">
              <span class="label">Clienta</span>
              <select class="select" id="msg-client">
                ${clients
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${String(c.id) === preselected ? 'selected' : ''}>${esc(c.name)} · ${esc(c.phone)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label class="field" id="appt-field">
              <span class="label">Vincular a una reserva (opcional)</span>
              <select class="select" id="msg-appt"><option value="">Sin reserva vinculada</option></select>
              <span class="hint">Si la vinculas, los datos como {fecha}, {hora} o {servicio} se completan solos.</span>
            </label>
          </div>
          <p class="hint hidden" id="audience-all-hint" style="margin:-4px 0 14px">Se enviará un mensaje individual a las ${clients.length} clientas registradas. {nombre} se reemplaza por el nombre de cada una.</p>

          <label class="field">
            <span class="label">Categoría</span>
            <select class="select" id="msg-kind">
              <option value="reminder">Recordatorio</option>
              <option value="confirmation">Confirmación</option>
              <option value="promotion">Promoción</option>
              <option value="info">Información</option>
            </select>
          </label>
          <label class="field">
            <span class="label">Título</span>
            <input class="input" id="msg-title" maxlength="160" placeholder="Ej: Recordatorio de tu reserva" />
          </label>
          <label class="field">
            <span class="label">Mensaje</span>
            <textarea class="textarea" id="msg-body" maxlength="2000" placeholder="Escribe el mensaje que verá la clienta en su cuenta…"></textarea>
          </label>
          <div class="row between wrap gap-12" style="margin-top:4px">
            <span class="hint">Variables: <code>{nombre}</code> <code>{servicio}</code> <code>{fecha}</code> <code>{hora}</code> <code>{estilista}</code></span>
            <button class="btn" id="send-msg">${icon('send')} Enviar mensaje y WhatsApp</button>
          </div>
        </div>

        <div class="stack gap-16">
          <div class="wa-preview">
            <div class="wa-preview__head">
              <span class="avatar" style="background:#075e54;color:#fff">${icon('whatsapp')}</span>
              <div>
                <div style="font-size:12.5px;font-weight:500;color:#1f2d24">Vista previa en WhatsApp</div>
                <div style="font-size:10.5px;color:#6b7d6b" id="wa-preview-to">${esc(clients[0]?.phone || '')}</div>
              </div>
            </div>
            <div class="wa-preview__bubble" id="wa-bubble">
              <strong id="wa-bubble-title">Recordatorio de tu reserva</strong>
              <div id="wa-bubble-body" style="margin-top:6px">Hola {nombre}, te recordamos tu {servicio} con {estilista} el {fecha} a las {hora} hrs…</div>
              <div class="wa-preview__meta">ahora ${icon('checkCircle')}</div>
            </div>
            <p class="hint" style="margin-top:12px;color:#5c6b5c">Las variables se completan al enviar.</p>
          </div>
          <div class="card" style="padding:20px">
            <div class="row between" style="margin-bottom:10px">
              <h3 style="font-size:16px">Historial reciente</h3>
              <a class="link small" href="#/admin/envios">Ver todos</a>
            </div>
            ${
              recent.length
                ? recent
                    .slice(0, 6)
                    .map(
                      (m) => `<div class="list-row" style="gap:10px;padding:10px 0">
                        <span class="avatar avatar--sm">${esc(initials(m.userName))}</span>
                        <div class="list-row__body"><strong>${esc(m.title)}</strong><span>${esc(m.userName)} · ${timeAgo(m.createdAt)}</span></div>
                        ${waBadge(m.whatsapp?.status)}
                      </div>`
                    )
                    .join('')
                : '<p class="small muted">Todavía no has enviado mensajes.</p>'
            }
          </div>
        </div>
      </div>`;

    return {
      html: shell('adminMessages', {
        title: 'Mensajes',
        subtitle: 'Escribe una vez: se guarda en la cuenta y se envía por WhatsApp',
        actions: `<button class="btn btn--ghost btn--sm" id="reminders-btn">${icon('bell')} Recordatorios de mañana</button>
                  <a class="btn btn--ghost btn--sm" href="#/admin/envios">${icon('whatsapp')} Envíos</a>`,
        content,
      }),
      mount(root) {
        let audience = 'user';
        let currentKind = 'reminder';
        const titleEl = $('#msg-title', root);
        const bodyEl = $('#msg-body', root);
        const clientEl = $('#msg-client', root);
        const apptEl = $('#msg-appt', root);
        const kindEl = $('#msg-kind', root);

        function updatePreview() {
          $('#wa-bubble-title', root).textContent = titleEl.value || 'Título del mensaje';
          $('#wa-bubble-body', root).textContent =
            bodyEl.value || 'Aquí verás el texto que recibirá la clienta por WhatsApp.';
          const option = clientEl.options[clientEl.selectedIndex];
          $('#wa-preview-to', root).textContent =
            audience === 'all' ? `${clients.length} clientas` : option ? option.textContent.split(' · ').pop() : '';
        }

        function applyTemplate(id) {
          const t = TEMPLATES.find((x) => x.id === id);
          if (id === 'blank') {
            titleEl.value = '';
            bodyEl.value = '';
          } else if (t) {
            titleEl.value = t.title;
            bodyEl.value = t.body;
            kindEl.value = t.kind;
            currentKind = t.kind;
          }
          $$('[data-template]', root).forEach((c) => c.classList.toggle('is-active', c.dataset.template === id));
          updatePreview();
        }

        async function loadAppointments() {
          apptEl.innerHTML = '<option value="">Cargando reservas…</option>';
          try {
            const { appointments } = await API.get(`/appointments?userId=${clientEl.value}&from=${addDays(todayISO(), -30)}`);
            const open = appointments.filter((a) => ['pending', 'confirmed'].includes(a.status));
            apptEl.innerHTML =
              '<option value="">Sin reserva vinculada</option>' +
              open
                .map(
                  (a) => `<option value="${a.id}">${esc(a.service.name)} · ${esc(shortDate(a.date))} ${esc(a.time)}</option>`
                )
                .join('');
          } catch {
            apptEl.innerHTML = '<option value="">Sin reserva vinculada</option>';
          }
        }

        $$('[data-template]', root).forEach((btn) =>
          btn.addEventListener('click', () => applyTemplate(btn.dataset.template))
        );
        titleEl.addEventListener('input', updatePreview);
        bodyEl.addEventListener('input', updatePreview);
        clientEl.addEventListener('change', () => {
          updatePreview();
          loadAppointments();
        });
        kindEl.addEventListener('change', () => (currentKind = kindEl.value));

        $$('#audience-toggle button', root).forEach((btn) =>
          btn.addEventListener('click', () => {
            audience = btn.dataset.audience;
            $$('#audience-toggle button', root).forEach((b) => b.classList.toggle('is-active', b === btn));
            $('#audience-fields', root).classList.toggle('hidden', audience === 'all');
            $('#audience-all-hint', root).classList.toggle('hidden', audience !== 'all');
            updatePreview();
          })
        );

        $$('[data-template]', root).forEach((b) => {
          if (b.dataset.template === 'reminder') b.classList.add('is-active');
        });
        applyTemplate('reminder');
        loadAppointments();

        $('#send-msg', root).addEventListener('click', async () => {
          const btn = $('#send-msg', root);
          const errorBox = $('#composer-error', root);
          errorBox.innerHTML = '';
          if (!titleEl.value.trim() || !bodyEl.value.trim())
            return toast('Escribe un título y un mensaje.', 'error');
          btn.disabled = true;
          const original = btn.innerHTML;
          btn.textContent = 'Enviando…';
          try {
            const payload = {
              audience,
              kind: kindEl.value || currentKind,
              title: titleEl.value,
              body: bodyEl.value,
            };
            if (audience === 'user') {
              payload.userId = Number(clientEl.value);
              if (apptEl.value) payload.appointmentId = Number(apptEl.value);
            }
            const res = await API.post('/admin/messages', payload);
            await App.utils.refreshSession();
            toast(
              res.whatsappFailed
                ? `Mensaje enviado a ${res.delivered}. ${res.whatsappFailed} copia(s) de WhatsApp fallaron.`
                : `Mensaje enviado a ${res.delivered} clienta(s) y copiado a WhatsApp.`,
              res.whatsappFailed ? 'error' : 'ok'
            );
            titleEl.value = '';
            bodyEl.value = '';
            updatePreview();
            App.utils.render();
          } catch (err) {
            errorBox.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
            btn.disabled = false;
            btn.innerHTML = original;
          }
        });

        $('#reminders-btn', root).addEventListener('click', (e) => sendTomorrowReminders(e.currentTarget));
      },
    };
  };

  /* ================================================================== */
  /* Clientas                                                           */
  /* ================================================================== */
  App.pages.adminClients = async function ({ query }) {
    let q = query.get('q') || '';
    let clients = await loadClients(q);

    function rowsHTML() {
      if (!clients.length)
        return `<div class="empty-state"><strong>Sin resultados</strong>No encontramos clientas con esa búsqueda.</div>`;
      return `
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Clienta</th><th>WhatsApp</th><th>Reservas</th><th>Última visita</th><th>Mensajes</th><th style="text-align:right">Acciones</th></tr>
            </thead>
            <tbody>
              ${clients
                .map(
                  (c) => `<tr>
                    <td>
                      <div class="row gap-12">
                        <span class="avatar avatar--sm">${esc(initials(c.name))}</span>
                        <div><div class="cell-main">${esc(c.name)}</div><div class="cell-sub">${esc(c.email)}</div></div>
                      </div>
                    </td>
                    <td class="mono" style="font-size:12.5px">${esc(c.phone)}</td>
                    <td>${c.totalAppointments}</td>
                    <td class="cell-sub">${c.lastVisit ? esc(longDate(c.lastVisit, { weekday: false })) : '—'}</td>
                    <td>${c.unread ? `<span class="badge badge--promotion">${c.unread} sin leer</span>` : '<span class="cell-sub">al día</span>'}</td>
                    <td>
                      <div class="table-actions">
                        <a class="btn btn--ghost btn--xs" href="#/admin/mensajes?user=${c.id}">${icon('send')} Mensaje</a>
                        <button class="icon-btn" title="Ver reservas" data-view="${c.id}">${icon('calendar')}</button>
                      </div>
                    </td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    }

    const content = `
      <div class="card" style="margin-bottom:18px">
        <div class="row between wrap gap-12">
          <div class="search" style="width:min(100%,340px)">
            ${icon('search')}
            <input class="input" id="client-search" placeholder="Buscar por nombre, correo o teléfono" value="${esc(q)}" />
          </div>
          <div class="row gap-8">
            <span class="badge">${clients.length} clientas</span>
            <a class="btn btn--sm" href="#/admin/mensajes">${icon('send')} Enviar mensaje</a>
          </div>
        </div>
      </div>
      <div id="clients-table">${rowsHTML()}</div>`;

    return {
      html: shell('adminClients', {
        title: 'Clientas',
        subtitle: 'Datos de contacto, historial y comunicación',
        content,
      }),
      mount(root) {
        let timer;
        $('#client-search', root).addEventListener('input', (e) => {
          clearTimeout(timer);
          const value = e.target.value;
          timer = setTimeout(async () => {
            q = value;
            clients = await loadClients(q);
            $('#clients-table', root).innerHTML = rowsHTML();
            bindRows();
          }, 280);
        });

        function bindRows() {
          $$('[data-view]', root).forEach((btn) =>
            btn.addEventListener('click', async () => {
              const client = clients.find((c) => c.id === Number(btn.dataset.view));
              const { appointments } = await API.get(`/appointments?userId=${btn.dataset.view}`);
              openModal({
                title: client ? client.name : 'Reservas',
                wide: true,
                body: `
                  <p class="small muted" style="margin-bottom:14px">${esc(client?.phone || '')} · ${esc(client?.email || '')}</p>
                  ${
                    appointments.length
                      ? appointments
                          .slice(0, 20)
                          .map(
                            (a) => `<div class="list-row">
                              <div class="list-row__date"><strong>${esc(a.time)}</strong><span>${esc(shortDate(a.date))}</span></div>
                              <div class="list-row__body"><strong>${esc(a.service.name)}</strong><span>${esc(a.staff.name)} · ${money(a.service.price)}</span></div>
                              ${statusBadge(a.status)}
                            </div>`
                          )
                          .join('')
                      : '<p class="empty-state">Esta clienta aún no tiene reservas.</p>'
                  }`,
                footer: `<a class="btn" href="#/admin/mensajes?user=${btn.dataset.view}">${icon('send')} Enviar mensaje</a>
                         <button class="btn btn--ghost" data-action="close-modal">Cerrar</button>`,
              });
            })
          );
        }
        bindRows();
      },
    };
  };

  /* ================================================================== */
  /* Servicios                                                          */
  /* ================================================================== */
  App.pages.adminServices = async function () {
    const { services } = await API.get('/services?all=1');

    function openServiceModal(service) {
      const editing = !!service;
      openModal({
        title: editing ? 'Editar servicio' : 'Nuevo servicio',
        body: `
          <div id="svc-error"></div>
          <label class="field"><span class="label">Nombre</span>
            <input class="input" id="svc-name" value="${esc(service?.name || '')}" placeholder="Ej: Corte y secado" />
          </label>
          <label class="field"><span class="label">Descripción</span>
            <textarea class="textarea" id="svc-desc" style="min-height:70px" placeholder="Qué incluye el servicio">${esc(service?.description || '')}</textarea>
          </label>
          <div class="field-row">
            <label class="field"><span class="label">Duración (min)</span>
              <input class="input" type="number" id="svc-duration" min="15" max="480" step="15" value="${service?.duration || 60}" />
            </label>
            <label class="field"><span class="label">Precio (CLP)</span>
              <input class="input" type="number" id="svc-price" min="0" step="500" value="${service?.price || 20000}" />
            </label>
          </div>`,
        footer: `<button class="btn btn--ghost" data-action="close-modal">Cancelar</button>
                 <button class="btn" id="svc-save">${editing ? 'Guardar cambios' : 'Crear servicio'}</button>`,
        onMount(wrap) {
          $('#svc-save', wrap).addEventListener('click', async () => {
            const btn = $('#svc-save', wrap);
            btn.disabled = true;
            try {
              const payload = {
                name: $('#svc-name', wrap).value,
                description: $('#svc-desc', wrap).value,
                duration: Number($('#svc-duration', wrap).value),
                price: Number($('#svc-price', wrap).value),
              };
              if (editing) await API.patch(`/admin/services/${service.id}`, payload);
              else await API.post('/admin/services', payload);
              closeModal();
              toast(editing ? 'Servicio actualizado.' : 'Servicio creado.', 'ok');
              App.state.catalogLoaded = false;
              App.utils.render();
            } catch (err) {
              $('#svc-error', wrap).innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
              btn.disabled = false;
            }
          });
        },
      });
    }

    const content = `
      <div class="card" style="margin-bottom:18px">
        <div class="row between wrap gap-12">
          <p class="small muted">${services.filter((s) => s.active).length} servicios activos · los servicios inactivos no aparecen en la reserva.</p>
          <button class="btn btn--sm" id="add-service">${icon('plus')} Nuevo servicio</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Servicio</th><th>Duración</th><th>Precio</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead>
          <tbody>
            ${services
              .map(
                (s) => `<tr>
                  <td><div class="cell-main">${esc(s.name)}</div><div class="cell-sub" style="max-width:340px">${esc(s.description)}</div></td>
                  <td class="mono">${s.duration} min</td>
                  <td class="cell-main">${money(s.price)}</td>
                  <td><span class="badge ${s.active ? 'badge--confirmed' : ''}">${s.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="icon-btn" title="Editar" data-edit="${s.id}">${icon('edit')}</button>
                      <button class="icon-btn ${s.active ? 'icon-btn--danger' : ''}" title="${s.active ? 'Desactivar' : 'Activar'}" data-toggle="${s.id}">
                        ${icon(s.active ? 'x' : 'check')}
                      </button>
                    </div>
                  </td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    return {
      html: shell('adminServices', {
        title: 'Servicios',
        subtitle: 'Duración y precios que verán tus clientas al reservar',
        content,
      }),
      mount(root) {
        $('#add-service', root).addEventListener('click', () => openServiceModal(null));
        $$('[data-edit]', root).forEach((b) =>
          b.addEventListener('click', () => openServiceModal(services.find((s) => s.id === Number(b.dataset.edit))))
        );
        $$('[data-toggle]', root).forEach((b) =>
          b.addEventListener('click', async () => {
            const service = services.find((s) => s.id === Number(b.dataset.toggle));
            try {
              await API.patch(`/admin/services/${service.id}`, { active: !service.active });
              toast(service.active ? 'Servicio desactivado.' : 'Servicio activado.', 'ok');
              App.state.catalogLoaded = false;
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
  /* Equipo                                                             */
  /* ================================================================== */
  App.pages.adminTeam = async function () {
    const { staff } = await API.get('/staff?all=1');

    function openStaffModal(member) {
      const editing = !!member;
      openModal({
        title: editing ? 'Editar estilista' : 'Nueva estilista',
        body: `
          <div id="staff-error"></div>
          <label class="field"><span class="label">Nombre</span>
            <input class="input" id="staff-name" value="${esc(member?.name || '')}" placeholder="Ej: Fernanda" />
          </label>
          <label class="field"><span class="label">Especialidad</span>
            <input class="input" id="staff-specialty" value="${esc(member?.specialty || '')}" placeholder="Ej: Color y mechas" />
          </label>
          <label class="field"><span class="label">Color de identificación</span>
            <input class="input" type="color" id="staff-color" value="${member?.color || '#b76e5d'}" style="height:44px;padding:4px" />
          </label>`,
        footer: `<button class="btn btn--ghost" data-action="close-modal">Cancelar</button>
                 <button class="btn" id="staff-save">${editing ? 'Guardar' : 'Agregar'}</button>`,
        onMount(wrap) {
          $('#staff-save', wrap).addEventListener('click', async () => {
            const btn = $('#staff-save', wrap);
            btn.disabled = true;
            try {
              const payload = {
                name: $('#staff-name', wrap).value,
                specialty: $('#staff-specialty', wrap).value,
                color: $('#staff-color', wrap).value,
              };
              if (editing) await API.patch(`/admin/staff/${member.id}`, payload);
              else await API.post('/admin/staff', payload);
              closeModal();
              toast(editing ? 'Estilista actualizada.' : 'Estilista agregada.', 'ok');
              App.state.catalogLoaded = false;
              App.utils.render();
            } catch (err) {
              $('#staff-error', wrap).innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
              btn.disabled = false;
            }
          });
        },
      });
    }

    const content = `
      <div class="card" style="margin-bottom:18px">
        <div class="row between wrap gap-12">
          <p class="small muted">${staff.filter((s) => s.active).length} profesionales activas en la agenda.</p>
          <button class="btn btn--sm" id="add-staff">${icon('plus')} Agregar al equipo</button>
        </div>
      </div>
      <div class="grid-3">
        ${staff
          .map(
            (s) => `<div class="card team-card" style="${s.active ? '' : 'opacity:.6'}">
              <div class="avatar avatar--staff" style="background:${esc(s.color)}22;color:${esc(s.color)}">${esc(initials(s.name))}</div>
              <h3 class="team-card__name">${esc(s.name)}</h3>
              <div class="team-card__spec">${esc(s.specialty)}</div>
              <p class="team-card__days"><span class="badge ${s.active ? 'badge--confirmed' : ''}">${s.active ? 'Activa' : 'Inactiva'}</span></p>
              <div class="row gap-8 center" style="margin-top:12px">
                <button class="btn btn--ghost btn--xs" data-edit="${s.id}">${icon('edit')} Editar</button>
                <button class="btn btn--ghost btn--xs" data-toggle="${s.id}">${s.active ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>`
          )
          .join('')}
      </div>`;

    return {
      html: shell('adminTeam', {
        title: 'Equipo',
        subtitle: 'Quiénes aparecen disponibles al reservar',
        content,
      }),
      mount(root) {
        $('#add-staff', root).addEventListener('click', () => openStaffModal(null));
        $$('[data-edit]', root).forEach((b) =>
          b.addEventListener('click', () => openStaffModal(staff.find((s) => s.id === Number(b.dataset.edit))))
        );
        $$('[data-toggle]', root).forEach((b) =>
          b.addEventListener('click', async () => {
            const member = staff.find((s) => s.id === Number(b.dataset.toggle));
            try {
              await API.patch(`/admin/staff/${member.id}`, { active: !member.active });
              toast(member.active ? 'Estilista desactivada.' : 'Estilista activada.', 'ok');
              App.state.catalogLoaded = false;
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
  /* Envíos WhatsApp                                                    */
  /* ================================================================== */
  App.pages.adminOutbox = async function () {
    let statusFilter = 'all';
    let q = '';
    let data = await API.get('/admin/outbox');

    const badgeFor = (status) => waBadge(status);

    function tableHTML() {
      const rows = data.outbox;
      if (!rows.length)
        return `<div class="empty-state"><strong>Todavía no hay envíos</strong>Cuando envíes un mensaje verás aquí la copia exacta que viaja por WhatsApp.</div>`;
      return `
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Enviado</th><th>Destinataria</th><th>Mensaje</th><th>Teléfono</th><th>Estado</th><th style="text-align:right"></th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) => `<tr>
                    <td class="cell-sub" style="white-space:nowrap">${esc(timeAgo(r.createdAt))}</td>
                    <td class="cell-main">${esc(r.userName || '—')}</td>
                    <td><div class="cell-main" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.title || '(prueba)')}</div><div class="cell-sub">${esc((r.body || '').replace(/\n/g, ' ').slice(0, 60))}…</div></td>
                    <td class="mono" style="font-size:12px">${esc(r.phone)}</td>
                    <td>${badgeFor(r.status)}</td>
                    <td><div class="table-actions"><button class="icon-btn" data-see="${r.id}" title="Ver copia">${icon('eye')}</button></div></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    }

    const provider = data.provider;
    const counts = data.counts || {};
    const content = `
      <div class="dash-grid" style="grid-template-columns:1.2fr .8fr">
        <div class="card">
          <div class="row gap-12" style="margin-bottom:10px">
            <span class="avatar" style="background:#eaf7ee;color:#2f9e44">${icon('whatsapp')}</span>
            <div>
              <strong style="font-size:14px">${esc(provider.label)}</strong>
              <p class="small muted">${provider.live ? 'Envío real habilitado' : 'Modo demostración activo'}</p>
            </div>
          </div>
          <p class="small muted">${esc(provider.hint)}</p>
          <div class="row gap-24 wrap" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
            <span class="small"><strong style="font-family:var(--serif);font-size:22px">${counts.sent || 0}</strong> <span class="muted">enviados</span></span>
            <span class="small"><strong style="font-family:var(--serif);font-size:22px">${counts.simulated || 0}</strong> <span class="muted">simulados</span></span>
            <span class="small"><strong style="font-family:var(--serif);font-size:22px;color:${counts.failed ? 'var(--danger)' : 'inherit'}">${counts.failed || 0}</strong> <span class="muted">fallidos</span></span>
          </div>
        </div>
        <div class="card">
          <h3 style="font-size:17px;margin-bottom:4px">Probar conexión</h3>
          <p class="small muted" style="margin-bottom:12px">Envía un WhatsApp de prueba para verificar credenciales.</p>
          <div id="test-result"></div>
          <label class="field"><span class="label">Número</span>
            <input class="input" id="test-phone" placeholder="+56 9 1234 5678" value="${esc(App.state.user?.phone || '')}" />
          </label>
          <label class="field"><span class="label">Mensaje</span>
            <input class="input" id="test-body" placeholder="Prueba desde el panel" />
          </label>
          <button class="btn btn--block btn--sm" id="test-send">Enviar prueba</button>
        </div>
      </div>

      <div class="card" style="margin:18px 0">
        <div class="row between wrap gap-12">
          <div class="search" style="width:min(100%,320px)">
            ${icon('search')}
            <input class="input" id="outbox-search" placeholder="Buscar por clienta, título o teléfono" value="${esc(q)}" />
          </div>
          <select class="select" id="outbox-status" style="width:180px">
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Todos los estados</option>
            <option value="sent" ${statusFilter === 'sent' ? 'selected' : ''}>Enviados</option>
            <option value="simulated" ${statusFilter === 'simulated' ? 'selected' : ''}>Simulados</option>
            <option value="failed" ${statusFilter === 'failed' ? 'selected' : ''}>Fallidos</option>
          </select>
        </div>
      </div>
      <div id="outbox-table">${tableHTML()}</div>`;

    return {
      html: shell('adminOutbox', {
        title: 'Envíos de WhatsApp',
        subtitle: 'Bitácora con la copia exacta de cada mensaje',
        actions: `<a class="btn btn--ghost btn--sm" href="#/admin/mensajes">${icon('send')} Nuevo mensaje</a>`,
        content,
      }),
      mount(root) {
        async function reload() {
          data = await API.get(
            `/admin/outbox?status=${statusFilter}${q ? `&q=${encodeURIComponent(q)}` : ''}`
          );
          $('#outbox-table', root).innerHTML = tableHTML();
          bindRows();
        }
        function bindRows() {
          $$('[data-see]', root).forEach((btn) =>
            btn.addEventListener('click', () => {
              const row = data.outbox.find((r) => r.id === Number(btn.dataset.see));
              openModal({
                title: 'Copia enviada por WhatsApp',
                body: `
                  <div class="row gap-8 wrap" style="margin-bottom:12px">${badgeFor(row.status)}<span class="badge">${esc(row.provider)}</span></div>
                  <div class="summary__row"><span>Destinataria</span><span>${esc(row.userName || '—')}</span></div>
                  <div class="summary__row"><span>Teléfono</span><span>${esc(row.phone)}</span></div>
                  <div class="summary__row"><span>Fecha</span><span>${esc(timeAgo(row.createdAt))}</span></div>
                  ${row.error ? `<div class="form-error" style="margin-top:14px">${esc(row.error)}</div>` : ''}
                  <div class="wa-preview" style="margin-top:16px;min-height:0">
                    <div class="wa-preview__bubble">${esc(row.body)}</div>
                  </div>`,
                footer: `<button class="btn btn--ghost" data-action="close-modal">Cerrar</button>`,
              });
            })
          );
        }
        bindRows();

        $('#outbox-status', root).addEventListener('change', (e) => {
          statusFilter = e.target.value;
          reload();
        });
        let timer;
        $('#outbox-search', root).addEventListener('input', (e) => {
          q = e.target.value;
          clearTimeout(timer);
          timer = setTimeout(reload, 300);
        });

        $('#test-send', root).addEventListener('click', async () => {
          const btn = $('#test-send', root);
          btn.disabled = true;
          const res = $('#test-result', root);
          res.innerHTML = '';
          try {
            const r = await API.post('/admin/whatsapp/test', {
              phone: $('#test-phone', root).value,
              body: $('#test-body', root).value,
            });
            if (r.ok) {
              toast(r.simulated ? 'Prueba registrada en el buzón (modo demostración).' : 'WhatsApp de prueba enviado.', 'ok');
            } else {
              res.innerHTML = `<div class="form-error">${esc(r.error || 'No se pudo enviar.')}</div>`;
            }
            await reload();
          } catch (err) {
            res.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
          } finally {
            btn.disabled = false;
          }
        });
      },
    };
  };
})();
