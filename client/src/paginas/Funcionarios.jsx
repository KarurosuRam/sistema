import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, descargar, consulta } from '../api'
import { useDatos, useSistema } from '../contexto'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, Boton, Campo, Cargando, Conmutador, Entrada, Icono, Indicador, Insignia, InsigniaAneiich,
  InsigniaEstado, InsigniaLista, Modal, Seccion, Selector, Tabla, Tarjeta, AreaTexto,
} from '../componentes/ui'

const vacio = {
  rut: '', nombres: '', apellido_paterno: '', apellido_materno: '', email: '', telefono: '', sexo: '',
  fecha_nacimiento: '', cargo: '', grado: '', planta: 'Administrativos', calidad_juridica: 'Planta', jornada: '44 horas semanales',
  unidad_id: '', jefe_id: '', fecha_ingreso_servicio: '', fecha_ingreso_grado: '', fecha_ingreso_administracion: '',
  asociado_aneiich: 0, rol_aneiich: '', fecha_afiliacion: '', estado: 'Vigente', observaciones: '',
  es_jefe_evaluador: 0, es_jefe_superior: 0, es_dirigente_asociacion: 0, es_delegado_personal: 0, no_calificable: 0,
}

export default function Funcionarios() {
  const { periodo, meta, recargar: recargarMeta } = useSistema()
  const navegar = useNavigate()
  const [filtros, setFiltros] = useState({ buscar: '', unidad: '', planta: '', calidad: '', estado: '', aneiich: '', orden: 'nombre', dir: 'asc' })
  const [pagina, setPagina] = useState(1)
  const [seleccion, setSeleccion] = useState([])
  const [aviso, setAviso] = useState(null)
  const [formulario, setFormulario] = useState(null)
  const [accion, setAccion] = useState(null)
  const [importando, setImportando] = useState(false)

  const { datos, cargando, error, recargar } = useDatos(
    () => api.get(`/api/funcionarios${consulta({ ...filtros, pagina, porPagina: 25, periodo: periodo?.id })}`),
    [JSON.stringify(filtros), pagina, periodo?.id]
  )

  const filas = datos?.datos ?? []
  const resumen = datos?.resumen ?? {}
  const todosSeleccionados = filas.length > 0 && filas.every((f) => seleccion.includes(f.id))

  const alternar = (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const seleccionarAsociados = () => {
    const asociados = filas.filter((f) => f.aneiich).map((f) => f.id)
    setSeleccion(asociados)
    setAviso(asociados.length
      ? { tipo: 'exito', titulo: 'Selección rápida aplicada', texto: `Se seleccionaron ${asociados.length} funcionarios asociados a ${meta?.asociacion ?? 'ANEIICH'} en la página actual. Puede aplicar una acción masiva sobre ellos.` }
      : { tipo: 'alerta', titulo: 'Sin asociados en esta página', texto: `Active el filtro "${meta?.asociacion ?? 'ANEIICH'}" para listar sólo a los asociados y luego use la selección rápida.` })
  }

  const ejecutarMasiva = async (datosAccion) => {
    try {
      const r = await api.post('/api/funcionarios/masivo', { ids: seleccion, ...datosAccion })
      setAviso({ tipo: 'exito', titulo: 'Acción aplicada', texto: `${r.detalle} — ${r.afectados} funcionarios.` })
      setAccion(null)
      setSeleccion([])
      recargar()
      recargarMeta()
    } catch (e) {
      setAviso({ tipo: 'error', titulo: 'No se pudo aplicar la acción', texto: e.message })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Base de datos de funcionarios"
        descripcion={`Dotación afecta al Estatuto Administrativo, con identificación de los asociados a ${meta?.asociacion ?? 'ANEIICH'} y de las jefaturas evaluadoras.`}
        acciones={<>
          <Boton variante="secundario" onClick={() => descargar(`/api/funcionarios/plantilla.csv`, 'plantilla-funcionarios.csv')}>
            <Icono nombre="descargar" className="size-4" /> Plantilla
          </Boton>
          <Boton variante="secundario" onClick={() => setImportando(true)}>Importar planilla</Boton>
          <Boton variante="secundario" onClick={() => descargar(`/api/funcionarios/export.csv${consulta({ ...filtros, periodo: periodo?.id })}`, 'funcionarios.csv')}>
            <Icono nombre="descargar" className="size-4" /> Exportar
          </Boton>
          <Boton onClick={() => setFormulario({ ...vacio })}><Icono nombre="mas" className="size-4" /> Nuevo funcionario</Boton>
        </>}
      />

      {aviso && <Aviso tipo={aviso.tipo} titulo={aviso.titulo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Funcionarios (filtro actual)" valor={resumen.total ?? 0} detalle={`${resumen.contrata ?? 0} a contrata · ${resumen.no_vigentes ?? 0} no vigentes`} icono={<Icono nombre="personas" className="size-4" />} />
        <Indicador titulo={`Asociados ${meta?.asociacion ?? 'ANEIICH'}`} valor={resumen.aneiich ?? 0} detalle="Identificados visualmente y de selección rápida" color="violeta" icono={<Icono nombre="aneiich" className="size-4" />} />
        <Indicador titulo="Jefes evaluadores" valor={resumen.jefes ?? 0} detalle="Con dependientes bajo su precalificación" color="ambar" icono={<Icono nombre="estrella" className="size-4" />} />
        <Indicador titulo="Seleccionados" valor={seleccion.length} detalle="Aplique acciones masivas sobre la selección" color="esmeralda" icono={<Icono nombre="check" className="size-4" />} />
      </div>

      <Tarjeta>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Campo etiqueta="Buscar" className="xl:col-span-2">
            <Entrada placeholder="Nombre, RUT, cargo o correo…" value={filtros.buscar} onChange={(e) => { setFiltros((x) => ({ ...x, buscar: e.target.value })); setPagina(1) }} />
          </Campo>
          <Campo etiqueta="Unidad">
            <Selector placeholder="Todas" value={filtros.unidad} onChange={(e) => { setFiltros((x) => ({ ...x, unidad: e.target.value })); setPagina(1) }}
              opciones={(meta?.unidades ?? []).map((u) => ({ valor: u.id, etiqueta: u.nombre }))} />
          </Campo>
          <Campo etiqueta="Estamento">
            <Selector placeholder="Todos" value={filtros.planta} onChange={(e) => { setFiltros((x) => ({ ...x, planta: e.target.value })); setPagina(1) }} opciones={meta?.estamentos ?? []} />
          </Campo>
          <Campo etiqueta="Calidad jurídica">
            <Selector placeholder="Todas" value={filtros.calidad} onChange={(e) => { setFiltros((x) => ({ ...x, calidad: e.target.value })); setPagina(1) }} opciones={meta?.calidades ?? []} />
          </Campo>
          <Campo etiqueta={`${meta?.asociacion ?? 'ANEIICH'}`}>
            <Selector placeholder="Todos" value={filtros.aneiich} onChange={(e) => { setFiltros((x) => ({ ...x, aneiich: e.target.value })); setPagina(1) }}
              opciones={[{ valor: '1', etiqueta: 'Sólo asociados' }, { valor: '0', etiqueta: 'Sólo no asociados' }]} />
          </Campo>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Boton tamano="sm" variante="violeta" onClick={seleccionarAsociados}>
            <Icono nombre="aneiich" className="size-3.5" /> Selección rápida {meta?.asociacion ?? 'ANEIICH'}
          </Boton>
          <Boton tamano="sm" variante="secundario" onClick={() => setSeleccion(todosSeleccionados ? [] : filas.map((f) => f.id))}>
            {todosSeleccionados ? 'Quitar selección de la página' : 'Seleccionar página'}
          </Boton>
          {seleccion.length > 0 && (
            <>
              <Boton tamano="sm" variante="suave" onClick={() => setAccion('rol_aneiich')}>Asignar rol ANEIICH</Boton>
              <Boton tamano="sm" variante="suave" onClick={() => setAccion('asignar_jefe')}>Reasignar jefatura</Boton>
              <Boton tamano="sm" variante="suave" onClick={() => setAccion('asignar_unidad')}>Reasignar unidad</Boton>
              <Boton tamano="sm" variante="suave" onClick={() => setAccion('cambiar_estado')}>Cambiar estado</Boton>
              <Boton tamano="sm" variante="suave" onClick={() => ejecutarMasiva({ accion: 'marcar_aneiich' })}>Marcar ANEIICH</Boton>
              <Boton tamano="sm" variante="suave" onClick={() => ejecutarMasiva({ accion: 'desmarcar_aneiich' })}>Quitar ANEIICH</Boton>
              <Boton tamano="sm" variante="suave" onClick={() => ejecutarMasiva({ accion: 'marcar_jefe' })}>Marcar como jefe evaluador</Boton>
            </>
          )}
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Ordenar por</span>
            <Selector className="!w-auto !py-1 !text-xs" value={filtros.orden} onChange={(e) => setFiltros((x) => ({ ...x, orden: e.target.value }))}
              opciones={[{ valor: 'nombre', etiqueta: 'Apellido' }, { valor: 'grado', etiqueta: 'Grado' }, { valor: 'puntaje', etiqueta: 'Puntaje' }, { valor: 'unidad', etiqueta: 'Unidad' }, { valor: 'antiguedad', etiqueta: 'Antigüedad' }]} />
            <Selector className="!w-auto !py-1 !text-xs" value={filtros.dir} onChange={(e) => setFiltros((x) => ({ ...x, dir: e.target.value }))}
              opciones={[{ valor: 'asc', etiqueta: 'Ascendente' }, { valor: 'desc', etiqueta: 'Descendente' }]} />
          </span>
        </div>
      </Tarjeta>

      {cargando && !datos ? <Cargando /> : (
        <>
          <Tabla
            densa
            seleccionadas={seleccion}
            onFila={(f) => navegar(`/funcionarios/${f.id}`)}
            columnas={[
              {
                clave: 'sel', titulo: '', clase: 'w-8',
                render: (f) => (
                  <input
                    type="checkbox" checked={seleccion.includes(f.id)} onClick={(e) => e.stopPropagation()}
                    onChange={() => alternar(f.id)} className="size-4 rounded border-slate-300 text-marca-600"
                  />
                ),
              },
              {
                clave: 'nombre', titulo: 'Funcionario',
                render: (f) => (
                  <div className="flex items-center gap-2">
                    <span className={`size-1.5 shrink-0 rounded-full ${f.aneiich ? 'bg-aneiich-500' : 'bg-transparent'}`} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-800">
                        <span className="truncate">{f.nombre_completo}</span>
                        {f.aneiich && <InsigniaAneiich compacta />}
                        {f.es_jefe_evaluador ? <Insignia color="ambar">jefe evaluador</Insignia> : null}
                        {f.no_calificable ? <Insignia color="gris">no calificable</Insignia> : null}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{f.rut} · {f.email ?? 'sin correo'}</p>
                    </div>
                  </div>
                ),
              },
              { clave: 'cargo', titulo: 'Cargo', render: (f) => <span className="text-[13px] text-slate-700">{f.cargo ?? '—'}</span> },
              { clave: 'grado', titulo: 'Grado', clase: 'text-right tabular-nums' },
              { clave: 'planta', titulo: 'Estamento', render: (f) => <Insignia color="gris">{f.planta}</Insignia> },
              { clave: 'unidad', titulo: 'Unidad', render: (f) => <span className="text-[12px] text-slate-600">{f.unidad_nombre ?? '—'}</span> },
              { clave: 'jefe', titulo: 'Jefe directo', render: (f) => <span className="text-[12px] text-slate-600">{f.jefe_nombre ?? '—'}</span> },
              {
                clave: 'calificacion', titulo: `Período ${periodo?.anio ?? ''}`,
                render: (f) => (f.cal_id
                  ? <div className="text-right">
                      <InsigniaLista lista={f.lista} puntaje={f.puntaje} />
                      {f.cal_estado && <p className="mt-0.5 text-[10px] text-slate-500">{f.cal_estado}</p>}
                    </div>
                  : <span className="text-[11px] text-slate-400">sin ficha</span>),
              },
              { clave: 'estado', titulo: 'Situación', render: (f) => <InsigniaEstado estado={f.estado} /> },
              {
                clave: 'historial', titulo: 'Historial',
                render: (f) => (
                  <div className="flex gap-0.5" title={(f.historial ?? []).map((h) => `${h.anio}: ${h.puntaje}`).join(' · ')}>
                    {(f.historial ?? []).slice(-4).map((h) => (
                      <span key={h.anio} className={`h-6 w-2.5 rounded-sm ${
                        h.lista === 1 ? 'bg-emerald-400' : h.lista === 2 ? 'bg-sky-400' : h.lista === 3 ? 'bg-amber-400' : 'bg-rose-400'
                      }`} />
                    ))}
                  </div>
                ),
              },
            ]}
            datos={filas}
            vacio="Sin funcionarios que coincidan con los filtros"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Mostrando {filas.length} de {datos?.total ?? 0} funcionarios · página {datos?.pagina ?? 1} de {datos?.paginas ?? 1}
            </p>
            <div className="flex gap-2">
              <Boton variante="secundario" tamano="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Boton>
              <Boton variante="secundario" tamano="sm" disabled={pagina >= (datos?.paginas ?? 1)} onClick={() => setPagina((p) => p + 1)}>Siguiente</Boton>
            </div>
          </div>
        </>
      )}

      {error && <Aviso tipo="error" titulo="Error al cargar">{error}</Aviso>}

      {formulario && (
        <FormularioFuncionario
          inicial={formulario}
          onCerrar={() => setFormulario(null)}
          onGuardado={(f) => { setFormulario(null); setAviso({ tipo: 'exito', titulo: 'Funcionario guardado', texto: `${f.nombres} ${f.apellido_paterno} quedó registrado en la base de datos.` }); recargar() }}
        />
      )}

      {accion && (
        <Modal
          abierto onCerrar={() => setAccion(null)}
          titulo="Acción masiva sobre la selección"
          descripcion={`${seleccion.length} funcionarios seleccionados`}
          ancho="max-w-lg"
          pie={<Boton variante="secundario" onClick={() => setAccion(null)}>Cancelar</Boton>}
        >
          <AccionMasiva accion={accion} onAplicar={ejecutarMasiva} />
        </Modal>
      )}

      {importando && <Importador onCerrar={() => setImportando(false)} onListo={() => { recargar(); recargarMeta() }} />}
    </div>
  )
}

/* ── Formulario de funcionario ──────────────────────────────────────────── */
export function FormularioFuncionario({ inicial, onCerrar, onGuardado }) {
  const { meta } = useSistema()
  const [form, setForm] = useState({ ...inicial })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const esEdicion = Boolean(inicial.id)
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }))

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const r = esEdicion ? await api.put(`/api/funcionarios/${inicial.id}`, form) : await api.post('/api/funcionarios', form)
      onGuardado(r)
    } catch (e) {
      setError(e.message)
    } finally { setGuardando(false) }
  }

  return (
    <Modal
      abierto ancho="max-w-4xl"
      onCerrar={onCerrar}
      titulo={esEdicion ? 'Editar funcionario' : 'Registrar nuevo funcionario'}
      descripcion="Los datos alimentan la hoja de calificación, el escalafón de mérito y el padrón de asociados."
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton cargando={guardando} onClick={guardar}>{esEdicion ? 'Guardar cambios' : 'Registrar funcionario'}</Boton>
      </>}
    >
      {error && <Aviso tipo="error" className="mb-4" titulo="Revise los datos">{error}</Aviso>}

      <div className="grid gap-5">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Identificación</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etiqueta="RUT" requerido ayuda="Formato 12.345.678-9">
              <Entrada value={form.rut} onChange={(e) => set('rut', e.target.value)} placeholder="12.345.678-9" />
            </Campo>
            <Campo etiqueta="Nombres" requerido><Entrada value={form.nombres} onChange={(e) => set('nombres', e.target.value)} /></Campo>
            <Campo etiqueta="Apellido paterno" requerido><Entrada value={form.apellido_paterno} onChange={(e) => set('apellido_paterno', e.target.value)} /></Campo>
            <Campo etiqueta="Apellido materno"><Entrada value={form.apellido_materno ?? ''} onChange={(e) => set('apellido_materno', e.target.value)} /></Campo>
            <Campo etiqueta="Correo institucional"><Entrada type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Campo>
            <Campo etiqueta="Teléfono"><Entrada value={form.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} /></Campo>
            <Campo etiqueta="Sexo"><Selector placeholder="Sin informar" value={form.sexo ?? ''} onChange={(e) => set('sexo', e.target.value)} opciones={[{ valor: 'F', etiqueta: 'Femenino' }, { valor: 'M', etiqueta: 'Masculino' }]} /></Campo>
            <Campo etiqueta="Fecha de nacimiento"><Entrada type="date" value={form.fecha_nacimiento ?? ''} onChange={(e) => set('fecha_nacimiento', e.target.value)} /></Campo>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Situación funcionaria</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etiqueta="Cargo"><Entrada value={form.cargo ?? ''} onChange={(e) => set('cargo', e.target.value)} /></Campo>
            <Campo etiqueta="Grado / nivel remuneratorio" ayuda="Determina el orden del escalafón (art. 38)">
              <Entrada type="number" min="1" max="30" value={form.grado ?? ''} onChange={(e) => set('grado', e.target.value)} />
            </Campo>
            <Campo etiqueta="Estamento (art. 17)" requerido ayuda="Define los coeficientes aplicables">
              <Selector value={form.planta} onChange={(e) => set('planta', e.target.value)} opciones={meta?.estamentos ?? []} />
            </Campo>
            <Campo etiqueta="Calidad jurídica"><Selector value={form.calidad_juridica} onChange={(e) => set('calidad_juridica', e.target.value)} opciones={meta?.calidades ?? []} /></Campo>
            <Campo etiqueta="Jornada"><Selector value={form.jornada ?? ''} onChange={(e) => set('jornada', e.target.value)} opciones={meta?.jornadas ?? []} /></Campo>
            <Campo etiqueta="Unidad / Dirección Regional">
              <Selector placeholder="Sin asignar" value={form.unidad_id ?? ''} onChange={(e) => set('unidad_id', e.target.value)} opciones={(meta?.unidades ?? []).map((u) => ({ valor: u.id, etiqueta: u.nombre }))} />
            </Campo>
            <Campo etiqueta="Estado"><Selector value={form.estado} onChange={(e) => set('estado', e.target.value)} opciones={meta?.estadosFuncionario ?? []} /></Campo>
            <Campo etiqueta="Ingreso al servicio"><Entrada type="date" value={form.fecha_ingreso_servicio ?? ''} onChange={(e) => set('fecha_ingreso_servicio', e.target.value)} /></Campo>
            <Campo etiqueta="Promoción al grado actual"><Entrada type="date" value={form.fecha_ingreso_grado ?? ''} onChange={(e) => set('fecha_ingreso_grado', e.target.value)} /></Campo>
            <Campo etiqueta="Ingreso a la Administración del Estado"><Entrada type="date" value={form.fecha_ingreso_administracion ?? ''} onChange={(e) => set('fecha_ingreso_administracion', e.target.value)} /></Campo>
            <Campo etiqueta="Jefe directo (precalificador)" ayuda="Quien precalifica según el art. 21">
              <Selector placeholder="Sin jefe asignado" value={form.jefe_id ?? ''} onChange={(e) => set('jefe_id', e.target.value)} opciones={(meta?.jefes ?? []).map((j) => ({ valor: j.id, etiqueta: `${j.nombres} ${j.apellido_paterno} — ${j.cargo ?? ''}` }))} />
            </Campo>
            <Campo etiqueta="Observaciones"><Entrada value={form.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} /></Campo>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Condición gremial y rol en el proceso</h4>
          <div className="grid gap-4 rounded-xl border border-aneiich-100 bg-aneiich-50/40 p-4 sm:grid-cols-2">
            <Conmutador
              color="violeta" activo={Boolean(form.asociado_aneiich)} onChange={(v) => set('asociado_aneiich', v)}
              etiqueta={`Asociado a ${meta?.asociacion ?? 'ANEIICH'}`}
              ayuda="Se identifica visualmente en todo el sistema y permite la selección rápida del padrón."
            />
            <Campo etiqueta="Rol en la asociación" ayuda="Los dirigentes no son calificados salvo solicitud expresa (art. 5)">
              <Selector placeholder="Sin rol" value={form.rol_aneiich ?? ''} onChange={(e) => set('rol_aneiich', e.target.value)} opciones={meta?.rolesAneiich ?? []} />
            </Campo>
            <Campo etiqueta="Fecha de afiliación"><Entrada type="date" value={form.fecha_afiliacion ?? ''} onChange={(e) => set('fecha_afiliacion', e.target.value)} /></Campo>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Conmutador activo={Boolean(form.es_jefe_evaluador)} onChange={(v) => set('es_jefe_evaluador', v)} etiqueta="Es jefe evaluador" ayuda="Efectúa precalificaciones (arts. 19 a 21)" color="esmeralda" />
            <Conmutador activo={Boolean(form.es_dirigente_asociacion)} onChange={(v) => set('es_dirigente_asociacion', v)} etiqueta="Dirigente de la asociación" ayuda="Art. 5: no se califica salvo solicitud" color="violeta" />
            <Conmutador activo={Boolean(form.solicita_ser_calificado)} onChange={(v) => set('solicita_ser_calificado', v)} etiqueta="Solicita ser calificado" ayuda="Habilita la calificación del dirigente o delegado" color="esmeralda" />
            <Conmutador activo={Boolean(form.es_delegado_personal)} onChange={(v) => set('es_delegado_personal', v)} etiqueta="Delegado del personal" ayuda="Integra la junta; no se califica (art. 5)" />
            <Conmutador activo={Boolean(form.es_jefe_superior)} onChange={(v) => set('es_jefe_superior', v)} etiqueta="Jefe Superior" ayuda="No es calificado (art. 5) y es responsable del proceso" />
            <Conmutador activo={Boolean(form.no_calificable)} onChange={(v) => set('no_calificable', v)} etiqueta="Excluido de calificación" ayuda="Exclusión dispuesta por la unidad de personal" />
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ── Acción masiva ─────────────────────────────────────────────────────── */
function AccionMasiva({ accion, onAplicar }) {
  const { meta } = useSistema()
  const [valor, setValor] = useState('')

  const config = {
    rol_aneiich: { titulo: 'Asignar rol en la asociación', campo: () => <Selector value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Seleccione un rol" opciones={meta?.rolesAneiich ?? []} /> },
    asignar_jefe: { titulo: 'Reasignar jefe directo', campo: () => <Selector value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Seleccione el jefe" opciones={(meta?.jefes ?? []).map((j) => ({ valor: j.id, etiqueta: `${j.nombres} ${j.apellido_paterno} — ${j.cargo ?? ''}` }))} /> },
    asignar_unidad: { titulo: 'Reasignar unidad', campo: () => <Selector value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Seleccione la unidad" opciones={(meta?.unidades ?? []).map((u) => ({ valor: u.id, etiqueta: u.nombre }))} /> },
    cambiar_estado: { titulo: 'Cambiar situación del funcionario', campo: () => <Selector value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Seleccione el estado" opciones={meta?.estadosFuncionario ?? []} /> },
  }[accion]

  return (
    <div className="grid gap-4">
      <Campo etiqueta={config?.titulo} requerido>{config?.campo()}</Campo>
      <Boton disabled={!valor} onClick={() => onAplicar({ accion, valor })}>Aplicar a la selección</Boton>
    </div>
  )
}

/* ── Importación de planilla ───────────────────────────────────────────── */
function Importador({ onCerrar, onListo }) {
  const [texto, setTexto] = useState('')
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const procesar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const r = await api.post('/api/funcionarios/importar', { csv: texto })
      setResumen(r)
      onListo()
    } catch (e) {
      setError(e.message)
    } finally { setEnviando(false) }
  }

  return (
    <Modal
      abierto ancho="max-w-3xl" onCerrar={onCerrar}
      titulo="Importar funcionarios desde planilla"
      descripcion="Descargue la plantilla, complete una fila por funcionario (CSV delimitado por punto y coma) y péguela aquí. Los RUT existentes se actualizan."
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>
        <Boton cargando={enviando} onClick={procesar} disabled={!texto.trim()}>Importar</Boton>
      </>}
    >
      <div className="grid gap-4">
        <Aviso tipo="norma">
          Columnas reconocidas: RUT, Nombres, Apellido paterno, Apellido materno, Email, Cargo, Grado, Estamento, Calidad jurídica,
          Jornada, Unidad, Jefe directo, fechas de ingreso, ANEIICH (SI/NO), Rol ANEIICH, Fecha de afiliación y Estado.
        </Aviso>

        <div className="flex items-center gap-2">
          <Entrada type="file" accept=".csv,text/csv" onChange={async (e) => {
            const archivo = e.target.files?.[0]
            if (archivo) setTexto(await archivo.text())
          }} />
        </div>

        <Campo etiqueta="Contenido CSV" ayuda="También puede pegar el contenido directamente desde Excel.">
          <AreaTexto filas={7} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="RUT;Nombres;Apellido paterno;…" />
        </Campo>

        {error && <Aviso tipo="error" titulo="No se pudo importar">{error}</Aviso>}

        {resumen && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              Importación terminada: {resumen.creados} creados, {resumen.actualizados} actualizados de {resumen.total} filas.
            </p>
            {resumen.errores?.length > 0 && (
              <>
                <p className="mt-2 text-xs font-semibold text-rose-700">Filas con error ({resumen.errores.length}):</p>
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-rose-700">{resumen.errores.map((e, i) => <li key={i}>• {e}</li>)}</ul>
              </>
            )}
            {resumen.advertencias?.length > 0 && (
              <>
                <p className="mt-2 text-xs font-semibold text-amber-700">Advertencias ({resumen.advertencias.length}):</p>
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-amber-700">{resumen.advertencias.map((e, i) => <li key={i}>• {e}</li>)}</ul>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
