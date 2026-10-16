import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useDatos, useSistema } from '../contexto'
import { Barras } from '../componentes/Graficos'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, BarraProgreso, Boton, Cargando, Icono, Indicador, Insignia, InsigniaAneiich, InsigniaEstado,
  InsigniaLista, Seccion, Tabla, Tarjeta,
} from '../componentes/ui'

const nf = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export default function Jefes() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { periodo, meta } = useSistema()
  const [seleccionado, setSeleccionado] = useState(id ? Number(id) : null)

  const { datos, cargando, error } = useDatos(() => api.get(`/api/jefes?periodo=${periodo?.id ?? ''}`), [periodo?.id])
  const { datos: detalle, cargando: cargandoDetalle } = useDatos(
    () => (seleccionado ? api.get(`/api/jefes/${seleccionado}?periodo=${periodo?.id ?? ''}`) : Promise.resolve(null)),
    [seleccionado, periodo?.id]
  )

  const jefes = datos?.datos ?? []
  const totalDependientes = jefes.reduce((a, j) => a + (j.dependientes ?? 0), 0)
  const pendientes = jefes.reduce((a, j) => a + (j.pendientes ?? 0), 0)
  const conFichas = jefes.filter((j) => (j.fichas ?? 0) > 0).length

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Base de datos de jefes evaluadores"
        descripcion="Funcionarios que efectúan precalificaciones (arts. 19 a 21), con el avance de sus obligaciones en el período seleccionado."
        acciones={<Link to="/funcionarios"><Boton variante="secundario">Ver funcionarios</Boton></Link>}
      />

      {error && <Aviso tipo="error" titulo="No fue posible cargar la información">{error}</Aviso>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Jefes evaluadores" valor={jefes.length} detalle={`${conFichas} con personal a cargo en el período`} icono={<Icono nombre="estrella" className="size-4" />} />
        <Indicador titulo="Funcionarios dependientes" valor={totalDependientes} detalle="Sujetos a precalificación" color="marca" icono={<Icono nombre="personas" className="size-4" />} />
        <Indicador titulo="Precalificaciones pendientes" valor={pendientes} detalle="Deben notificarse dentro del plazo del art. 20" color="ambar" icono={<Icono nombre="alerta" className="size-4" />} />
        <Indicador titulo="Promedio de sus dependientes" valor={nf(jefes.filter((j) => j.promedio_dependientes !== null).reduce((a, j, _, arr) => a + j.promedio_dependientes / arr.length, 0))} detalle="Sobre las fichas con puntaje" color="esmeralda" icono={<Icono nombre="grafico" className="size-4" />} />
      </div>

      {cargando && !datos ? <Cargando /> : (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-4">
            <Tabla
              densa
              onFila={(j) => { setSeleccionado(j.id); navegar(`/jefes/${j.id}`) }}
              columnas={[
                { clave: 'jefe', titulo: 'Jefe evaluador', render: (j) => (
                  <div className="flex items-center gap-2">
                    {j.aneiich && <span className="size-2 rounded-full bg-aneiich-500" />}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span className="truncate">{j.nombre_completo}</span>
                        {j.aneiich && <InsigniaAneiich compacta />}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{j.cargo ?? '—'} · {j.unidad_nombre ?? 'sin unidad'}</p>
                    </div>
                  </div>
                ) },
                { clave: 'grado', titulo: 'Grado', clase: 'text-right tabular-nums' },
                { clave: 'dependientes', titulo: 'Depend.', clase: 'text-right tabular-nums' },
                { clave: 'avance', titulo: 'Precalificaciones', render: (j) => (
                  <div className="w-36">
                    <BarraProgreso valor={j.precalificados ?? 0} total={Math.max(1, j.fichas ?? 0)} color={(j.pendientes ?? 0) === 0 ? 'esmeralda' : 'ambar'} altura="h-1.5" />
                    <p className="mt-1 text-[10px] text-slate-500">{j.precalificados ?? 0} de {j.fichas ?? 0} · {j.pendientes ?? 0} pendientes</p>
                  </div>
                ) },
                { clave: 'promedio_dependientes', titulo: 'Prom. depend.', clase: 'text-right tabular-nums' },
                { clave: 'promedio_propio', titulo: 'Prom. propio', clase: 'text-right tabular-nums text-slate-500' },
                { clave: 'juntas_presididas', titulo: 'Juntas', clase: 'text-right tabular-nums text-slate-500' },
              ]}
              datos={jefes}
              vacio="No hay jefes evaluadores registrados"
            />

            <Tarjeta>
              <Seccion titulo="Carga de trabajo por jefatura" descripcion="Cantidad de funcionarios cuya precalificación corresponde a cada jefe directo.">
                <Barras
                  horizontal altura={Math.max(220, jefes.length * 30)}
                  datos={jefes.slice(0, 12).map((j) => ({ nombre: j.nombre_completo?.split(' ').slice(0, 2).join(' '), Funcionarios: j.dependientes, Precalificados: j.precalificados ?? 0 }))}
                  categorias={[
                    { clave: 'Funcionarios', titulo: 'Dependientes', color: '#94a3b8' },
                    { clave: 'Precalificados', titulo: 'Precalificados', color: '#10b981' },
                  ]}
                />
              </Seccion>
            </Tarjeta>
          </div>

          <div className="flex flex-col gap-4">
            {cargandoDetalle && <Cargando texto="Cargando el detalle del jefe…" />}
            {detalle?.jefe && (
              <>
                <Tarjeta>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{detalle.jefe.nombre_completo}</h3>
                      <p className="text-xs text-slate-500">{detalle.jefe.cargo} · grado {detalle.jefe.grado} · {detalle.jefe.unidad_nombre}</p>
                      <p className="mt-1 text-xs text-slate-500">Precalifica a <strong>{detalle.dependientes.length}</strong> funcionarios</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {detalle.jefe.aneiich && <InsigniaAneiich rol={detalle.jefe.rol_aneiich} />}
                      <InsigniaLista lista={detalle.jefe.lista} puntaje={detalle.jefe.puntaje} />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link to={`/funcionarios/${detalle.jefe.id}`}><Boton variante="secundario" tamano="sm">Ver ficha</Boton></Link>
                    {detalle.jefe.cal_id && <Link to={`/calificaciones/${detalle.jefe.cal_id}`}><Boton tamano="sm">Su hoja de calificación</Boton></Link>}
                  </div>
                </Tarjeta>

                <Tarjeta padding={false}>
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <h4 className="text-sm font-semibold text-slate-800">Personal dependiente</h4>
                    <p className="text-xs text-slate-500">Estado de la precalificación y de la calificación en el período {periodo?.anio}</p>
                  </div>
                  <Tabla
                    densa
                    columnas={[
                      { clave: 'nombre', titulo: 'Funcionario', render: (d) => (
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium text-slate-800">
                            <span className="truncate">{d.nombre_completo}</span>
                            {d.aneiich && <Icono nombre="aneiich" className="size-3.5 shrink-0 text-aneiich-500" />}
                          </p>
                          <p className="text-[11px] text-slate-500">grado {d.grado} · {d.planta}</p>
                        </div>
                      ) },
                      { clave: 'precal', titulo: 'Precalificación', render: (d) => (d.precal_efectuada
                        ? <Insignia color="esmeralda">efectuada {d.precal_fecha ? `· ${d.precal_fecha}` : ''}</Insignia>
                        : <Insignia color="ambar">pendiente</Insignia>) },
                      { clave: 'estado', titulo: 'Etapa', render: (d) => (d.cal_estado ? <InsigniaEstado estado={d.cal_estado} /> : <span className="text-[11px] text-slate-400">sin ficha</span>) },
                      { clave: 'puntaje', titulo: 'Puntaje', clase: 'text-right tabular-nums', render: (d) => nf(d.puntaje) },
                      { clave: '', titulo: '', render: (d) => (d.cal_id ? <Link to={`/calificaciones/${d.cal_id}`} className="text-xs font-medium text-marca-700 hover:underline">Abrir</Link> : null) },
                    ]}
                    datos={detalle.dependientes}
                    vacio="Sin dependientes asignados"
                  />
                </Tarjeta>
              </>
            )}
            {!seleccionado && !cargandoDetalle && (
              <Tarjeta>
                <h3 className="text-sm font-semibold text-slate-800">Detalle del jefe evaluador</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Seleccione una fila del listado para ver el personal dependiente, el estado de sus precalificaciones y sus propias
                  calificaciones como funcionario (el jefe también es calificado, salvo que integre la junta o esté en alguna causal del
                  art. 5).
                </p>
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Recuerde</p>
                  <p className="mt-1">Si el funcionario tuvo más de un jefe durante el período, precalifica el último jefe inmediato, quien debe requerir informe a los otros jefes (art. 21).</p>
                </div>
              </Tarjeta>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
