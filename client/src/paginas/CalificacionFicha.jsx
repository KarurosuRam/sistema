import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, descargar } from '../api'
import { PanelAcuerdo } from './PanelAcuerdo'
import { useDatos, useSistema } from '../contexto'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, AreaTexto, BarraProgreso, Boton, Campo, Cargando, ConceptoNota, Conmutador, Entrada, Icono,
  Insignia, InsigniaAneiich, InsigniaEstado, InsigniaLista, Modal, Nota, Pestanas, Seccion, Selector, Tabla,
  Tarjeta, Vacio,
} from '../componentes/ui'

const nf = (v, d = 2) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }))
const fecha = (f) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : '—')
const fechaCorta = (f) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-CL') : '—')

export default function CalificacionFicha() {
  const { id } = useParams()
  const { periodo, meta, recargar: recargarMeta } = useSistema()
  const { datos, cargando, error, recargar } = useDatos(() => api.get(`/api/calificaciones/${id}`), [id])
  const [pestana, setPestana] = useState('hoja')
  const [aviso, setAviso] = useState(null)

  const recargarTodo = () => { recargar(); recargarMeta() }

  if (cargando && !datos) return <Cargando texto="Abriendo la hoja de calificación…" />
  if (error) return <Aviso tipo="error" titulo="No fue posible abrir la ficha">{error}</Aviso>
  if (!datos) return null

  const { calificacion: cal, funcionario, factores, subfactores, calculo, calculo_precalificacion: calcPrecal, calculo_junta: calcJunta, junta, integrantes, elegibilidad } = datos

  return (
    <div className="flex flex-col gap-5">
      <div className="no-imprimir">
        <EncabezadoPagina
          migas={<Link to="/calificaciones" className="hover:text-marca-700">Calificaciones</Link>}
          titulo={`Hoja de calificación ${datos.periodo?.anio}`}
          descripcion={`${datos.funcionario_nombre} · ${funcionario.cargo ?? 'Sin cargo'} · grado ${funcionario.grado ?? '—'} · ${funcionario.razon_social ?? ''}${datos.calificacion.planta_aplicada}`}
          acciones={<>
            <Boton variante="secundario" onClick={() => window.print()}>
              <Icono nombre="imprimir" className="size-4" /> Imprimir / PDF
            </Boton>
            <Boton variante="secundario" onClick={() => descargar(`/api/calificaciones/${id}/votos.csv`, `votacion-junta-${id}.csv`)}>
              <Icono nombre="descargar" className="size-4" /> Votación CSV
            </Boton>
            <BotonesFlujo datos={datos} onListo={recargarTodo} setAviso={setAviso} recargar={recargar} />
          </>}
        />
      </div>

      {aviso && <div className="no-imprimir"><Aviso tipo={aviso.tipo} titulo={aviso.titulo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso></div>}

      {/* Cabecera de identificación */}
      <Tarjeta className={`hoja-impresion ${datos.aneiich ? 'ring-1 ring-aneiich-100' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">{datos.funcionario_nombre}</h2>
              {datos.aneiich && <InsigniaAneiich rol={funcionario.rol_aneiich} />}
              <InsigniaEstado estado={cal.estado} />
              {cal.lista && <InsigniaLista lista={cal.lista} puntaje={nf(cal.puntaje)} grande />}
            </div>
            <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Dato etiqueta="RUT" valor={funcionario.rut} />
              <Dato etiqueta="Cargo" valor={funcionario.cargo} />
              <Dato etiqueta="Grado / nivel" valor={funcionario.grado} />
              <Dato etiqueta="Estamento (art. 17)" valor={`${cal.planta_aplicada} · coef. ${datos.coeficientes.rendimiento}/${datos.coeficientes.condiciones}/${datos.coeficientes.comportamiento}`} />
              <Dato etiqueta="Calidad jurídica" valor={funcionario.calidad_juridica} />
              <Dato etiqueta="Jornada" valor={funcionario.jornada ?? '—'} />
              <Dato etiqueta="Unidad" valor={datos.calificacion.unidad_nombre ?? '—'} />
              <Dato etiqueta="Región" valor={datos.calificacion.region ?? '—'} />
              <Dato etiqueta="Jefe directo (precalificador)" valor={cal.precal_jefe_nombre ?? '—'} />
              <Dato etiqueta="Período calificado" valor={`${fechaCorta(datos.periodo.fecha_inicio)} al ${fechaCorta(datos.periodo.fecha_termino)}`} />
              <Dato etiqueta="Ingreso al servicio" valor={fechaCorta(funcionario.fecha_ingreso_servicio)} />
              <Dato etiqueta="Promoción al grado actual" valor={fechaCorta(funcionario.fecha_ingreso_grado)} />
            </dl>
            {!elegibilidad?.calificable && (
              <Aviso tipo="alerta" className="mt-3" titulo="Funcionario excluido de calificación (art. 5)">{elegibilidad.causal}</Aviso>
            )}
          </div>

          <div className="w-full max-w-xs shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Puntaje y lista</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{nf(cal.puntaje)}</p>
            <p className="text-xs text-slate-500">
              Precalificación: {nf(calcPrecal?.puntaje)}
              {calcJunta && <> · Acuerdo junta: {nf(calcJunta.puntaje)}</>}
            </p>
            <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
              {Object.entries(calculo.factores).map(([k, f]) => (
                <div key={k} className="flex items-center justify-between py-0.5">
                  <span>{meta?.factores?.find((x) => x.clave === k)?.nombre ?? k}</span>
                  <span className="tabular-nums">{nf(f.nota)} × {f.coeficiente} = <strong>{nf(f.puntos)}</strong></span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 font-semibold text-slate-800">
                <span>Puntaje final</span><span className="tabular-nums">{nf(calculo.puntaje)}</span>
              </div>
            </div>
            {cal.escala_numero && (
              <p className="mt-3 rounded-lg bg-white px-2.5 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                Lugar <strong>{cal.escala_numero}</strong> en el escalafón del grado {funcionario.grado} (art. 38)
              </p>
            )}
          </div>
        </div>
      </Tarjeta>

      <Pestanas
        className="no-imprimir"
        activa={pestana}
        onChange={setPestana}
        pestanas={[
          { clave: 'hoja', titulo: 'Hoja de calificación' },
          { clave: 'votacion', titulo: 'Votación de la junta', contador: subfactores.reduce((a, s) => a + s.votos.length, 0) },
          { clave: 'precalificacion', titulo: 'Precalificación del jefe' },
          { clave: 'hojavida', titulo: 'Hoja de vida', contador: datos.hoja_vida.length },
          { clave: 'informes', titulo: 'Informes de desempeño', contador: datos.informes.length },
          { clave: 'apelaciones', titulo: 'Apelaciones', contador: datos.apelaciones.length },
          { clave: 'historial', titulo: 'Historial' },
        ]}
      />

      <div className={`${pestana === 'hoja' ? '' : 'hidden'} print:block`}>
        <div>
          <Seccion
            titulo="Factores, subfactores, notas y argumentos (arts. 14, 16 y 17)"
            descripcion="Las notas de los subfactores son números enteros de 1 a 10. La nota de cada factor es el promedio aritmético de sus subfactores y se multiplica por el coeficiente del artículo 17."
          >
            <div className="flex flex-col gap-4">
              {factores.map((f) => (
                <Tarjeta key={f.clave} className="hoja-impresion">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">{f.numero}. {f.nombre}</h3>
                      <p className="mt-0.5 max-w-2xl text-xs text-slate-500">{f.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Nota factor</p>
                        <p className="text-xl font-semibold tabular-nums text-slate-900">{nf(f.nota)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Coeficiente</p>
                        <p className="text-xl font-semibold tabular-nums text-slate-900">{f.coeficiente}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Puntos</p>
                        <p className="text-xl font-semibold tabular-nums text-marca-700">{nf(f.puntos)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Subfactor</th>
                          <th className="w-20 px-3 py-2 text-center font-semibold">Nota jefe</th>
                          <th className="w-20 px-3 py-2 text-center font-semibold">Nota junta</th>
                          <th className="w-28 px-3 py-2 text-center font-semibold">Concepto (art. 14)</th>
                          <th className="px-3 py-2 text-left font-semibold">Argumento del acuerdo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {f.subfactores.map((s) => (
                          <tr key={s.clave} className="align-top">
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-slate-800">{s.letra} {s.nombre}</p>
                              <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-slate-500">{s.descripcion}</p>
                            </td>
                            <td className="px-3 py-2.5 text-center"><Nota valor={s.precalificacion} tamano="sm" /></td>
                            <td className="px-3 py-2.5 text-center">
                              <Nota valor={s.nota_junta} />
                              {s.nota_calculada !== null && s.agregado?.criterio && (
                                <p className="mt-1 text-[10px] leading-tight text-slate-500">{s.agregado.criterio}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center"><ConceptoNota nota={s.nota_junta ?? s.precalificacion} /></td>
                            <td className="px-3 py-2.5">
                              <p className="text-[13px] leading-relaxed text-slate-700">
                                {s.votos.find((v) => v.argumento)?.argumento ?? f.argumento_junta ?? f.argumento_precalificacion ?? 'Sin argumento registrado.'}
                              </p>
                              {s.votos.length > 0 && (
                                <p className="mt-1 text-[11px] text-slate-500">{s.agregado?.detalle}</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fundamentación del acuerdo de la Junta</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                      {f.argumento_junta || f.argumento_precalificacion || 'Pendiente de fundamentación; el acuerdo de la junta debe ser siempre fundado (art. 29).'}
                    </p>
                  </div>
                </Tarjeta>
              ))}
            </div>

            <Tarjeta className="hoja-impresion mt-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{nf(calculo.puntaje)} puntos</p>
                  <p className="text-xs text-slate-500">{cal.lista ? `Lista N°${cal.lista}` : 'Sin lista asignada'} — {nf(calculo.factores.rendimiento?.nota)} · {nf(calculo.factores.condiciones?.nota)} · {nf(calculo.factores.comportamiento?.nota)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acuerdo de la junta</p>
                  <p className="mt-1 text-[13px] text-slate-700">{cal.cal_json?.acuerdo ?? 'Sin acuerdo registrado.'}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {cal.cal_fecha_sesion ? `Sesión de ${fechaCorta(cal.cal_fecha_sesion)} · ` : ''}{cal.acta_numero ? `Acta ${cal.acta_numero}` : 'Sin acta asociada'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notificación y ejecutoria</p>
                  <p className="mt-1 text-[13px] text-slate-700">
                    {cal.notificada_fecha ? `Notificada el ${fechaCorta(cal.notificada_fecha)}` : 'Pendiente de notificación (art. 31)'}
                  </p>
                  <p className="text-[11px] text-slate-500">{cal.notificado_por ?? ''}</p>
                  <p className="mt-1 text-[13px] text-slate-700">
                    {cal.ejecutoriada_fecha ? `Ejecutoriada el ${fechaCorta(cal.ejecutoriada_fecha)}` : 'Aún no ejecutoriada'}
                  </p>
                </div>
              </div>
              {datos.situacion_final && (
                <Aviso tipo={cal.lista === 4 || cal.lista === 3 ? 'alerta' : 'norma'} className="mt-3">{datos.situacion_final}</Aviso>
              )}
              {cal.cal_observaciones && (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">{cal.cal_observaciones}</p>
              )}
              <div className="mt-6 grid gap-8 pt-6 text-center text-xs text-slate-600 sm:grid-cols-3" style={{ borderTop: '1px dashed #cbd5e1' }}>
                <div>
                  <div className="mx-auto mb-1 w-44 border-t border-slate-400" />
                  <p className="font-medium">{cal.precal_jefe_nombre ?? 'Jefe directo'}</p>
                  <p>Jefe directo precalificador</p>
                </div>
                <div>
                  <div className="mx-auto mb-1 w-44 border-t border-slate-400" />
                  <p className="font-medium">{junta?.presidente_funcionario_id ? 'Presidente de la Junta' : 'Presidente de la Junta Calificadora'}</p>
                  <p>Junta Calificadora {junta?.tipo ?? ''}</p>
                </div>
                <div>
                  <div className="mx-auto mb-1 w-44 border-t border-slate-400" />
                  <p className="font-medium">Secretario de la Junta</p>
                  <p>Ministro de fe (art. 25)</p>
                </div>
              </div>
              <p className="mt-4 text-center text-[10px] text-slate-500">
                Documento generado por el Sistema de Calificaciones — {meta?.institucion}. Reglamento de Calificaciones del personal afecto al
                Estatuto Administrativo, DTO 1825/1998 (Ministerio del Interior).
              </p>
            </Tarjeta>
          </Seccion>
        </div>
      </div>

      {pestana === 'votacion' && <VotacionJunta datos={datos} onCambio={() => { recargar() }} setAviso={setAviso} />}
      {pestana === 'precalificacion' && <PanelPrecalificacion datos={datos} onGuardado={() => { recargar() }} setAviso={setAviso} />}

      {pestana === 'hojavida' && (
        <Seccion titulo="Hoja de vida del período (arts. 8 a 11)" descripcion="Anotaciones de mérito y demérito dispuestas por escrito por el jefe directo, con su notificación y resolución.">
          <Tabla
            columnas={[
              { clave: 'tipo', titulo: 'Tipo', render: (f) => <Insignia color={f.tipo === 'Mérito' ? 'esmeralda' : 'rojo'}>{f.tipo}</Insignia> },
              { clave: 'fecha', titulo: 'Fecha', render: (f) => fechaCorta(f.fecha) },
              { clave: 'categoria', titulo: 'Categoría' },
              { clave: 'descripcion', titulo: 'Descripción', render: (f) => <span className="text-[13px] text-slate-700">{f.descripcion}</span> },
              { clave: 'resolucion', titulo: 'Resolución', render: (f) => <Insignia color={f.resolucion === 'Sin efecto' ? 'esmeralda' : f.resolucion === 'Mantenida' || f.resolucion === 'Mantiene anotación' ? 'rojo' : 'ambar'}>{f.resolucion}</Insignia> },
              { clave: 'notificada_fecha', titulo: 'Notificación', render: (f) => fechaCorta(f.notificada_fecha) },
            ]}
            datos={datos.hoja_vida}
            vacio="Sin anotaciones en la hoja de vida del período"
          />
        </Seccion>
      )}

      {pestana === 'informes' && (
        <Seccion titulo="Informes de desempeño (art. 19)" descripcion="Dos informes por período: el primero del 1 de septiembre al 31 de enero y el segundo del 1 de febrero al 30 de junio, con hoja de observaciones del funcionario.">
          <div className="grid gap-4 md:grid-cols-2">
            {datos.informes.map((i) => (
              <Tarjeta key={i.id}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">{i.numero}° informe de desempeño</h3>
                  <Insignia color={i.notificado_fecha ? 'esmeralda' : 'ambar'}>{i.notificado_fecha ? 'Notificado' : 'Pendiente de notificación'}</Insignia>
                </div>
                <p className="mt-1 text-xs text-slate-500">{fechaCorta(i.fecha_desde)} al {fechaCorta(i.fecha_hasta)}</p>
                <p className="mt-2 text-[13px] text-slate-700">{i.resumen ?? 'Sin contenido registrado.'}</p>
                <dl className="mt-3 grid gap-1 text-xs text-slate-600">
                  <div><dt className="inline font-medium">Jefe informante: </dt><dd className="inline">{i.jefe_nombre ?? '—'}</dd></div>
                  <div><dt className="inline font-medium">Notificado: </dt><dd className="inline">{fechaCorta(i.notificado_fecha)}</dd></div>
                </dl>
                {i.observaciones_funcionario && (
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Observaciones del funcionario</p>
                    <p className="mt-0.5 text-[12px] text-slate-700">{i.observaciones_funcionario}</p>
                  </div>
                )}
              </Tarjeta>
            ))}
            {!datos.informes.length && <Vacio titulo="Sin informes de desempeño generados" descripcion="Genere los informes del período desde la ficha del funcionario o desde Ajustes." />}
          </div>
        </Seccion>
      )}

      {pestana === 'apelaciones' && <PanelApelaciones datos={datos} onCambio={recargar} setAviso={setAviso} />}

      {pestana === 'historial' && (
        <Seccion titulo="Historial de calificaciones del funcionario" descripcion="Resultados de períodos anteriores, con la ubicación obtenida en el escalafón de mérito.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Tabla
              columnas={[
                { clave: 'anio', titulo: 'Período' },
                { clave: 'puntaje', titulo: 'Puntaje', render: (f) => <span className="tabular-nums font-semibold">{nf(f.puntaje)}</span> },
                { clave: 'lista', titulo: 'Lista', render: (f) => <InsigniaLista lista={f.lista} /> },
                { clave: 'escala_numero', titulo: 'Lugar escalafón', render: (f) => f.escala_numero ?? '—' },
                { clave: 'estado', titulo: 'Estado', render: (f) => <InsigniaEstado estado={f.estado} /> },
              ]}
              datos={datos.historial}
              vacio="Sin períodos anteriores registrados"
            />
            <Tarjeta>
              <h3 className="text-sm font-semibold text-slate-800">Antecedentes del funcionario</h3>
              <dl className="mt-3 grid gap-2 text-sm">
                <Dato etiqueta="Promedio histórico" valor={`${nf(funcionario.promedio_historico ?? null)} pts`} />
                <Dato etiqueta="Dependientes (si es jefe)" valor={datos.dependientes_del_jefe?.length ?? 0} />
                <Dato etiqueta="Estado" valor={funcionario.estado} />
                <Dato etiqueta="Meses acreditados en el período" valor={elegibilidad?.meses ?? '—'} />
              </dl>
              <div className="mt-3 flex gap-2">
                <Link to={`/funcionarios/${funcionario.id}`}><Boton variante="secundario" tamano="sm">Ver ficha del funcionario</Boton></Link>
                <Link to={`/escalafon?grado=${funcionario.grado}`}><Boton variante="secundario" tamano="sm">Ver escalafón del grado</Boton></Link>
              </div>
            </Tarjeta>
          </div>
        </Seccion>
      )}
    </div>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}:</dt>
      <dd className="min-w-0 text-[13px] text-slate-800">{valor ?? '—'}</dd>
    </div>
  )
}

/* ── Votación de la junta por subfactor ─────────────────────────────────── */
function VotacionJunta({ datos, onCambio, setAviso }) {
  const { subfactores, integrantes, calificacion: cal } = datos
  const [editando, setEditando] = useState(null)
  const votantes = integrantes.filter((i) => i.derecho_a_voto)

  const guardarVoto = async (cuerpo) => {
    try {
      const r = await api.put(`/api/calificaciones/${cal.id}/votos`, { votos: [cuerpo] })
      setAviso({ tipo: 'exito', titulo: 'Voto registrado', texto: `Se consolidó la votación: nota ${r.detalle.notas[cuerpo.subfactor_clave]} (${r.detalle.detalle[cuerpo.subfactor_clave].criterio}).` })
      setEditando(null)
      onCambio()
    } catch (e) {
      setAviso({ tipo: 'error', titulo: 'No se pudo registrar el voto', texto: e.message })
    }
  }

  return (
    <Seccion
      titulo="Votación de la Junta Calificadora por subfactor (arts. 29 y 30)"
      descripcion="Se registra el sentido de cada voto con su argumento. La nota del subfactor resulta de la mayoría de los votos y, en caso de empate, del voto del presidente."
      acciones={
        <Insignia color={votantes.length ? 'violeta' : 'rojo'}>
          {votantes.length} integrantes con derecho a voto {integrantes.length !== votantes.length ? `· ${integrantes.length - votantes.length} sólo con derecho a voz` : ''}
        </Insignia>
      }
    >
      {integrantes.length > 0 && (
        <Tarjeta className="mb-4" padding={false}>
          <div className="border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-800">Integrantes de la {datos.junta?.tipo ?? ''} Junta Calificadora</h3>
            <p className="text-xs text-slate-500">
              Constituida el {fechaCorta(datos.junta?.fecha_constitucion)}. El delegado de {datos.junta?.region ?? 'la asociación'} tiene sólo derecho a voz (art. 24).
            </p>
          </div>
          <ul className="flex flex-wrap gap-2 p-3">
            {integrantes.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                <span className="grid size-6 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">{i.nombre?.charAt(0)}</span>
                <span>
                  <span className="block text-xs font-medium text-slate-800">{i.nombre}</span>
                  <span className="block text-[10px] text-slate-500">{i.rol === 'Delegado ANEIICH' ? 'Delegado ANEIICH · sólo voz (art. 24)' : `${i.rol}${i.derecho_a_voto ? '' : ' · sin voto'}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <div className="flex flex-col gap-4">
        {subfactores.map((s) => (
          <Tarjeta key={s.clave} padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800">{s.nombre}</h3>
                <p className="text-xs text-slate-500">
                  Precalificación del jefe directo: <strong>{s.precalificacion ?? '—'}</strong>
                  {s.agregado?.detalle && <> · {s.agregado.detalle}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">Nota del subfactor</span>
                <Nota valor={s.nota_junta} tamano="lg" />
                <Boton variante="secundario" tamano="sm" onClick={() => setEditando({ subfactor: s.clave })}>
                  <Icono nombre="mas" className="size-3.5" /> Registrar voto
                </Boton>
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {s.votos.map((v) => (
                <li key={v.id} className="flex flex-wrap items-start gap-3 px-4 py-2.5">
                  <Nota valor={v.nota} tamano="sm" tenue={!v.derecho_a_voto} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-800">
                      {v.votante}
                      <span className="ml-1.5 font-normal text-slate-500">· {v.rol}</span>
                      {!v.derecho_a_voto && <Insignia color="gris" className="ml-1.5">sólo voz</Insignia>}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{v.argumento ?? 'Sin argumento registrado.'}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{v.criterio}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Boton variante="enlace" tamano="sm" onClick={() => setEditando({ subfactor: s.clave, voto: v })}>Editar</Boton>
                    <Boton
                      variante="enlace" tamano="sm" className="!text-rose-600"
                      onClick={async () => {
                        try {
                          await api.del(`/api/votos/${v.id}`)
                          setAviso({ tipo: 'exito', titulo: 'Voto eliminado', texto: `Se eliminó el voto de ${v.votante}.` })
                          onCambio()
                        } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
                      }}
                    >Eliminar</Boton>
                  </div>
                </li>
              ))}
              {!s.votos.length && (
                <li className="px-4 py-4 text-center text-xs text-slate-400">
                  Sin votos registrados. {s.integrantes_sin_voto?.length ? `${s.integrantes_sin_voto.length} integrantes aún no votan` : ''}
                </li>
              )}
            </ul>

            {s.integrantes_sin_voto?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-amber-50/60 px-4 py-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-amber-800">Faltan votos de:</span>
                {s.integrantes_sin_voto.map((i) => (
                  <Boton key={i.id} variante="suave" tamano="sm" onClick={() => setEditando({ subfactor: s.clave, integrante_id: i.id })}>
                    {i.nombre}
                  </Boton>
                ))}
              </div>
            )}
          </Tarjeta>
        ))}
      </div>

      <PanelAcuerdo datos={datos} onCambio={onCambio} setAviso={setAviso} />

      {editando && (
        <FormularioVoto
          datos={datos}
          subfactor={editando.subfactor}
          voto={editando.voto}
          integranteId={editando.integrante_id}
          onCerrar={() => setEditando(null)}
          onGuardar={guardarVoto}
        />
      )}
    </Seccion>
  )
}

function FormularioVoto({ datos, subfactor, voto, integranteId, onCerrar, onGuardar }) {
  const sub = datos.subfactores.find((s) => s.clave === subfactor)
  const [integrante, setIntegrante] = useState(String(voto?.integrante_id ?? integranteId ?? datos.integrantes.find((i) => i.derecho_a_voto)?.id ?? ''))
  const [nota, setNota] = useState(voto?.nota ?? sub?.precalificacion ?? 7)
  const [criterio, setCriterio] = useState(voto?.criterio ?? 'Conforme con la precalificación')
  const [argumento, setArgumento] = useState(voto?.argumento ?? '')
  const [enviando, setEnviando] = useState(false)

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Registrar voto de la Junta Calificadora"
      descripcion={`${sub?.nombre} — ${datos.funcionario_nombre}`}
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton
          cargando={enviando}
          onClick={async () => {
            setEnviando(true)
            await onGuardar({
              subfactor_clave: subfactor,
              integrante_id: integrante ? Number(integrante) : null,
              nota: Number(nota),
              criterio,
              argumento,
            })
            setEnviando(false)
          }}
        >Guardar voto</Boton>
      </>}
    >
      <div className="grid gap-4">
        <Aviso tipo="norma">
          Los acuerdos de la Junta se adoptan por mayoría de votos y las deliberaciones y votaciones son confidenciales; en caso de empate
          decide el voto del presidente (art. 30). Cada voto debe fundarse en circunstancias acaecidas durante el período (art. 14).
        </Aviso>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Integrante de la junta" requerido ayuda="El delegado de ANEIICH sólo tiene derecho a voz (art. 24).">
            <Selector value={integrante} onChange={(e) => setIntegrante(e.target.value)}>
              {datos.integrantes.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre} — {i.rol}{i.derecho_a_voto ? '' : ' (sólo voz)'}</option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Criterio del voto">
            <Selector value={criterio} onChange={(e) => setCriterio(e.target.value)}>
              {['Conforme con la precalificación', 'Fija nota distinta', 'Se abstiene', 'Solicita nuevo informe'].map((c) => <option key={c}>{c}</option>)}
            </Selector>
          </Campo>
        </div>

        <Campo etiqueta="Nota votada en el subfactor" requerido ayuda={`Número entero de 1 a 10 (art. 14). La precalificación del jefe directo fue ${sub?.precalificacion ?? '—'}.`}>
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setNota(n); setCriterio(n === sub?.precalificacion ? 'Conforme con la precalificación' : 'Fija nota distinta') }}
                className={`size-9 rounded-lg text-sm font-semibold ring-1 ring-inset transition ${
                  Number(nota) === n ? 'bg-marca-600 text-white ring-marca-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
                }`}
              >{n}</button>
            ))}
            <span className="ml-1 text-xs text-slate-500">Concepto: <ConceptoNota nota={Number(nota)} /></span>
          </div>
        </Campo>

        <Campo etiqueta="Argumento del voto" requerido ayuda="El acuerdo debe ser siempre fundado y se anota en el acta de calificaciones (art. 29).">
          <AreaTexto value={argumento} onChange={(e) => setArgumento(e.target.value)} filas={3} placeholder="Se comparte la apreciación del jefe directo respecto de la calidad de los trabajos entregados durante el período…" />
        </Campo>
      </div>
    </Modal>
  )
}

