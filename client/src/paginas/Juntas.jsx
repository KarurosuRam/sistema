import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useDatos, useSistema } from '../contexto'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, BarraProgreso, Boton, Campo, Cargando, Conmutador, Entrada, Icono, Indicador, Insignia,
  Modal, Seccion, Selector, Tabla, Tarjeta, AreaTexto, Vacio,
} from '../componentes/ui'

const fechaCorta = (f) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-CL') : '—')

export default function Juntas() {
  const { periodo, meta, recargar: recargarMeta } = useSistema()
  const [juntaSel, setJuntaSel] = useState(null)
  const [creando, setCreando] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [nuevaActa, setNuevaActa] = useState(false)
  const [aviso, setAviso] = useState(null)

  const { datos, cargando, error, recargar } = useDatos(() => api.get(`/api/juntas?periodo=${periodo?.id ?? ''}`), [periodo?.id])
  const junta = datos?.datos?.find((j) => j.id === juntaSel) ?? datos?.datos?.[0] ?? null

  const { datos: tablero } = useDatos(() => (junta ? api.get(`/api/juntas/${junta.id}/tablero`) : Promise.resolve(null)), [junta?.id])
  const { datos: actas, recargar: recargarActas } = useDatos(() => api.get(`/api/actas?junta=${junta?.id ?? ''}`), [junta?.id])

  const actualizar = () => { recargar(); recargarActas() }

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo={`Juntas Calificadoras · período ${periodo?.anio ?? ''}`}
        descripcion="La Junta Calificadora Central se integra con los cinco funcionarios de más alto nivel jerárquico, excluido el Jefe Superior, y con un representante del personal; la asociación con mayor representación designa un delegado con derecho a voz."
        acciones={<>
          <Boton variante="secundario" onClick={() => setAgregando(true)} disabled={!junta}><Icono nombre="mas" className="size-4" /> Agregar integrante</Boton>
          <Boton onClick={() => setCreando(true)}><Icono nombre="mas" className="size-4" /> Constituir junta</Boton>
        </>}
      />

      {aviso && <Aviso tipo={aviso.tipo} titulo={aviso.titulo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}
      {error && <Aviso tipo="error" titulo="No fue posible cargar las juntas">{error}</Aviso>}

      {cargando && !datos ? <Cargando /> : !datos?.datos?.length ? (
        <Vacio
          titulo="No hay juntas constituidas en este período"
          descripcion="La junta debe constituirse el 21 de septiembre o el día siguiente hábil, y las calificaciones deben estar en poder del secretario antes del 15 de octubre (art. 28)."
          accion={<Boton className="mt-2" onClick={() => setCreando(true)}>Constituir la junta del período</Boton>}
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {datos.datos.map((j) => (
              <button
                key={j.id}
                onClick={() => setJuntaSel(j.id)}
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${
                  junta?.id === j.id ? 'border-marca-400 ring-2 ring-marca-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Junta {j.tipo}</p>
                  <Insignia color={j.estado === 'En sesión' ? 'violeta' : 'gris'}>{j.estado}</Insignia>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{j.region ?? 'Sin región'} · constituida el {fechaCorta(j.fecha_constitucion)}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>{j.integrantes.length} integrantes</span>
                  <span>{j.avance.calificaciones} fichas</span>
                </div>
                <div className="mt-2">
                  <BarraProgreso valor={j.avance.votos_registrados} total={j.avance.votos_esperados} color="violeta" altura="h-1.5" />
                  <p className="mt-1 text-[10px] text-slate-500">{j.avance.votos_registrados} de {j.avance.votos_esperados} votos registrados</p>
                </div>
              </button>
            ))}
          </div>

          {junta && (
            <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
              <div className="flex flex-col gap-4">
                <Tarjeta padding={false}>
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Integrantes de la Junta {junta.tipo}</h3>
                      <p className="text-xs text-slate-500">Art. 26: la junta es presidida por el funcionario de más alto nivel jerárquico que la integre.</p>
                    </div>
                    <Boton variante="secundario" tamano="sm" onClick={() => setAgregando(true)}>Agregar</Boton>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {junta.integrantes.map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                            <span className="truncate">{i.nombre}</span>
                            {i.rol === 'Delegado ANEIICH' && <Insignia color="violeta">sólo voz · art. 24</Insignia>}
                            {i.rol === 'Representante del personal' && <Insignia color="cielo">representante del personal</Insignia>}
                          </p>
                          <p className="text-[11px] text-slate-500">{i.cargo ?? '—'} · {i.rol} {i.derecho_a_voto ? '· con derecho a voto' : ''}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Boton
                            variante="enlace" tamano="sm"
                            onClick={async () => {
                              try {
                                await api.put(`/api/junta-integrantes/${i.id}`, { derecho_a_voto: i.derecho_a_voto ? 0 : 1 })
                                actualizar()
                              } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
                            }}
                          >{i.derecho_a_voto ? 'Quitar voto' : 'Dar voto'}</Boton>
                          <Boton
                            variante="enlace" tamano="sm" className="!text-rose-600"
                            onClick={async () => {
                              try {
                                await api.del(`/api/junta-integrantes/${i.id}`)
                                actualizar()
                              } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
                            }}
                          >Eliminar</Boton>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                    <p>Presidente: <strong>{junta.presidente_nombre ?? '—'}</strong> · Secretario: <strong>{junta.secretario_nombre ?? '—'}</strong></p>
                    <p className="mt-1">El secretario lleva el libro de actas y las hojas de calificación, y levanta acta de cada sesión (art. 25).</p>
                  </div>
                </Tarjeta>

                <Tarjeta padding={false}>
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Libro de actas</h3>
                      <p className="text-xs text-slate-500">Los acuerdos de la junta deben ser fundados y anotarse en las actas (art. 29).</p>
                    </div>
                    <Boton variante="secundario" tamano="sm" onClick={() => setNuevaActa(true)}>Levantar acta</Boton>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {(actas ?? []).map((a) => (
                      <li key={a.id} className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-slate-800">Acta {a.numero} · {a.tipo}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500">{fechaCorta(a.fecha)}</span>
                            <Insignia color={a.aprobada ? 'esmeralda' : 'ambar'}>{a.aprobada ? 'aprobada' : 'pendiente de aprobación'}</Insignia>
                          </div>
                        </div>
                        {a.acuerdos && <p className="mt-1 text-[12px] text-slate-600">{a.acuerdos}</p>}
                      </li>
                    ))}
                    {!actas?.length && <li className="px-4 py-4 text-center text-xs text-slate-400">Sin actas registradas para esta junta</li>}
                  </ul>
                </Tarjeta>
              </div>

              <Tarjeta padding={false}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Tablero de votación de la junta</h3>
                    <p className="text-xs text-slate-500">
                      {tablero?.votantes_con_derecho_a_voto ?? 0} integrantes con derecho a voto · se registran {meta?.subfactores?.length ?? 6} subfactores por funcionario
                    </p>
                  </div>
                  <Boton
                    variante="secundario" tamano="sm"
                    onClick={async () => {
                      try {
                        const r = await api.post(`/api/juntas/${junta.id}/asignar`, { solo_sin_junta: true })
                        setAviso({ tipo: 'exito', titulo: 'Asignación realizada', texto: `${r.asignadas} fichas del período quedaron asignadas a esta junta.` })
                        actualizar()
                      } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
                    }}
                  >Asignar fichas del período</Boton>
                </div>
                <Tabla
                  densa
                  columnas={[
                    { clave: 'funcionario_nombre', titulo: 'Funcionario', render: (f) => (
                      <Link to={`/calificaciones/${f.id}`} className="block">
                        <span className="flex items-center gap-1.5 font-medium text-slate-800 hover:text-marca-700">
                          <span className="truncate">{f.funcionario_nombre}</span>
                          {f.aneiich && <Icono nombre="aneiich" className="size-3.5 shrink-0 text-aneiich-500" />}
                        </span>
                        <span className="text-[11px] text-slate-500">{f.rut} · grado {f.grado} · {f.unidad_nombre ?? ''}</span>
                      </Link>
                    ) },
                    { clave: 'votacion', titulo: 'Votación por subfactor', render: (f) => (
                      <div className="w-40">
                        <BarraProgreso valor={f.subfactores_con_votos} total={meta?.subfactores?.length ?? 6} color={f.completo ? 'esmeralda' : 'violeta'} altura="h-1.5" />
                        <p className="mt-1 text-[10px] text-slate-500">{f.subfactores_con_votos} de {meta?.subfactores?.length ?? 6} subfactores · {f.votos_registrados} votos</p>
                      </div>
                    ) },
                    { clave: 'puntaje', titulo: 'Puntaje', clase: 'text-right tabular-nums', render: (f) => (f.puntaje !== null ? f.puntaje : '—') },
                    { clave: 'estado', titulo: 'Etapa', render: (f) => <Insignia color={f.estado === 'Ejecutoriado' ? 'esmeralda' : f.estado === 'En junta' ? 'violeta' : 'gris'}>{f.estado}</Insignia> },
                    { clave: '', titulo: '', render: (f) => <Link to={`/calificaciones/${f.id}`} className="text-xs font-medium text-marca-700 hover:underline">Votar</Link> },
                  ]}
                  datos={tablero?.datos ?? []}
                  vacio="No hay fichas asignadas a esta junta"
                />
              </Tarjeta>
            </div>
          )}
        </>
      )}

      {creando && <FormularioJunta periodo={periodo} onCerrar={() => setCreando(false)} onListo={(j) => { setCreando(false); setJuntaSel(j?.id); setAviso({ tipo: 'exito', titulo: 'Junta constituida', texto: 'La junta quedó registrada con sus integrantes.' }); actualizar(); recargarMeta() }} />}
      {agregando && junta && <FormularioIntegrante junta={junta} onCerrar={() => setAgregando(false)} onListo={() => { setAgregando(false); actualizar() }} />}
      {nuevaActa && junta && (
        <FormularioActa junta={junta} onCerrar={() => setNuevaActa(false)} onListo={() => { setNuevaActa(false); actualizar() }} />
      )}
    </div>
  )
}

function FormularioJunta({ periodo, onCerrar, onListo }) {
  const [sugerencias, setSugerencias] = useState(null)
  const [form, setForm] = useState({ tipo: 'Central', region: 'Metropolitana de Santiago', fecha_constitucion: periodo?.fecha_constitucion_junta ?? '', presidente_funcionario_id: '', secretario_funcionario_id: '' })
  const [seleccionados, setSeleccionados] = useState([])
  const [error, setError] = useState(null)

  const cargarSugerencias = async () => {
    const r = await api.get(`/api/juntas/sugerir?periodo=${periodo?.id ?? ''}`)
    setSugerencias(r)
    setSeleccionados(r.candidatos.slice(0, 5).map((c) => ({ funcionario_id: c.id, rol: 'Integrante', nombre: c.nombre_completo, cargo: c.cargo })))
  }

  return (
    <Modal
      abierto ancho="max-w-3xl" onCerrar={onCerrar}
      titulo="Constituir Junta Calificadora"
      descripcion="Art. 22: junta central con los cinco funcionarios de más alto nivel jerárquico (excluido el Jefe Superior) y un representante del personal."
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton
          onClick={async () => {
            try {
              const integ = seleccionados.map((s, i) => ({ ...s, orden: i + 1, rol: s.rol ?? 'Integrante' }))
              const r = await api.post('/api/juntas', { ...form, periodo_id: periodo?.id, integrantes: integ })
              onListo(r)
            } catch (e) { setError(e.message) }
          }}
        >Constituir junta</Boton>
      </>}
    >
      {error && <Aviso tipo="error" className="mb-4" titulo="Revise los datos">{error}</Aviso>}
      {!sugerencias ? (
        <div className="grid gap-4">
          <Aviso tipo="norma">
            El sistema puede proponer los integrantes según el grado y la antigüedad registrados, e incorporar al delegado de la asociación
            con derecho a voz.
          </Aviso>
          <Boton onClick={cargarSugerencias}>Proponer integrantes según el art. 22</Boton>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Tipo de junta"><Selector value={form.tipo} onChange={(e) => setForm((x) => ({ ...x, tipo: e.target.value }))} opciones={['Central', 'Regional']} /></Campo>
            <Campo etiqueta="Región"><Entrada value={form.region} onChange={(e) => setForm((x) => ({ ...x, region: e.target.value }))} /></Campo>
            <Campo etiqueta="Fecha de constitución"><Entrada type="date" value={form.fecha_constitucion} onChange={(e) => setForm((x) => ({ ...x, fecha_constitucion: e.target.value }))} /></Campo>
          </div>

          <Aviso tipo="norma">{sugerencias.glosa}</Aviso>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Integrantes propuestos</h4>
            <ul className="flex flex-col gap-1.5">
              {seleccionados.map((s, i) => (
                <li key={`${s.funcionario_id}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-[13px] font-medium text-slate-800">{s.nombre}</span>
                  <span className="text-[11px] text-slate-500">{s.cargo}</span>
                  <Selector
                    className="!ml-auto !w-44 !py-1 !text-xs" value={s.rol}
                    onChange={(e) => setSeleccionados((x) => x.map((y, j) => (j === i ? { ...y, rol: e.target.value } : y)))}
                    opciones={['Presidente', 'Integrante', 'Secretario', 'Representante del personal', 'Suplente', 'Delegado ANEIICH']}
                  />
                  <Boton variante="enlace" tamano="sm" className="!text-rose-600" onClick={() => setSeleccionados((x) => x.filter((_, j) => j !== i))}>Quitar</Boton>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar integrante</h4>
            <Selector
              placeholder="Seleccione un funcionario para incorporar…"
              onChange={(e) => {
                const c = sugerencias.candidatos.find((x) => String(x.id) === e.target.value)
                if (c) setSeleccionados((x) => [...x, { funcionario_id: c.id, rol: 'Integrante', nombre: c.nombre_completo, cargo: c.cargo }])
                e.target.value = ''
              }}
              opciones={sugerencias.candidatos.filter((c) => !seleccionados.some((s) => s.funcionario_id === c.id)).map((c) => ({ valor: c.id, etiqueta: `${c.nombre_completo} — grado ${c.grado}` }))}
            />
            <p className="mt-2 text-[11px] text-slate-500">{sugerencias.glosa_delegado}</p>
          </div>
        </div>
      )}
    </Modal>
  )
}

function FormularioIntegrante({ junta, onCerrar, onListo }) {
  const [form, setForm] = useState({ funcionario_id: '', nombre: '', cargo: '', rol: 'Integrante', derecho_a_voto: 1 })
  const [error, setError] = useState(null)
  const { datos: catalogos } = useDatos(() => api.get('/api/catalogos'), [])

  return (
    <Modal
      abierto onCerrar={onCerrar} ancho="max-w-xl"
      titulo={`Agregar integrante a la junta ${junta.tipo}`}
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={async () => {
          try {
            const r = await api.post(`/api/juntas/${junta.id}/integrantes`, form)
            if (r) onListo()
          } catch (e) { setError(e.message) }
        }}>Agregar integrante</Boton>
      </>}
    >
      {error && <Aviso tipo="error" className="mb-4">{error}</Aviso>}
      <div className="grid gap-4">
        <Campo etiqueta="Funcionario" ayuda="Si el integrante no está en la base, escríbalo como integrante externo.">
          <Selector
            placeholder="Seleccione un funcionario de la base"
            value={form.funcionario_id}
            onChange={(e) => {
              const f = (catalogos?.jefes ?? []).find((j) => String(j.id) === e.target.value)
              setForm((x) => ({ ...x, funcionario_id: e.target.value, nombre: f ? `${f.nombres} ${f.apellido_paterno}` : x.nombre, cargo: f?.cargo ?? x.cargo }))
            }}
            opciones={(catalogos?.jefes ?? []).map((j) => ({ valor: j.id, etiqueta: `${j.nombres} ${j.apellido_paterno} — ${j.cargo ?? ''}` }))}
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre (integrante externo)"><Entrada value={form.nombre} onChange={(e) => setForm((x) => ({ ...x, nombre: e.target.value }))} /></Campo>
          <Campo etiqueta="Cargo"><Entrada value={form.cargo} onChange={(e) => setForm((x) => ({ ...x, cargo: e.target.value }))} /></Campo>
        </div>
        <Campo etiqueta="Rol en la junta">
          <Selector value={form.rol} onChange={(e) => setForm((x) => ({ ...x, rol: e.target.value }))} opciones={['Presidente', 'Integrante', 'Secretario', 'Representante del personal', 'Suplente', 'Delegado ANEIICH']} />
        </Campo>
        <Conmutador
          activo={Boolean(form.derecho_a_voto)} onChange={(v) => setForm((x) => ({ ...x, derecho_a_voto: v }))}
          etiqueta="Tiene derecho a voto"
          ayuda="El delegado de la asociación de funcionarios sólo tiene derecho a voz ante la junta (art. 24)."
        />
      </div>
    </Modal>
  )
}

function FormularioActa({ junta, onCerrar, onListo }) {
  const [form, setForm] = useState({
    junta_id: junta.id, numero: '', fecha: new Date().toISOString().slice(0, 10), tipo: 'Calificación',
    asistentes: junta.integrantes.map((i) => i.nombre).join(', '), acuerdos: '', contenido: '', aprobada: 0,
  })
  return (
    <Modal
      abierto ancho="max-w-2xl" onCerrar={onCerrar}
      titulo="Levantar acta de la junta"
      descripcion="El secretario está obligado a levantar acta de cada sesión, la que será leída en la sesión siguiente y firmada por los asistentes (art. 25)."
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={async () => { await api.post('/api/actas', form); onListo() }}>Guardar acta</Boton>
      </>}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="N° de acta"><Entrada value={form.numero} onChange={(e) => setForm((x) => ({ ...x, numero: e.target.value }))} placeholder="2026-08" /></Campo>
          <Campo etiqueta="Fecha"><Entrada type="date" value={form.fecha} onChange={(e) => setForm((x) => ({ ...x, fecha: e.target.value }))} /></Campo>
          <Campo etiqueta="Tipo"><Selector value={form.tipo} onChange={(e) => setForm((x) => ({ ...x, tipo: e.target.value }))} opciones={['Constitución', 'Calificación', 'Acuerdo', 'Otra']} /></Campo>
        </div>
        <Campo etiqueta="Asistentes"><AreaTexto filas={2} value={form.asistentes} onChange={(e) => setForm((x) => ({ ...x, asistentes: e.target.value }))} /></Campo>
        <Campo etiqueta="Acuerdos adoptados" requerido ayuda="Los acuerdos deben ser siempre fundados (art. 29)">
          <AreaTexto filas={3} value={form.acuerdos} onChange={(e) => setForm((x) => ({ ...x, acuerdos: e.target.value }))} />
        </Campo>
        <Campo etiqueta="Contenido / desarrollo de la sesión"><AreaTexto filas={3} value={form.contenido} onChange={(e) => setForm((x) => ({ ...x, contenido: e.target.value }))} /></Campo>
        <Conmutador activo={Boolean(form.aprobada)} onChange={(v) => setForm((x) => ({ ...x, aprobada: v }))} etiqueta="Acta aprobada en la sesión siguiente" />
      </div>
    </Modal>
  )
}
