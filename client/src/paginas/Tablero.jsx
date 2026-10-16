import { Link } from 'react-router-dom'
import { useDatos, useSistema } from '../contexto'
import { api } from '../api'
import { Barras, Leyenda, Lineas, PALETA, RadarNotas, Torta } from '../componentes/Graficos'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, BarraProgreso, Boton, Cargando, Icono, Indicador, Insignia, InsigniaAneiich, InsigniaLista,
  Seccion, Tabla, Tarjeta, Vacio,
} from '../componentes/ui'

const nf = (v, d = 2) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }))
const entero = (v) => (v ?? 0).toLocaleString('es-CL')

const COLOR_PLAZO = { vencido: 'rojo', 'por vencer': 'ambar', 'en plazo': 'esmeralda', 'sin fecha': 'gris' }

export default function Tablero() {
  const { periodo, lista, meta } = useSistema()
  const { datos, cargando, error, recargar } = useDatos(() => api.get(`/api/dashboard${periodo ? `?periodo=${periodo.id}` : ''}`), [periodo?.id])

  if (cargando && !datos) return <Cargando texto="Consolidando los promedios del período…" />
  if (error) return <Aviso tipo="error" titulo="No fue posible cargar el tablero">{error}</Aviso>
  if (!datos) return null

  const { fichas = {}, dotacion = {}, tasas = {}, aneiich = {} } = datos
  const conPuntaje = (fichas.lista1 ?? 0) + (fichas.lista2 ?? 0) + (fichas.lista3 ?? 0) + (fichas.lista4 ?? 0)

  const datosEstamento = (datos.promedios_por_estamento ?? []).map((e) => ({
    nombre: e.clave, n: e.n, promedio: e.promedio,
    ANEIICH: e.promedio_aneiich, 'No asociados': e.promedio_no_aneiich,
  }))

  const datosAnio = (datos.promedios_por_anio ?? []).map((a) => ({
    nombre: String(a.anio), general: a.promedio, ANEIICH: a.promedio_aneiich, 'No asociados': a.promedio_no_aneiich, funcionarios: a.n,
  }))

  const listasPorAnio = (datos.promedios_por_anio ?? []).map((a) => ({
    nombre: String(a.anio), 'Lista N°1': a.lista1, 'Lista N°2': a.lista2, 'Lista N°3': a.lista3, 'Lista N°4': a.lista4,
  }))

  const subfactores = (datos.notas_subfactor ?? []).map((s) => ({ nombre: s.subfactor.length > 26 ? `${s.subfactor.slice(0, 26)}…` : s.subfactor, subfactorCompleto: s.subfactor, promedio: s.promedio }))

  const estados = [
    { clave: 'Borrador', valor: fichas.borrador, color: 'bg-slate-400' },
    { clave: 'Informes de desempeño', valor: fichas.informes, color: 'bg-sky-400' },
    { clave: 'Precalificado', valor: fichas.precalificados, color: 'bg-marca-500' },
    { clave: 'En junta', valor: fichas.en_junta, color: 'bg-aneiich-500' },
    { clave: 'Calificado', valor: fichas.calificados, color: 'bg-emerald-500' },
    { clave: 'Apelación', valor: fichas.apelaciones, color: 'bg-amber-500' },
    { clave: 'Ejecutoriado', valor: fichas.ejecutoriados, color: 'bg-emerald-700' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={`Tablero del proceso calificatorio ${periodo?.anio ?? ''}`}
        descripcion={`Período de desempeño evaluado: ${periodo?.fecha_inicio ?? ''} al ${periodo?.fecha_termino ?? ''}. Promedios calculados sobre ${entero(conPuntaje)} calificaciones con puntaje asignado.`}
        acciones={<>
          <Boton variante="secundario" onClick={recargar}>Actualizar</Boton>
          <Link to="/calificaciones"><Boton>Ver calificaciones</Boton></Link>
        </>}
      />

      {/* Plazos legales */}
      <Tarjeta padding={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2">
          <Icono nombre="alerta" className="size-4 text-slate-400" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cumplimiento de los plazos del reglamento</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {(datos.plazos ?? []).map((p) => (
            <li key={p.glosa} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-slate-700">{p.glosa}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-xs text-slate-500">{p.fecha}</span>
                <Insignia color={COLOR_PLAZO[p.estado] ?? 'gris'}>
                  {p.estado === 'vencido' ? `vencido hace ${Math.abs(p.dias)} días` : p.estado === 'en plazo' || p.estado === 'por vencer' ? `en ${p.dias} días` : p.estado}
                </Insignia>
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      {/* Indicadores principales */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Dotación total" valor={entero(dotacion.total)} detalle={`${entero(dotacion.planta)} de planta · ${entero(dotacion.contrata)} a contrata`} icono={<Icono nombre="personas" className="size-4" />} />
        <Indicador
          titulo={`Fichas del período ${periodo?.anio ?? ''}`} valor={entero(fichas.fichas)}
          detalle={`${entero(fichas.ejecutoriados)} ejecutoriadas · ${entero(fichas.en_junta)} en junta`}
          color="esmeralda" icono={<Icono nombre="documento" className="size-4" />}
        />
        <Indicador
          titulo="Puntaje promedio" valor={nf(fichas.promedio)}
          detalle={`Rango ${nf(fichas.minimo)} – ${nf(fichas.maximo)} · ${tasas.distincion ?? 0}% en Lista N°1`}
          color="ambar" icono={<Icono nombre="grafico" className="size-4" />}
        />
        <Indicador
          titulo={`Asociados ${meta?.asociacion ?? 'ANEIICH'}`} valor={entero(aneiich.total)}
          detalle={`${aneiich.porcentaje ?? 0}% de la dotación · promedio ${nf((datos.promedios_por_estamento ?? []).reduce((a, b) => a + (b.promedio_aneiich ?? 0), 0) ? (datos.promedios_por_anio ?? []).at(-1)?.promedio_aneiich : null)}`}
          color="violeta" icono={<Icono nombre="aneiich" className="size-4" />}
          onClick={() => { window.location.href = '/aneiich' }}
        />
      </div>

      {/* Avance del proceso */}
      <Seccion titulo="Avance del proceso calificatorio" descripcion="Etapas del art. 18: precalificación del jefe directo, calificación de la Junta Calificadora y recursos.">
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Tarjeta>
            <ul className="flex flex-col gap-3">
              {estados.map((e) => (
                <li key={e.clave}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{e.clave}</span>
                    <span className="tabular-nums text-slate-500">{entero(e.valor)} de {entero(fichas.fichas)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${e.color}`} style={{ width: `${fichas.fichas ? ((e.valor ?? 0) / fichas.fichas) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-center">
              <div>
                <p className="text-lg font-semibold tabular-nums text-slate-900">{tasas.precalificacion ?? 0}%</p>
                <p className="text-[11px] text-slate-500">precalificación efectuada</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums text-slate-900">{tasas.calificacion ?? 0}%</p>
                <p className="text-[11px] text-slate-500">con acuerdo de la junta</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums text-slate-900">{entero(datos.no_calificables?.total)}</p>
                <p className="text-[11px] text-slate-500">excluidos (art. 5)</p>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Distribución por lista de calificación</h3>
            {conPuntaje ? (
              <>
                <Torta
                  datos={[
                    { nombre: 'Lista N°1 Distinción', valor: fichas.lista1 ?? 0, color: PALETA[3] },
                    { nombre: 'Lista N°2 Buena', valor: fichas.lista2 ?? 0, color: PALETA[2] },
                    { nombre: 'Lista N°3 Condicional', valor: fichas.lista3 ?? 0, color: PALETA[4] },
                    { nombre: 'Lista N°4 Eliminación', valor: fichas.lista4 ?? 0, color: PALETA[5] },
                  ]}
                  altura={220}
                />
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-slate-600">
                  <Leyenda items={[
                    { titulo: 'Lista N°1', color: PALETA[3], valor: fichas.lista1 },
                    { titulo: 'Lista N°2', color: PALETA[2], valor: fichas.lista2 },
                  ]} />
                  <Leyenda items={[
                    { titulo: 'Lista N°3', color: PALETA[4], valor: fichas.lista3 },
                    { titulo: 'Lista N°4', color: PALETA[5], valor: fichas.lista4 },
                  ]} />
                </div>
              </>
            ) : <Vacio titulo="Aún no hay calificaciones con puntaje asignado" descripcion="Los tramos de lista se calculan con los puntajes del art. 15." />}
          </Tarjeta>
        </div>
      </Seccion>

      {/* Promedios por estamento */}
      <Seccion
        titulo="Promedios por estamento"
        descripcion={`Puntaje promedio del período ${periodo?.anio ?? ''} por estamento, comparando funcionarios asociados a ${meta?.asociacion ?? 'ANEIICH'} y no asociados.`}
      >
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Tarjeta>
            <Barras
              datos={datosEstamento} altura={300}
              categorias={[
                { clave: 'ANEIICH', titulo: `Asociados ${meta?.asociacion ?? 'ANEIICH'}`, color: '#7c3aed' },
                { clave: 'No asociados', titulo: 'No asociados', color: '#94a3b8' },
              ]}
            />
          </Tarjeta>
          <Tarjeta padding={false}>
            <Tabla
              densa
              columnas={[
                { clave: 'clave', titulo: 'Estamento', render: (f) => (
                  <div>
                    <p className="font-medium text-slate-800">{f.clave}</p>
                    <p className="text-[11px] text-slate-500">coef. {Object.values(datos.coeficientes ?? {}) && ''}{(meta?.coeficientes?.[f.clave] ? `${meta.coeficientes[f.clave].rendimiento}/${meta.coeficientes[f.clave].condiciones}/${meta.coeficientes[f.clave].comportamiento}` : '')}</p>
                  </div>
                ) },
                { clave: 'n', titulo: 'N', clase: 'text-right tabular-nums' },
                { clave: 'promedio', titulo: 'Promedio', clase: 'text-right tabular-nums font-semibold' },
                { clave: 'lista1', titulo: 'L1', clase: 'text-right tabular-nums' },
                { clave: 'lista2', titulo: 'L2', clase: 'text-right tabular-nums' },
                { clave: 'lista3', titulo: 'L3', clase: 'text-right tabular-nums text-amber-700' },
                { clave: 'lista4', titulo: 'L4', clase: 'text-right tabular-nums text-rose-700' },
              ]}
              datos={datos.promedios_por_estamento ?? []}
              vacio="Sin datos de estamentos para el período"
            />
          </Tarjeta>
        </div>
      </Seccion>

      {/* Evolución por año */}
      <Seccion
        titulo="Evolución por año de calificación"
        descripcion="Puntaje promedio general y por condición de asociado al gremio, para cada período calificatorio registrado."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Puntaje promedio por año</h3>
            <Lineas
              datos={datosAnio} altura={300} dominio={[40, 90]}
              categorias={[
                { clave: 'general', titulo: 'Promedio general', color: '#1f47dd' },
                { clave: 'ANEIICH', titulo: `Asociados ${meta?.asociacion ?? 'ANEIICH'}`, color: '#7c3aed' },
                { clave: 'No asociados', titulo: 'No asociados', color: '#64748b' },
              ]}
            />
          </Tarjeta>
          <Tarjeta>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Cantidad de funcionarios por lista, según año</h3>
            <Barras
              datos={listasPorAnio} altura={300} apilado
              categorias={[
                { clave: 'Lista N°1', titulo: 'Lista N°1 Distinción', color: '#10b981' },
                { clave: 'Lista N°2', titulo: 'Lista N°2 Buena', color: '#0ea5e9' },
                { clave: 'Lista N°3', titulo: 'Lista N°3 Condicional', color: '#f59e0b' },
                { clave: 'Lista N°4', titulo: 'Lista N°4 Eliminación', color: '#f43f5e' },
              ]}
            />
          </Tarjeta>
        </div>
      </Seccion>

      {/* Notas por subfactor y comparativas */}
      <Seccion titulo="Notas promedio por factor y subfactor" descripcion="Promedio de las notas asignadas en el período, considerando el acuerdo de la junta cuando existe y, en su defecto, la precalificación del jefe directo.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Tarjeta>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Perfil de subfactores (art. 16)</h3>
            <RadarNotas
              altura={330}
              datos={(subfactores ?? []).map((s) => ({ nombre: s.nombre, promedio: s.promedio }))}
              categorias={[{ clave: 'promedio', titulo: 'Nota promedio', color: '#1f47dd' }]}
            />
          </Tarjeta>
          <Tarjeta padding={false}>
            <Tabla
              densa
              columnas={[
                { clave: 'subfactor', titulo: 'Subfactor', render: (f) => <span className="text-slate-700" title={f.subfactorCompleto ?? f.subfactor}>{f.subfactor}</span> },
                { clave: 'factor', titulo: 'Factor', render: (f) => <span className="text-xs text-slate-500">{meta?.factores?.find((x) => x.clave === f.factor)?.nombre ?? f.factor}</span> },
                { clave: 'n', titulo: 'Evaluados', clase: 'text-right tabular-nums' },
                {
                  clave: 'promedio', titulo: 'Nota promedio', clase: 'text-right',
                  render: (f) => (
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden w-24 sm:block">
                        <BarraProgreso valor={(f.promedio ?? 0) * 10} total={100} altura="h-1.5" />
                      </div>
                      <span className="w-10 text-right font-semibold tabular-nums text-slate-800">{nf(f.promedio)}</span>
                    </div>
                  ),
                },
              ]}
              datos={datos.notas_subfactor ?? []}
            />
          </Tarjeta>
        </div>
      </Seccion>

      {/* Excluidos del proceso */}
      <Seccion titulo="Personal excluido de calificación (art. 5)" descripcion="El Jefe Superior, su subrogante, los integrantes de la junta, los delegados del personal y los dirigentes de asociaciones no son calificados, salvo solicitud expresa; quienes no completan seis meses de desempeño tampoco se califican.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Tarjeta>
            <ul className="flex flex-col gap-2.5">
              {(datos.no_calificables?.por_causal ?? []).map((c) => (
                <li key={c.causal}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="line-clamp-2 text-slate-600">{c.causal}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-800">{c.n}</span>
                  </div>
                  <BarraProgreso valor={c.n} total={datos.no_calificables.total} color="ambar" altura="h-1.5" />
                </li>
              ))}
              {!datos.no_calificables?.por_causal?.length && <li className="text-sm text-slate-500">Sin exclusiones registradas.</li>}
            </ul>
          </Tarjeta>
          <Tarjeta padding={false}>
            <Tabla
              densa
              columnas={[
                { clave: 'nombre', titulo: 'Funcionario' },
                { clave: 'grado', titulo: 'Grado', clase: 'text-right tabular-nums' },
                { clave: 'planta', titulo: 'Estamento' },
                { clave: 'causal', titulo: 'Causal de exclusión', render: (f) => <span className="text-xs text-slate-600">{f.causal}</span> },
                { clave: 'aneiich', titulo: '', render: (f) => (f.aneiich ? <Icono nombre="aneiich" className="size-4 text-aneiich-500" /> : null) },
              ]}
              datos={datos.no_calificables?.detalle ?? []}
              vacio="Todos los funcionarios están afectos a calificación"
            />
          </Tarjeta>
        </div>
      </Seccion>

      {/* Jefaturas y pendientes */}
      <Seccion titulo="Avance de las jefaturas y fichas pendientes" descripcion="Cumplimiento del deber de precalificar (arts. 19 y 20) por parte de cada jefe directo.">
        <div className="grid gap-4 xl:grid-cols-2">
          <Tarjeta padding={false}>
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Precalificaciones por jefatura</h3>
              <p className="text-xs text-slate-500">Los jefes directos precalifican dentro de los diez días siguientes a la entrega de las hojas de vida.</p>
            </div>
            <Tabla
              densa
              columnas={[
                { clave: 'jefe', titulo: 'Jefe directo', render: (f) => (
                  <div>
                    <p className="font-medium text-slate-800">{f.jefe}</p>
                    <p className="text-[11px] text-slate-500">{f.cargo}</p>
                  </div>
                ) },
                { clave: 'dependientes', titulo: 'Dep.', clase: 'text-right tabular-nums' },
                { clave: 'precalificados', titulo: 'Precal.', clase: 'text-right tabular-nums text-emerald-700' },
                { clave: 'pendientes', titulo: 'Pend.', clase: 'text-right tabular-nums font-semibold text-amber-700' },
                { clave: 'promedio_dependientes', titulo: 'Prom.', clase: 'text-right tabular-nums' },
              ]}
              datos={datos.jefaturas ?? []}
              vacio="Sin jefaturas con dependientes en el período"
            />
          </Tarjeta>

          <Tarjeta padding={false}>
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Fichas pendientes de término</h3>
              <p className="text-xs text-slate-500">Haga clic en una fila para abrir la hoja de calificación del funcionario.</p>
            </div>
            <Tabla
              densa
              columnas={[
                { clave: 'funcionario', titulo: 'Funcionario', render: (f) => (
                  <Link to={`/calificaciones/${f.id}`} className="block">
                    <span className="font-medium text-slate-800 hover:text-marca-700">{f.funcionario}</span>
                    <span className="block text-[11px] text-slate-500">{f.rut} · {f.unidad ?? 'Sin unidad'}</span>
                  </Link>
                ) },
                { clave: 'grado', titulo: 'Grado', clase: 'text-right tabular-nums' },
                { clave: 'estado', titulo: 'Etapa', render: (f) => <Insignia color={f.estado === 'Borrador' ? 'gris' : f.estado === 'En junta' ? 'violeta' : 'marca'}>{f.estado}</Insignia> },
                { clave: 'precal_efectuada', titulo: 'Precal.', render: (f) => (f.precal_efectuada ? <Icono nombre="check" className="size-4 text-emerald-600" /> : <span className="text-xs text-slate-400">pendiente</span>) },
              ]}
              datos={(datos.pendientes ?? []).slice(0, 12)}
              vacio="No hay fichas pendientes"
            />
          </Tarjeta>
        </div>
      </Seccion>

      {/* Destacados */}
      <Seccion titulo="Resultados destacados y casos críticos" descripcion="Lista N°1 de Distinción y funcionarios en Lista N°3 Condicional o N°4 de Eliminación con los efectos del art. 37.">
        <div className="grid gap-4 xl:grid-cols-2">
          <Tarjeta padding={false}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Icono nombre="estrella" className="size-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-800">Mejores puntajes — Lista N°1 de Distinción</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {(datos.destacados?.lista1 ?? []).map((f, i) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/calificaciones/${f.id}`} className="flex items-center gap-2 text-sm font-medium text-slate-800 hover:text-marca-700">
                      <span className="truncate">{f.funcionario}</span>
                      {f.asociado_aneiich ? <InsigniaAneiich compacta /> : null}
                    </Link>
                    <p className="truncate text-[11px] text-slate-500">{f.planta} · grado {f.grado} · {f.unidad ?? 'sin unidad'}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">{nf(f.puntaje)}</span>
                </li>
              ))}
              {!datos.destacados?.lista1?.length && <li className="px-4 py-6 text-center text-sm text-slate-400">Sin calificaciones en Lista N°1 en el período</li>}
            </ul>
          </Tarjeta>

          <Tarjeta padding={false}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Icono nombre="alerta" className="size-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-slate-800">Casos críticos — Listas N°3 y N°4</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {(datos.destacados?.criticos ?? []).map((f) => (
                <li key={f.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/calificaciones/${f.id}`} className="truncate text-sm font-medium text-slate-800 hover:text-marca-700">{f.funcionario}</Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <InsigniaLista lista={f.lista} puntaje={f.puntaje} />
                    </div>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{f.planta} · grado {f.grado} · {f.unidad ?? 'sin unidad'}</p>
                  {f.situacion_final && <p className="mt-1 text-[11px] text-rose-700">{f.situacion_final}</p>}
                </li>
              ))}
              {!datos.destacados?.criticos?.length && <li className="px-4 py-6 text-center text-sm text-slate-400">Sin casos en listas condicional o de eliminación</li>}
            </ul>
          </Tarjeta>
        </div>
      </Seccion>

      {/* Normativa aplicada */}
      <Aviso tipo="norma" titulo="Criterios normativos aplicados en este tablero">
        <ul className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
          {Object.entries(datos.normas ?? {}).map(([k, v]) => <li key={k}>• {v}</li>)}
        </ul>
      </Aviso>
    </div>
  )
}
