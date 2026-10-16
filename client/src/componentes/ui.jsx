import { useEffect, useRef } from 'react'

/* ── Contenedores ───────────────────────────────────────────────────────── */
export function Tarjeta({ children, className = '', padding = true, ...resto }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${padding ? 'p-5' : ''} ${className}`} {...resto}>
      {children}
    </div>
  )
}

export function Seccion({ titulo, descripcion, acciones, children, className = '' }) {
  return (
    <section className={className}>
      {(titulo || acciones) && (
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {titulo && <h2 className="text-base font-semibold tracking-tight text-slate-900">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{descripcion}</p>}
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Indicador({ titulo, valor, detalle, color = 'marca', icono, onClick }) {
  const colores = {
    marca: 'text-marca-700 bg-marca-50 border-marca-100',
    esmeralda: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    ambar: 'text-amber-700 bg-amber-50 border-amber-100',
    rojo: 'text-rose-700 bg-rose-50 border-rose-100',
    violeta: 'text-aneiich-700 bg-aneiich-50 border-aneiich-100',
    gris: 'text-slate-700 bg-slate-50 border-slate-200',
  }
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition ${onClick ? 'hover:shadow-md' : ''}`}
    >
      {icono && <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${colores[color]}`}>{icono}</span>}
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</span>
        <span className="mt-0.5 block text-2xl font-semibold tabular-nums text-slate-900">{valor}</span>
        {detalle && <span className="mt-0.5 block text-xs text-slate-500">{detalle}</span>}
      </span>
    </Comp>
  )
}

/* ── Botones ────────────────────────────────────────────────────────────── */
export function Boton({ children, variante = 'primario', tamano = 'md', className = '', tipo = 'button', cargando, ...resto }) {
  const variantes = {
    primario: 'bg-marca-600 text-white hover:bg-marca-700 focus-visible:outline-marca-600 shadow-sm',
    secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
    suave: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    peligro: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    violeta: 'bg-aneiich-600 text-white hover:bg-aneiich-700 shadow-sm',
    exito: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    enlace: 'text-marca-700 hover:text-marca-900 underline-offset-2 hover:underline p-0',
  }
  const tamanos = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-2.5 text-sm', icono: 'p-2' }
  return (
    <button
      type={tipo}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantes[variante]} ${tamanos[tamano]} ${className}`}
      disabled={cargando || resto.disabled}
      {...resto}
    >
      {cargando && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

/* ── Formularios ────────────────────────────────────────────────────────── */
const clasesControl = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-marca-500 focus:ring-2 focus:ring-marca-100 disabled:bg-slate-50 disabled:text-slate-500'

export function Campo({ etiqueta, ayuda, requerido, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {etiqueta && (
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {etiqueta} {requerido && <span className="text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span>
        : ayuda ? <span className="mt-1 block text-xs text-slate-500">{ayuda}</span> : null}
    </label>
  )
}

export function Entrada({ className = '', ...resto }) {
  return <input className={`${clasesControl} ${className}`} {...resto} />
}

export function AreaTexto({ className = '', filas = 3, ...resto }) {
  return <textarea rows={filas} className={`${clasesControl} ${className}`} {...resto} />
}

export function Selector({ opciones = [], placeholder, className = '', children, ...resto }) {
  return (
    <select className={`${clasesControl} ${className}`} {...resto}>
      {placeholder && <option value="">{placeholder}</option>}
      {opciones.map((o) => (
        <option key={o.valor ?? o} value={o.valor ?? o}>{o.etiqueta ?? o}</option>
      ))}
      {children}
    </select>
  )
}

export function Conmutador({ activo, onChange, etiqueta, ayuda, color = 'marca' }) {
  const activos = { marca: 'bg-marca-600', violeta: 'bg-aneiich-600', esmeralda: 'bg-emerald-600' }
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        onClick={() => onChange(!activo)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition ${activo ? activos[color] : 'bg-slate-300'}`}
      >
        <span className={`block size-4 rounded-full bg-white shadow transition ${activo ? 'translate-x-4' : ''}`} />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-700">{etiqueta}</span>
        {ayuda && <span className="block text-xs text-slate-500">{ayuda}</span>}
      </span>
    </label>
  )
}

/* ── Etiquetas e insignias ──────────────────────────────────────────────── */
export function Insignia({ children, color = 'gris', className = '', titulo }) {
  const colores = {
    gris: 'bg-slate-100 text-slate-700 ring-slate-200',
    marca: 'bg-marca-50 text-marca-700 ring-marca-200',
    esmeralda: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    ambar: 'bg-amber-50 text-amber-700 ring-amber-200',
    naranja: 'bg-orange-50 text-orange-700 ring-orange-200',
    rojo: 'bg-rose-50 text-rose-700 ring-rose-200',
    violeta: 'bg-aneiich-50 text-aneiich-700 ring-aneiich-100',
    cielo: 'bg-sky-50 text-sky-700 ring-sky-200',
  }
  return (
    <span title={titulo} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${colores[color]} ${className}`}>
      {children}
    </span>
  )
}

export function InsigniaAneiich({ rol, compacta }) {
  return (
    <Insignia color="violeta" titulo={`Asociado a ANEIICH${rol ? ` — ${rol}` : ''}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3"><path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7L10 2.5z" /></svg>
      ANEIICH{!compacta && rol ? ` · ${rol}` : ''}
    </Insignia>
  )
}

const COLORES_LISTA = { 1: 'esmeralda', 2: 'cielo', 3: 'ambar', 4: 'rojo' }
export function InsigniaLista({ lista, puntaje, grande }) {
  if (!lista) return <span className="text-xs text-slate-400">Sin calificar</span>
  const nombres = { 1: 'Distinción', 2: 'Buena', 3: 'Condicional', 4: 'Eliminación' }
  return (
    <Insignia color={COLORES_LISTA[lista]} className={grande ? 'px-2.5 py-1 text-xs' : ''}>
      Lista N°{lista} · {nombres[lista]}{puntaje !== undefined && puntaje !== null ? ` · ${puntaje}` : ''}
    </Insignia>
  )
}

const COLORES_ESTADO = {
  Borrador: 'gris',
  'Informes de desempeño': 'cielo',
  Precalificado: 'marca',
  'En junta': 'violeta',
  Calificado: 'esmeralda',
  Apelación: 'ambar',
  Ejecutoriado: 'esmeralda',
}
export function InsigniaEstado({ estado }) {
  return <Insignia color={COLORES_ESTADO[estado] ?? 'gris'}>{estado}</Insignia>
}

export function ConceptoNota({ nota }) {
  if (nota === null || nota === undefined) return <span className="text-xs text-slate-400">—</span>
  const bandas = [
    { min: 9, nombre: 'Óptimo', color: 'esmeralda' },
    { min: 7, nombre: 'Bueno', color: 'cielo' },
    { min: 5, nombre: 'Satisfactorio', color: 'ambar' },
    { min: 3, nombre: 'Insuficiente', color: 'naranja' },
    { min: 1, nombre: 'Deficiente', color: 'rojo' },
  ]
  const b = bandas.find((x) => nota >= x.min)
  return <Insignia color={b.color}>{b.nombre}</Insignia>
}

/* ── Tablas ─────────────────────────────────────────────────────────────── */
export function Tabla({ columnas, datos, vacio = 'Sin registros', onFila, claveFila = (f, i) => f.id ?? i, densa, className = '', seleccionadas = [] }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <table className={`w-full border-collapse text-left ${densa ? 'text-[13px]' : 'text-sm'}`}>
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} className={`whitespace-nowrap px-3 py-2.5 font-semibold ${c.clase || ''}`}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {datos.length === 0 && (
            <tr><td colSpan={columnas.length} className="px-3 py-8 text-center text-sm text-slate-400">{vacio}</td></tr>
          )}
          {datos.map((fila, i) => (
            <tr
              key={claveFila(fila, i)}
              onClick={onFila ? () => onFila(fila) : undefined}
              className={`${onFila ? 'cursor-pointer hover:bg-marca-50/40' : 'hover:bg-slate-50/70'} ${seleccionadas.includes(fila.id) ? 'bg-marca-50/60' : ''} transition`}
            >
              {columnas.map((c) => (
                <td key={c.clave} className={`px-3 py-2 align-middle ${c.clase || ''}`}>
                  {c.render ? c.render(fila) : fila[c.clave]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Modales y avisos ───────────────────────────────────────────────────── */
export function Modal({ abierto, titulo, descripcion, children, onCerrar, ancho = 'max-w-2xl', pie }) {
  const ref = useRef(null)
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar?.()
    if (abierto) document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [abierto, onCerrar])
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8">
      <div ref={ref} className={`my-auto w-full ${ancho} rounded-xl border border-slate-200 bg-white shadow-2xl`}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
            {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
          </div>
          <button onClick={onCerrar} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5"><path d="M6.3 5.3a1 1 0 011.4 0L10 7.6l2.3-2.3a1 1 0 111.4 1.4L11.4 9l2.3 2.3a1 1 0 01-1.4 1.4L10 10.4l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 9 6.3 6.7a1 1 0 010-1.4z" /></svg>
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {pie && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{pie}</footer>}
      </div>
    </div>
  )
}

export function Aviso({ children, tipo = 'info', titulo, className = '', acciones }) {
  const tipos = {
    info: { c: 'border-marca-200 bg-marca-50 text-marca-900', icono: 'M10 2a8 8 0 100 16 8 8 0 000-16zm1 3v2H9V5h2zm0 4v6H9V9h2z' },
    exito: { c: 'border-emerald-200 bg-emerald-50 text-emerald-900', icono: 'M10 2a8 8 0 100 16 8 8 0 000-16zm3.7 6.3l-4.6 4.6-2.4-2.4 1.4-1.4 1 1 3.2-3.2 1.4 1.4z' },
    alerta: { c: 'border-amber-200 bg-amber-50 text-amber-900', icono: 'M10 2l8 15H2L10 2zm0 4.5L5.5 15h9L10 6.5zM9 9h2v3H9V9zm0 4h2v2H9v-2z' },
    error: { c: 'border-rose-200 bg-rose-50 text-rose-900', icono: 'M10 2a8 8 0 100 16 8 8 0 000-16zm1 3v6H9V5h2zm0 8v2H9v-2h2z' },
    norma: { c: 'border-slate-300 bg-slate-50 text-slate-700', icono: 'M4 3h9l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm8 1.5V8h3.5L12 4.5zM6 10h8v1.5H6V10zm0 3h8v1.5H6V13z' },
  }
  const t = tipos[tipo] ?? tipos.info
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm ${t.c} ${className}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0"><path d={t.icono} /></svg>
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div className={titulo ? 'mt-0.5' : ''}>{children}</div>
        {acciones && <div className="mt-2 flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </div>
  )
}

export function Cargando({ texto = 'Cargando información…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-12 text-sm text-slate-500 ${className}`}>
      <span className="size-4 animate-spin rounded-full border-2 border-marca-500 border-t-transparent" />
      {texto}
    </div>
  )
}

export function Vacio({ titulo, descripcion, accion, icono }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      {icono ?? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-8 text-slate-300">
          <path d="M9 13h6m-6 4h3M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
        </svg>
      )}
      <p className="text-sm font-medium text-slate-700">{titulo}</p>
      {descripcion && <p className="max-w-md text-sm text-slate-500">{descripcion}</p>}
      {accion}
    </div>
  )
}