/* ── Precalificación del jefe directo ───────────────────────────────────── */
function PanelPrecalificacion({ datos, onGuardado, setAviso }) {
  const { calificacion: cal, factores, subfactores } = datos
  const [notas, setNotas] = useState(() => Object.fromEntries(subfactores.map((s) => [s.clave, s.precalificacion ?? 7])))
  const [argumentos, setArgumentos] = useState(() => Object.fromEntries(factores.map((f) => [f.clave, f.argumento_precalificacion ?? ''])))
  const [cabecera, setCabecera] = useState({
    precal_fecha: cal.precal_fecha ?? new Date().toISOString().slice(0, 10),
    precal_notificada_fecha: cal.precal_notificada_fecha ?? '',
    precal_obs_funcionario: cal.precal_obs_funcionario ?? '',
    precal_observaciones: cal.precal_observaciones ?? '',
    jefe_id: cal.precal_jefe_id ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const suma = useMemo(() => Object.values(notas).reduce((a, b) => a + Number(b || 0), 0), [notas])

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const r = await api.put(`/api/calificaciones/${cal.id}/precalificacion`, {
        notas, argumentos, ...cabecera, jefe_id: cabecera.jefe_id || null,
      })
      setAviso({ tipo: 'exito', titulo: 'Precalificación registrada', texto: `Puntaje proyectado: ${r.calculo.puntaje} — Lista N°${r.calculo.lista}.` })
      onGuardado()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Seccion
      titulo="Precalificación del jefe directo (arts. 19 y 20)"
      descripcion="El jefe directo precalifica al personal de su dependencia dentro del plazo de diez días contados desde la entrega de las hojas de vida, y notifica personalmente la precalificación."
      acciones={<Boton cargando={guardando} onClick={guardar}><Icono nombre="check" className="size-4" /> Guardar precalificación</Boton>}
    >
      {error && <Aviso tipo="error" className="mb-4" titulo="Revise los datos">{error}</Aviso>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {factores.map((f) => (
            <Tarjeta key={f.clave}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">{f.numero}. {f.nombre}</h3>
                <Insignia color="marca">coeficiente {f.coeficiente}</Insignia>
              </div>
              <ul className="flex flex-col gap-2.5">
                {f.subfactores.map((s) => (
                  <li key={s.clave} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1 text-[13px] text-slate-700">{s.letra} {s.nombre}</span>
                    <span className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n} type="button" onClick={() => setNotas((x) => ({ ...x, [s.clave]: n }))}
                          className={`size-7 rounded-md text-xs font-semibold ring-1 ring-inset transition ${
                            Number(notas[s.clave]) === n ? 'bg-marca-600 text-white ring-marca-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-100'
                          }`}
                        >{n}</button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <Campo className="mt-3" etiqueta="Fundamentación del factor" requerido ayuda="La calificación debe ser fundada en circunstancias del período (art. 19).">
                <AreaTexto value={argumentos[f.clave]} onChange={(e) => setArgumentos((x) => ({ ...x, [f.clave]: e.target.value }))} filas={2} />
              </Campo>
            </Tarjeta>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Tarjeta>
            <h3 className="text-sm font-semibold text-slate-800">Datos de la precalificación</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Campo etiqueta="Jefe directo que precalifica" ayuda="Se registra quién efectúa la evaluación; si hubo más de un jefe en el período, informa el último jefe inmediato (art. 21).">
                <Entrada value={cal.precal_jefe_nombre ?? ''} disabled />
              </Campo>
              <Campo etiqueta="Fecha de precalificación">
                <Entrada type="date" value={cabecera.precal_fecha} onChange={(e) => setCabecera((x) => ({ ...x, precal_fecha: e.target.value }))} />
              </Campo>
              <Campo etiqueta="Fecha de notificación al funcionario">
                <Entrada type="date" value={cabecera.precal_notificada_fecha} onChange={(e) => setCabecera((x) => ({ ...x, precal_notificada_fecha: e.target.value }))} />
              </Campo>
              <Campo etiqueta="Observaciones del jefe directo">
                <AreaTexto filas={2} value={cabecera.precal_observaciones} onChange={(e) => setCabecera((x) => ({ ...x, precal_observaciones: e.target.value }))} />
              </Campo>
              <Campo etiqueta="Observaciones del funcionario (art. 20)" ayuda="El funcionario puede formular observaciones dentro de cinco días desde la notificación.">
                <AreaTexto filas={2} value={cabecera.precal_obs_funcionario} onChange={(e) => setCabecera((x) => ({ ...x, precal_obs_funcionario: e.target.value }))} />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta>
            <h3 className="text-sm font-semibold text-slate-800">Cálculo referencial</h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {factores.map((f) => {
                const ns = f.subfactores.map((s) => Number(notas[s.clave]))
                const promedio = ns.reduce((a, b) => a + b, 0) / ns.length
                const nota = Math.round(promedio * 100) / 100
                const coef = datos.coeficientes[f.clave]
                return (
                  <li key={f.clave} className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-600">{f.nombre}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-700">{nota.toFixed(2)} × {coef} = <strong>{Math.round(nota * coef * 100) / 100}</strong></span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-medium text-slate-700">Puntaje proyectado</span>
              <span className="text-xl font-semibold tabular-nums text-marca-700">
                {(() => {
                  const total = factores.reduce((a, f) => {
                    const ns = f.subfactores.map((s) => Number(notas[s.clave]))
                    const nota = Math.round((ns.reduce((x, y) => x + y, 0) / ns.length) * 100) / 100
                    return a + Math.round(nota * datos.coeficientes[f.clave] * 100) / 100
                  }, 0)
                  return Math.round(total * 100) / 100
                })()}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Suma de notas registradas: {suma} de {subfactores.length * 10} posibles.</p>
          </Tarjeta>
        </div>
      </div>
    </Seccion>
  )
}

/* ── Apelaciones ───────────────────────────────────────────────────────── */
function PanelApelaciones({ datos, onCambio, setAviso }) {
  const { calificacion: cal } = datos
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), fundamentos: '', autoridad: 'Director Nacional', tipo: 'Apelación' })
  const [resolviendo, setResolviendo] = useState(null)

  return (
    <Seccion
      titulo="Recursos del funcionario (arts. 32 a 36)"
      descripcion="La apelación se interpone en el acto de la notificación o dentro de cinco días; de ella conoce el Subsecretario o el Jefe Superior del Servicio, y al decidir podrá mantenerse o elevarse el puntaje, pero no rebajarse en caso alguno."
      acciones={<Boton onClick={() => setAbierto(true)}><Icono nombre="mas" className="size-4" /> Registrar apelación</Boton>}
    >
      <div className="flex flex-col gap-4">
        {datos.apelaciones.map((a) => (
          <Tarjeta key={a.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{a.tipo} del {fechaCorta(a.fecha)}</h3>
                <p className="text-xs text-slate-500">Conoce: {a.autoridad} · plazo {a.plazo_dias} días hábiles {a.extemporanea ? '· declarada extemporánea' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <Insignia color={a.resolucion && a.resolucion !== 'Pendiente de resolución' ? 'esmeralda' : 'ambar'}>
                  {a.resolucion || 'Pendiente de resolución'}
                </Insignia>
                <Boton variante="secundario" tamano="sm" onClick={() => setResolviendo(a)}>Resolver</Boton>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">{a.fundamentos}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
              <span>Puntaje de la junta: <strong>{nf(a.puntaje_junta)}</strong></span>
              <span>Puntaje resuelto: <strong>{nf(a.puntaje_resuelto)}</strong></span>
              <span>Resolución: {fechaCorta(a.fecha_resolucion)}</span>
            </div>
            {a.fundamento_resolucion && <p className="mt-2 text-[12px] text-slate-600">{a.fundamento_resolucion}</p>}
          </Tarjeta>
        ))}
        {!datos.apelaciones.length && (
          <Vacio
            titulo="Sin apelaciones registradas"
            descripcion="El funcionario puede apelar de la resolución de la Junta Calificadora dentro de cinco días contados desde la notificación."
            accion={<Boton className="mt-2" onClick={() => setAbierto(true)}>Registrar apelación</Boton>}
          />
        )}
      </div>

      {abierto && (
        <Modal
          abierto onCerrar={() => setAbierto(false)}
          titulo="Registrar apelación del funcionario"
          descripcion={`${datos.funcionario_nombre} — puntaje de la junta: ${nf(cal.puntaje)}`}
          pie={<>
            <Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton onClick={async () => {
              try {
                await api.post(`/api/calificaciones/${cal.id}/apelacion`, form)
                setAviso({ tipo: 'exito', titulo: 'Apelación registrada', texto: 'La Junta debe remitir los antecedentes a la autoridad en el plazo de tres días (art. 32).' })
                setAbierto(false)
                onCambio()
              } catch (e) { setAviso({ tipo: 'error', titulo: 'No se pudo registrar', texto: e.message }) }
            }}>Registrar apelación</Boton>
          </>}
        >
          <div className="grid gap-4">
            <Aviso tipo="norma">La apelación se interpone en el mismo acto de la notificación o dentro de cinco días; excepcionalmente la Junta puede ampliar el plazo hasta diez días (art. 32).</Aviso>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Tipo de recurso"><Selector value={form.tipo} onChange={(e) => setForm((x) => ({ ...x, tipo: e.target.value }))} opciones={['Apelación', 'Reclamo a Contraloría']} /></Campo>
              <Campo etiqueta="Fecha" requerido><Entrada type="date" value={form.fecha} onChange={(e) => setForm((x) => ({ ...x, fecha: e.target.value }))} /></Campo>
              <Campo etiqueta="Autoridad que conoce"><Selector value={form.autoridad} onChange={(e) => setForm((x) => ({ ...x, autoridad: e.target.value }))} opciones={['Director Nacional', 'Subsecretario', 'Contraloría General de la República']} /></Campo>
            </div>
            <Campo etiqueta="Fundamentos del recurso" requerido>
              <AreaTexto filas={4} value={form.fundamentos} onChange={(e) => setForm((x) => ({ ...x, fundamentos: e.target.value }))} placeholder="Exponga los antecedentes y el agravio que motiva la apelación…" />
            </Campo>
          </div>
        </Modal>
      )}

      {resolviendo && <FormularioResolucion apelacion={resolviendo} onCerrar={() => setResolviendo(null)} onListo={() => { setResolviendo(null); onCambio() }} setAviso={setAviso} />}
    </Seccion>
  )
}

function FormularioResolucion({ apelacion, onCerrar, onListo, setAviso }) {
  const [form, setForm] = useState({
    puntaje_resuelto: apelacion.puntaje_junta ?? '',
    resolucion: apelacion.resolucion && apelacion.resolucion !== 'Pendiente de resolución' ? apelacion.resolucion : 'Se mantiene el puntaje',
    fundamento_resolucion: apelacion.fundamento_resolucion ?? '',
    fecha_resolucion: apelacion.fecha_resolucion ?? new Date().toISOString().slice(0, 10),
    notificada_fecha: apelacion.notificada_fecha ?? '',
    ejecutoriar: true,
  })
  return (
    <Modal
      abierto onCerrar={onCerrar}
      titulo="Resolver la apelación"
      descripcion={`Puntaje asignado por la Junta: ${nf(apelacion.puntaje_junta)}. Sólo puede mantenerse o elevarse (art. 33).`}
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={async () => {
          try {
            await api.put(`/api/apelaciones/${apelacion.id}`, form)
            setAviso({ tipo: 'exito', titulo: 'Resolución registrada', texto: `Puntaje resuelto: ${form.puntaje_resuelto}.` })
            onListo()
          } catch (e) { setAviso({ tipo: 'error', titulo: 'No se pudo resolver', texto: e.message }) }
        }}>Guardar resolución</Boton>
      </>}
    >
      <div className="grid gap-4">
        <Aviso tipo="norma">Al decidir la apelación se tiene a la vista la hoja de vida, la precalificación, la calificación y los antecedentes del funcionario. La resolución debe ser fundada y adoptarse dentro de 15 días (art. 33).</Aviso>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Resolución" requerido>
            <Selector value={form.resolucion} onChange={(e) => setForm((x) => ({ ...x, resolucion: e.target.value }))} opciones={['Se mantiene el puntaje', 'Se eleva el puntaje', 'Se acoge parcialmente la apelación']} />
          </Campo>
          <Campo etiqueta="Puntaje resuelto" requerido ayuda="Debe ser igual o superior al puntaje de la Junta.">
            <Entrada type="number" step="0.01" min={apelacion.puntaje_junta ?? 0} value={form.puntaje_resuelto} onChange={(e) => setForm((x) => ({ ...x, puntaje_resuelto: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Fecha de resolución"><Entrada type="date" value={form.fecha_resolucion} onChange={(e) => setForm((x) => ({ ...x, fecha_resolucion: e.target.value }))} /></Campo>
          <Campo etiqueta="Fecha de notificación"><Entrada type="date" value={form.notificada_fecha} onChange={(e) => setForm((x) => ({ ...x, notificada_fecha: e.target.value }))} /></Campo>
        </div>
        <Campo etiqueta="Fundamento de la resolución">
          <AreaTexto filas={3} value={form.fundamento_resolucion} onChange={(e) => setForm((x) => ({ ...x, fundamento_resolucion: e.target.value }))} />
        </Campo>
        <Conmutador
          activo={form.ejecutoriar} onChange={(v) => setForm((x) => ({ ...x, ejecutoriar: v }))}
          etiqueta="Declarar la calificación ejecutoriada (art. 37)"
          ayuda="Practicada la notificación del fallo, la resolución queda ejecutoriada y sólo procede el reclamo a la Contraloría."
        />
      </div>
    </Modal>
  )
}

/* ── Acciones de flujo del proceso ──────────────────────────────────────── */
function BotonesFlujo({ datos, onListo, setAviso, recargar }) {
  const navegar = useNavigate()
  const { calificacion: cal } = datos
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const estados = ['Borrador', 'Informes de desempeño', 'Precalificado', 'En junta', 'Calificado', 'Apelación', 'Ejecutoriado']
  const [form, setForm] = useState({
    estado: cal.estado, cal_fecha_sesion: cal.cal_fecha_sesion ?? '', acta_numero: cal.acta_numero ?? '',
    notificada_fecha: cal.notificada_fecha ?? '', notificado_por: cal.notificado_por ?? 'Secretario de la Junta Calificadora',
    ejecutoriada_fecha: cal.ejecutoriada_fecha ?? '',
  })

  return (
    <>
      <Boton variante="suave" onClick={() => setAbierto(true)}>
        <Icono nombre="documento" className="size-4" /> Estado y notificación
      </Boton>
      <Selector
        className="!w-auto"
        value=""
        onChange={async (e) => {
          if (!e.target.value) return
          setOcupado(true)
          try {
            if (e.target.value === 'eliminar') {
              await api.del(`/api/calificaciones/${cal.id}`)
              navegar('/calificaciones')
              return
            }
            await api.put(`/api/calificaciones/${cal.id}/estado`, { estado: e.target.value })
            setAviso({ tipo: 'exito', titulo: 'Estado actualizado', texto: `La ficha quedó en estado "${e.target.value}".` })
            recargar()
          } catch (err) {
            setAviso({ tipo: 'error', titulo: 'No se pudo cambiar el estado', texto: err.message })
          } finally { setOcupado(false) }
        }}
      >
        <option value="">Acciones…</option>
        {estados.map((e) => <option key={e} value={e}>Cambiar a: {e}</option>)}
        <option value="eliminar">Eliminar ficha</option>
      </Selector>

      <Modal
        abierto={abierto} onCerrar={() => setAbierto(false)}
        titulo="Estado del proceso, notificación y ejecutoria"
        descripcion="Registre la sesión de la junta, el acta y la notificación del acuerdo (arts. 28, 29, 31 y 37)."
        pie={<>
          <Boton variante="secundario" onClick={() => setAbierto(false)}>Cerrar</Boton>
          <Boton cargando={ocupado} onClick={async () => {
            setOcupado(true)
            try {
              await api.put(`/api/calificaciones/${cal.id}/estado`, form)
              setAviso({ tipo: 'exito', titulo: 'Ficha actualizada', texto: `Estado: ${form.estado}.` })
              setAbierto(false)
              onListo()
            } catch (e) {
              setAviso({ tipo: 'error', titulo: 'No se pudo actualizar', texto: e.message })
            } finally { setOcupado(false) }
          }}>Guardar</Boton>
        </>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Estado de la ficha" requerido>
            <Selector value={form.estado} onChange={(e) => setForm((x) => ({ ...x, estado: e.target.value }))} opciones={estados} />
          </Campo>
          <Campo etiqueta="N° de acta">
            <Entrada value={form.acta_numero} onChange={(e) => setForm((x) => ({ ...x, acta_numero: e.target.value }))} placeholder="2026-07" />
          </Campo>
          <Campo etiqueta="Fecha de la sesión de la junta">
            <Entrada type="date" value={form.cal_fecha_sesion} onChange={(e) => setForm((x) => ({ ...x, cal_fecha_sesion: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Fecha de notificación al funcionario" ayuda="Dentro de cinco días desde la última sesión (art. 31).">
            <Entrada type="date" value={form.notificada_fecha} onChange={(e) => setForm((x) => ({ ...x, notificada_fecha: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Notificado por">
            <Entrada value={form.notificado_por} onChange={(e) => setForm((x) => ({ ...x, notificado_por: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Fecha de ejecutoria" ayuda="La resolución queda ejecutoriada al vencer el plazo para reclamar (art. 37).">
            <Entrada type="date" value={form.ejecutoriada_fecha} onChange={(e) => setForm((x) => ({ ...x, ejecutoriada_fecha: e.target.value }))} />
          </Campo>
        </div>
        <BarraProgreso
          className="mt-4"
          valor={estados.indexOf(form.estado) + 1} total={estados.length}
        />
      </Modal>
    </>
  )
}
