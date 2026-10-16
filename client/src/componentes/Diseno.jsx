import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useSistema } from '../contexto'
import { Boton, Icono, Insignia, Selector } from './ui'

const NAVEGACION = [
  { seccion: 'Proceso calificatorio', items: [
    { ruta: '/', titulo: 'Tablero', icono: 'tablero', exacto: true },
    { ruta: '/calificaciones', titulo: 'Calificaciones', icono: 'documento' },
    { ruta: '/juntas', titulo: 'Juntas y actas', icono: 'balanza' },
    { ruta: '/escalafon', titulo: 'Escalafón de mérito', icono: 'grafico' },
  ] },
  { seccion: 'Dotación', items: [
    { ruta: '/funcionarios', titulo: 'Funcionarios', icono: 'personas' },
    { ruta: '/jefes', titulo: 'Jefes evaluadores', icono: 'estrella' },
    { ruta: '/aneiich', titulo: 'Padrón ANEIICH', icono: 'aneiich', destacado: true },
  ] },
  { seccion: 'Sistema', items: [
    { ruta: '/reportes', titulo: 'Reportes y exportación', icono: 'descargar' },
    { ruta: '/ajustes', titulo: 'Ajustes y datos', icono: 'engranaje' },
  ] },
]

function Enlace({ item, alCerrar }) {
  return (
    <NavLink
      to={item.ruta}
      end={item.exacto}
      onClick={alCerrar}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive
            ? item.destacado ? 'bg-aneiich-500/15 text-aneiich-100' : 'bg-white/10 text-white'
            : 'text-marca-100/75 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icono nombre={item.icono} className={`size-4.5 shrink-0 ${item.destacado ? 'text-aneiich-100' : ''}`} />
      <span className="truncate">{item.titulo}</span>
    </NavLink>
  )
}

function Menu({ alCerrar }) {
  const { meta } = useSistema()
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAVEGACION.map((grupo) => (
        <div key={grupo.seccion}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-marca-200/60">{grupo.seccion}</p>
          <div className="flex flex-col gap-0.5">
            {grupo.items.map((item) => <Enlace key={item.ruta} item={item} alCerrar={alCerrar} />)}
          </div>
        </div>
      ))}
      <div className="mt-auto rounded-lg bg-white/5 p-3 text-[11px] leading-relaxed text-marca-100/70">
        <p className="font-semibold text-marca-100">Marco normativo</p>
        <p className="mt-1">{meta?.normas?.slice(0, 96) ?? 'DTO 1825/1998 — Reglamento de Calificaciones del personal afecto al Estatuto Administrativo.'}…</p>
      </div>
    </nav>
  )
}

export function Diseno({ children }) {
  const { meta, periodoId, setPeriodoId, periodos } = useSistema()
  const [abierto, setAbierto] = useState(false)
  const [salud, setSalud] = useState(null)
  const ubicacion = useLocation()

  useEffect(() => {
    setAbierto(false)
    window.scrollTo({ top: 0 })
  }, [ubicacion.pathname])

  useEffect(() => {
    api.get('/api/salud').then(setSalud).catch(() => {})
  }, [ubicacion.pathname])

  const salir = async () => {
    await api.post('/api/sesion/salir')
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Barra lateral */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-marca-900 transition-transform lg:static lg:translate-x-0 ${abierto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-white">
            <Icono nombre="balanza" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Calificaciones</p>
            <p className="truncate text-[11px] text-marca-200/80">{meta?.sigla ?? 'SII'} · DTO 1825/1998</p>
          </div>
        </div>
        <Menu alCerrar={() => setAbierto(false)} />
        <div className="border-t border-white/10 p-3">
          <button onClick={salir} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-marca-100/70 transition hover:bg-white/5 hover:text-white">
            <Icono nombre="cerrar" className="size-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {abierto && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setAbierto(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="no-imprimir sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur md:px-6">
          <button onClick={() => setAbierto((v) => !v)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Menú">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" /></svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{meta?.institucion ?? 'Servicio'}</p>
            <p className="truncate text-[11px] text-slate-500">{meta?.unidad_personal ?? 'Unidad encargada de personal'}</p>
          </div>

          <div className="flex items-center gap-2">
            <Insignia color="violeta" titulo={meta?.asociacion_detalle}>
              <Icono nombre="aneiich" className="size-3" />
              {meta?.asociacion ?? 'ANEIICH'} {salud?.funcionarios ? `· ${salud.funcionarios} funcionarios` : ''}
            </Insignia>
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Período</span>
              <Selector
                value={periodoId ?? ''}
                onChange={(e) => setPeriodoId(Number(e.target.value))}
                className="!border-0 !py-0 !pr-6 !pl-0 !shadow-none focus:!ring-0"
              >
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.anio} ({p.fecha_inicio?.slice(0, 7)} → {p.fecha_termino?.slice(0, 7)}){p.estado === 'En proceso' ? ' · en proceso' : ''}
                  </option>
                ))}
              </Selector>
            </label>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>

        <footer className="no-imprimir border-t border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500 md:px-6">
          Sistema de Calificaciones · {meta?.institucion}. Las notas de los subfactores deben expresarse en números enteros de 1 a 10 y los
          factores se ponderan por los coeficientes del art. 17 del DTO 1825/1998.
        </footer>
      </div>
    </div>
  )
}

export function EncabezadoPagina({ titulo, descripcion, acciones, migas }) {
  return (
    <div className="no-imprimir mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {migas && <p className="mb-1 text-xs text-slate-500">{migas}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-3xl text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}

export { Boton }
