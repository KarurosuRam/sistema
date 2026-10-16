import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, descargar, consulta } from '../api'
import { useDatos, useSistema } from '../contexto'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, BarraProgreso, Boton, Campo, Cargando, ConceptoNota, Entrada, Icono, Indicador, Insignia,
  InsigniaAneiich, InsigniaEstado, InsigniaLista, Modal, Seccion, Selector, Tabla, Tarjeta, Vacio,
} from '../componentes/ui'

const nf = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export default function Calificaciones() {
  const { periodo, lista, meta, recargar: recargarMeta } = useSistema()
  const navegar = useNavigate()
  const [filtros, setFiltros] = useState({ buscar: '', estado: '', lista: '', planta: '', unidad: '', jefe: '', aneiich: '', pendientes: '' })
  const [aviso, setAviso] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const { datos, cargando, error, recargar } = useDatos(() => lista('/api/calificaciones', filtros), [periodo?.id, JSON.stringify(filtros)])
  const { datos: jefes } = useDatos(() => api.get('/api/jefes'), [])

  const resumen = datos?.resumen ?? {}
  const fichas = datos?.datos ?? []

  const grupos = useMemo(() => {
    const g = {}
    for (const f of fichas) {
      const estamento = f.planta
      g[estamento] ??= { n: 0, suma: 0, conPuntaje: 0 }
      g[estamento].n++
      if (f.puntaje !== null) { g[estamento].suma += f.puntaje; g[estamento].conPuntaje++ }
    }
    return Object.entries(g).map(([estamento, v]) => ({ estamento, n: v.n, promedio: v.conPuntaje ? v.suma / v.conPuntaje : null }))
  }, [fichas])

  const generar = async () => {
    setGenerando(true)
    try {
      const r = await api.post('/api/calificaciones/generar', { periodo_id: periodo?.id })
      setResultado(r)
      recargar()
      recargarMeta()
    } catch (e) {
      setAviso({ tipo: 'error', titulo: 'No se pudieron generar las fichas', texto: e.message })
    } finally { setGenerando(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo={`Calificaciones del período ${periodo?.anio ?? ''}`}
        descripcion="Cada fila abre la hoja de calificación del funcionario, con las notas, los argumentos y la votación de la Junta Calificadora en cada subfactor."
        acciones={<>
          <Boton variante="secundario" onClick={() => descargar(`/api/reportes/calificaciones.csv${consulta({ periodo: periodo?.id })}`, `calificaciones-${periodo?.anio}.csv`)}>
            <Icono nombre="descargar" className="size-4" /> Exportar CSV
          </Boton>
          <Boton cargando={generando} onClick={generar}><Icono nombre="mas" className="size-4" /> Generar fichas del período</Boton>
        </>}
      />

      {aviso && <Aviso tipo={aviso.tipo} titulo={aviso.titulo}>{aviso.texto}</Aviso>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Fichas del período" valor={resumen.fichas ?? 0} detalle={`${resumen.ejecutoriadas ?? 0} ejecutoriadas · ${resumen.calificadas ?? 0} calificadas`} icono={<Icono nombre="documento" className="size-4" />} />
        <Indicador titulo="En junta / precalificadas" valor={`${resumen.en_junta ?? 0} / ${resumen.precalificadas ?? 0}`} detalle="Etapas de calificación y precalificación" color="violeta" icono={<Icono nombre="balanza" className="size-4" />} />
        <Indicador titulo="Puntaje promedio" valor={nf(resumen.promedio)} detalle={`Lista N°1: ${resumen.lista1 ?? 0} · N°2: ${resumen.lista2 ?? 0}`} color="esmeralda" icono={<Icono nombre="grafico" className="size-4" />} />
        <Indicador titulo="Casos críticos" valor={`${(resumen.lista3 ?? 0) + (resumen.lista4 ?? 0)}`} detalle={`${resumen.lista3 ?? 0} en Lista N°3 · ${resumen.lista4 ?? 0} en Lista N°4`} color="rojo" icono={<Icono nombre="alerta" className="size-4" />} />
      </div>

      <Tarjeta>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Campo etiqueta="Buscar funcionario">
            <Entrada placeholder="Nombre, RUT o cargo…" value={filtros.buscar} onChange={(e) => setFiltros((x) => ({ ...x, buscar: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Etapa del proceso">
            <Selector placeholder="Todas las etapas" value={filtros.estado} onChange={(e) => setFiltros((x) => ({ ...x, estado: e.target.value }))}
              opciones={(meta?.estadosCalificacion ?? []).map((e) => e.clave)} />
          </Campo>
          <Campo etiqueta="Estamento">
            <Selector placeholder="Todos los estamentos" value={filtros.planta} onChange={(e) => setFiltros((x) => ({ ...x, planta: e.target.value }))} opciones={meta?.estamentos ?? []} />
          </Campo>
          <Campo etiqueta="Unidad">
            <Selector placeholder="Todas las unidades" value={filtros.unidad} onChange={(e) => setFiltros((x) => ({ ...x, unidad: e.target.value }))}
              opciones={(meta?.unidades ?? []).map((u) => ({ valor: u.id, etiqueta: u.nombre }))} />
          </Campo>
          <Campo etiqueta="Jefe evaluador">
            <Selector placeholder="Todos los jefes" value={filtros.jefe} onChange={(e) => setFiltros((x) => ({ ...x, jefe: e.target.value }))}
              opciones={(jefes?.datos ?? []).map((j) => ({ valor: j.id, etiqueta: j.nombre_completo }))} />
          </Campo>
          <Campo etiqueta="Lista de calificación">
            <Selector placeholder="Todas las listas" value={filtros.lista} onChange={(e) => setFiltros((x) => ({ ...x, lista: e.target.value }))}
              opciones={(meta?.listas ?? []).map((l) => ({ valor: l.numero, etiqueta: `Lista N°${l.numero} ${l.nombre}` }))} />
          </Campo>
          <Campo etiqueta="Condición ANEIICH">
            <Selector placeholder="Todos" value={filtros.aneiich} onChange={(e) => setFiltros((x) => ({ ...x, aneiich: e.target.value }))}
              opciones={[{ valor: '1', etiqueta: `Sólo asociados a ${meta?.asociacion ?? 'ANEIICH'}` }, { valor: '0', etiqueta: 'Sólo no asociados' }]} />
          </Campo>
          <Campo etiqueta="Pendientes">
            <Selector placeholder="Todas las fichas" value={filtros.pendientes} onChange={(e) => setFiltros((x) => ({ ...x, pendientes: e.target.value }))}
              opciones={[{ valor: '1', etiqueta: 'Sólo fichas en proceso' }]} />
          </Campo>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            {grupos.map((g) => (
              <span key={g.estamento} className="rounded-lg bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                {g.estamento}: <strong>{g.n}</strong> fichas{g.promedio ? ` · prom. ${nf(g.promedio)}` : ''}
              </span>
            ))}
          </div>
          <Boton variante="secundario" tamano="sm" onClick={() => setFiltros({ buscar: '', estado: '', lista: '', planta: '', unidad: '', jefe: '', aneiich: '', pendientes: '' })}>
            Limpiar filtros
          </Boton>
        </div>
      </Tarjeta>

      {cargando && !datos ? <Cargando /> : (
        <Tabla
          densa
          onFila={(f) => navegar(`/calificaciones/${f.id}`)}
          columnas={[
            { clave: 'funcionario', titulo: 'Funcionario', render: (f) => (
              <div className="flex items-center gap-2">
                {f.aneiich && <span className="size-2 shrink-0 rounded-full bg-aneiich-500" title={`Asociado a ${meta?.asociacion}`} />}
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-slate-800">
                    <span className="truncate">{f.nombre_completo}</span>
                    {f.aneiich && <InsigniaAneiich compacta />}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{f.rut} · {f.cargo ?? 'Sin cargo'} · {f.unidad_nombre ?? 'Sin unidad'}</p>
                </div>
              </div>
            ) },
            { clave: 'grado', titulo: 'Grado', clase: 'text-right tabular-nums' },
            { clave: 'planta', titulo: 'Estamento', render: (f) => <span className="text-xs text-slate-600">{f.planta}</span> },
            { clave: 'estado', titulo: 'Etapa', render: (f) => <InsigniaEstado estado={f.estado} /> },
            { clave: 'precal', titulo: 'Precalificación', render: (f) => (
              <div className="text-xs">
                {f.precal_efectuada ? (
                  <>
                    <p className="tabular-nums font-medium text-slate-800">{nf(f.puntaje_calculado ?? f.puntaje)} pts</p>
                    <p className="truncate text-[10px] text-slate-500">por {f.precal_jefe_nombre ?? '—'}</p>
                  </>
                ) : <span className="text-slate-400">pendiente</span>}
              </div>
            ) },
            { clave: 'votacion', titulo: 'Votación junta', render: (f) => (
              <div className="w-28">
                <BarraProgreso valor={f.votos_registrados} total={f.votos_esperados || 30} color={f.votos_registrados >= (f.votos_esperados || 30) ? 'esmeralda' : 'violeta'} altura="h-1.5" />
                <p className="mt-1 text-[10px] text-slate-500">{f.votos_registrados} de {f.votos_esperados} votos</p>
              </div>
            ) },
            { clave: 'puntaje', titulo: 'Puntaje', clase: 'text-right', render: (f) => (
              <span className={`tabular-nums font-semibold ${f.puntaje === null ? 'text-slate-400' : 'text-slate-900'}`}>{nf(f.puntaje)}</span>
            ) },
            { clave: 'lista', titulo: 'Lista', render: (f) => <InsigniaLista lista={f.lista} /> },
            { clave: 'concepto', titulo: 'Concepto', render: (f) => <ConceptoNota nota={f.puntaje !== null ? Math.round(f.puntaje / 10) : null} /> },
            { clave: 'acciones', titulo: '', render: (f) => (
              <Link to={`/calificaciones/${f.id}`} className="text-xs font-medium text-marca-700 hover:underline">Abrir hoja</Link>
            ) },
          ]}
          datos={fichas}
          vacio="No hay fichas de calificación con los filtros seleccionados"
        />
      )}

      {resultado && (
        <Modal abierto titulo="Generación de fichas del período" onCerrar={() => setResultado(null)}
          descripcion={`Período ${resultado.periodo?.anio}: ${resultado.creadas} fichas creadas, ${resultado.existentes} ya existían.`}
          pie={<Boton onClick={() => setResultado(null)}>Entendido</Boton>}
        >
          <Aviso tipo="norma" className="mb-4">
            Se crea una ficha por cada funcionario afecto a calificación. Los funcionarios excluidos del art. 5 quedan registrados en la
            auditoría del sistema con su causal, y conservan su última calificación.
          </Aviso>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Excluidos de calificación ({resultado.no_calificables?.length ?? 0})</h4>
          <Tabla
            densa
            columnas={[
              { clave: 'nombre', titulo: 'Funcionario' },
              { clave: 'causal', titulo: 'Causal (art. 5)' },
            ]}
            datos={resultado.no_calificables ?? []}
            vacio="Sin exclusiones"
          />
        </Modal>
      )}

      {!fichas.length && !cargando && (
        <Vacio
          titulo="No hay calificaciones registradas en este período"
          descripcion="Genere las fichas del período para comenzar el proceso: se creará una hoja por cada funcionario afecto a calificación."
          accion={<Boton className="mt-2" cargando={generando} onClick={generar}>Generar fichas del período {periodo?.anio}</Boton>}
        />
      )}
    </div>
  )
}
