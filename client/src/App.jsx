import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api, alExpirarSesion } from './api'
import { Proveedor, useSistema } from './contexto'
import { Diseno } from './componentes/Diseno'
import { Aviso, Boton, Cargando, Entrada, Icono, Insignia } from './componentes/ui'

import Tablero from './paginas/Tablero'
import Funcionarios from './paginas/Funcionarios'
import FuncionarioFicha from './paginas/FuncionarioFicha'
import Jefes from './paginas/Jefes'
import Calificaciones from './paginas/Calificaciones'
import CalificacionFicha from './paginas/CalificacionFicha'
import Juntas from './paginas/Juntas'
import Escalafon from './paginas/Escalafon'
import Aneiich from './paginas/Aneiich'
import Reportes from './paginas/Reportes'
import Ajustes from './paginas/Ajustes'

/* ── Pantalla de acceso (clave única del servicio) ──────────────────────── */
function Acceso({ alIngresar }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    api.get('/api/sesion').then(setInfo).catch(() => {})
  }, [])

  const ingresar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await api.post('/api/sesion', { clave })
      alIngresar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-marca-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3 text-white">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10"><Icono nombre="balanza" className="size-6" /></span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Sistema de Calificaciones</h1>
            <p className="text-xs text-marca-200/80">{info?.institucion ?? 'Servicio de Impuestos Internos'} · DTO 1825/1998</p>
          </div>
        </div>

        <form onSubmit={ingresar} className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl">
          <h2 className="text-base font-semibold text-slate-900">Acceso a la unidad encargada de personal</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ingrese la clave del servicio. Desde aquí podrá administrar el proceso calificatorio del personal afecto al Estatuto
            Administrativo y el padrón de asociados a {info?.asociacion ?? 'ANEIICH'}.
          </p>

          <label className="mt-5 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Clave de acceso</span>
            <Entrada type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="••••••••" autoFocus />
          </label>

          {error && <Aviso tipo="error" className="mt-3">{error}</Aviso>}

          <Boton tipo="submit" cargando={enviando} className="mt-5 w-full" tamano="lg">Ingresar</Boton>

          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            <p className="font-medium text-slate-600">Instalación de demostración</p>
            <p className="mt-0.5">Clave inicial: <code className="rounded bg-white px-1 py-0.5 font-mono text-slate-700 ring-1 ring-slate-200">sii2025</code> (modificable en Ajustes).</p>
          </div>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-marca-200/70">
          <Icono nombre="aneiich" className="size-3" /> Padrón de asociados a {info?.asociacion ?? 'ANEIICH'} disponible en el sistema
        </p>
      </div>
    </div>
  )
}

/* ── Aplicación ─────────────────────────────────────────────────────────── */
function Contenido() {
  const { meta, cargando, error, recargar } = useSistema()
  if (cargando && !meta) return <div className="grid min-h-screen place-items-center"><Cargando texto="Cargando el sistema…" /></div>
  if (error && !meta) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-lg">
          <Aviso tipo="error" titulo="No se pudo cargar la configuración">{error}</Aviso>
          <Boton className="mt-3" onClick={recargar}>Reintentar</Boton>
        </div>
      </div>
    )
  }
  return (
    <Diseno>
      <Routes>
        <Route path="/" element={<Tablero />} />
        <Route path="/funcionarios" element={<Funcionarios />} />
        <Route path="/funcionarios/:id" element={<FuncionarioFicha />} />
        <Route path="/jefes" element={<Jefes />} />
        <Route path="/jefes/:id" element={<Jefes />} />
        <Route path="/calificaciones" element={<Calificaciones />} />
        <Route path="/calificaciones/:id" element={<CalificacionFicha />} />
        <Route path="/juntas" element={<Juntas />} />
        <Route path="/escalafon" element={<Escalafon />} />
        <Route path="/aneiich" element={<Aneiich />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Diseno>
  )
}

export default function App() {
  const [estado, setEstado] = useState('verificando')

  const verificar = useCallback(async () => {
    try {
      const r = await api.get('/api/sesion')
      setEstado(r.autenticado ? 'dentro' : 'fuera')
    } catch {
      setEstado('fuera')
    }
  }, [])

  useEffect(() => {
    alExpirarSesion(() => setEstado('fuera'))
    verificar()
    const t = setInterval(verificar, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [verificar])

  if (estado === 'verificando') {
    return (
      <div className="grid min-h-screen place-items-center bg-marca-900">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-white/10 text-white"><Icono nombre="balanza" className="size-6" /></span>
          <Cargando texto="Verificando la sesión…" className="!text-marca-100" />
        </div>
      </div>
    )
  }

  if (estado === 'fuera') return <Acceso alIngresar={() => setEstado('dentro')} />

  return (
    <Proveedor>
      <Contenido />
    </Proveedor>
  )
}

export { Insignia }