export function Pestanas({ pestanas, activa, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 overflow-x-auto border-b border-slate-200 ${className}`} role="tablist">
      {pestanas.map((p) => (
        <button
          key={p.clave}
          role="tab"
          aria-selected={activa === p.clave}
          onClick={() => onChange(p.clave)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition ${
            activa === p.clave
              ? 'border-marca-600 text-marca-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          }`}
        >
          {p.titulo}
          {p.contador !== undefined && (
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{p.contador}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function BarraProgreso({ valor, total, color = 'marca', altura = 'h-2' }) {
  const pct = total ? Math.min(100, Math.round((valor / total) * 100)) : 0
  const colores = { marca: 'bg-marca-500', esmeralda: 'bg-emerald-500', ambar: 'bg-amber-500', violeta: 'bg-aneiich-500', rojo: 'bg-rose-500' }
  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${altura}`} title={`${valor} de ${total}`}>
      <div className={`h-full rounded-full transition-all ${colores[color]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Muestra una nota con el color del concepto del art. 14. */
export function Nota({ valor, tamano = 'md', tenue }) {
  if (valor === null || valor === undefined) return <span className="text-slate-300">—</span>
  const colores = valor >= 9 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : valor >= 7 ? 'bg-sky-50 text-sky-700 ring-sky-200'
      : valor >= 5 ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : valor >= 3 ? 'bg-orange-50 text-orange-700 ring-orange-200'
          : 'bg-rose-50 text-rose-700 ring-rose-200'
  const tam = tamano === 'sm' ? 'size-7 text-xs' : tamano === 'lg' ? 'size-11 text-lg' : 'size-8 text-sm'
  return (
    <span className={`inline-grid ${tam} place-items-center rounded-lg font-semibold tabular-nums ring-1 ring-inset ${tenue ? 'opacity-80' : ''} ${colores}`}>
      {valor}
    </span>
  )
}

export function Icono({ nombre, className = 'size-5' }) {
  const trazos = {
    tablero: 'M4 4h7v7H4V4zm9 0h7v4h-7V4zM4 13h7v7H4v-7zm9-3h7v10h-7V10z',
    personas: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm7 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 20c0-3 3-5.5 7-5.5S16 17 16 20H2zm15 0c0-1.6-.6-3-1.6-4.2 2.8.3 4.6 2 4.6 4.2h-3z',
    documento: 'M6 2h7l5 5v15H6a1 1 0 01-1-1V3a1 1 0 011-1zm6 1.5V8h4.5L12 3.5zM8 12h8v1.5H8V12zm0 3.5h8V17H8v-1.5z',
    estrella: 'M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.9l-5.3 2.8 1.1-6.1L3.4 9.4l6-.8L12 3z',
    grafico: 'M4 20V10h4v10H4zm6 0V4h4v16h-4zm6 0v-7h4v7h-4z',
    engranaje: 'M12 8a4 4 0 100 8 4 4 0 000-8zm8.4 4.9l1.9 1.5-2 3.4-2.3-.9a7.9 7.9 0 01-2.4 1.4l-.3 2.4h-4l-.3-2.4a7.9 7.9 0 01-2.4-1.4l-2.3.9-2-3.4 1.9-1.5a8.2 8.2 0 010-2.8L1.8 9.6l2-3.4 2.3.9A7.9 7.9 0 018.5 5.7l.3-2.4h4l.3 2.4c.9.3 1.7.8 2.4 1.4l2.3-.9 2 3.4-1.9 1.5a8.2 8.2 0 010 2.8z',
    balanza: 'M12 3v2h5v2h-5v12h3v2H9v-2h3V7H7v9.5a3 3 0 002.8 1.5h.2v2h-.2A5 5 0 015 15V7H3V5h5V3h4z',
    sobre: 'M3 5h18v14H3V5zm2 2v.4l7 4.6 7-4.6V7H5zm14 2.8l-6.4 4.2a1 1 0 01-1.2 0L5 9.8V17h14V9.8z',
    libro: 'M4 4h7v16H4V4zm9 0h7v16h-7V4zM6 7h3v2H6V7zm9 0h3v2h-3V7z',
    aneiich: 'M12 2l2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 15.9l-5.3 2.8 1.1-6.1L3.4 8.4l6-.8L12 2z',
    buscar: 'M10 3a7 7 0 105.3 11.7l4 4 1.4-1.4-4-4A7 7 0 0010 3zm0 2a5 5 0 110 10 5 5 0 010-10z',
    imprimir: 'M7 3h10v4H7V3zm-3 5h16a1 1 0 011 1v7h-4v3H6v-3H3V9a1 1 0 011-1zm3 8v2h10v-2H7z',
    mas: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z',
    descargar: 'M11 3h2v9.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4L11 12.6V3zM5 19h14v2H5v-2z',
    cerrar: 'M6.3 5.3a1 1 0 011.4 0L12 9.6l4.3-4.3a1 1 0 111.4 1.4L13.4 11l4.3 4.3a1 1 0 01-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 01-1.4-1.4L10.6 11 6.3 6.7a1 1 0 010-1.4z',
    alerta: 'M12 2l10 18H2L12 2zm0 6l-6 11h12L12 8zm-1 3h2v4h-2v-4zm0 5h2v2h-2v-2z',
    check: 'M9.6 16.6L4.8 11.8l1.4-1.4 3.4 3.4L17.8 5.6l1.4 1.4-9.6 9.6z',
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={trazos[nombre] ?? trazos.documento} />
    </svg>
  )
}
