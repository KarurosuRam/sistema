import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, consulta } from './api'

const Contexto = createContext(null)

export function Proveedor({ children }) {
  const [meta, setMeta] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [periodoId, setPeriodoId] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const datos = await api.get('/api/meta')
      setMeta(datos)
      setError(null)
      setPeriodoId((actual) => actual ?? datos.periodos?.find((p) => p.vigente)?.id ?? datos.periodos?.[0]?.id ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const valor = useMemo(() => ({
    meta,
    cargando,
    error,
    recargar: cargar,
    periodoId: periodoId ? Number(periodoId) : null,
    setPeriodoId,
    periodo: meta?.periodos?.find((p) => p.id === Number(periodoId)) ?? null,
    periodos: meta?.periodos ?? [],
    unidades: meta?.unidades ?? [],
    factores: meta?.factores ?? [],
    subfactores: meta?.subfactores ?? [],
    coeficientes: meta?.coeficientes ?? {},
    lista: (ruta, extra) => api.get(`${ruta}${consulta({ periodo: periodoId, ...extra })}`),
  }), [meta, cargando, error, cargar, periodoId])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSistema() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useSistema debe usarse dentro del proveedor')
  return ctx
}

/** Hook simple de carga de datos con dependencias. */
export function useDatos(fn, deps = []) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    Promise.resolve()
      .then(fn)
      .then((r) => { if (vivo) { setDatos(r); setError(null) } })
      .catch((e) => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, recarga])

  return { datos, cargando, error, recargar: () => setRecarga((n) => n + 1) }
}
