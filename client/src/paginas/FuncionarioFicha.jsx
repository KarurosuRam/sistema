import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useDatos, useSistema } from '../contexto'
import { EncabezadoPagina } from '../componentes/Diseno'
import { Lineas } from '../componentes/Graficos'
import { FormularioFuncionario } from './Funcionarios'
import {
  Aviso, AreaTexto, Boton, Campo, Cargando, Conmutador, Entrada, Icono, Insignia, InsigniaAneiich,
  InsigniaEstado, InsigniaLista, Modal, Pestanas, Seccion, Selector, Tabla, Tarjeta,
} from '../componentes/ui'

const nf = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const fechaCorta = (f) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-CL') : '—')

export default function FuncionarioFicha() {
  const { id } = useParams()
  const { meta, recargar: recargarMeta } = useSistema()
  const navegar = useNavigate()
  const { datos, cargando, error, recargar } = useDatos(() => api.get(`/api/funcionarios/${id}`), [id])
  const [pestana, setPestana] = useState('datos')
  const [editando, setEditando] = useState(false)
  const [nuevaAnotacion, setNuevaAnotacion] = useState(false)
  const [aviso, setAviso] = useState(null)

  if (cargando && !datos) return <Cargando />
  if (error) return <Aviso tipo="error" titulo="No fue posible abrir la ficha">{error}</Aviso>
  if (!datos) return null

  const { funcionario: f, calificaciones, hoja_vida: hv, informes, apelaciones, dependientes, promedio_historico } = datos
  const serie = [...calificaciones].filter((c) => c.puntaje !== null).sort((a, b) => a.anio - b.anio)
    .map((c) => ({ nombre: String(c.anio), puntaje: c.puntaje }))

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        migas={<Link to="/funcionarios" className="hover:text-marca-700">Funcionarios</Link>}
        titulo={f.nombre_completo}
        descripcion={`${f.cargo ?? 'Sin cargo'} · grado ${f.grado ?? '—'} · ${f.planta} · ${f.unidad_nombre ?? 'sin unidad'} · jefe directo: ${f.jefe_nombre ?? 'sin asignar'}`}
        acciones={<>
          <Boton variante="secundario" onClick={() => setEditando(true)}>Editar datos</Boton>
          <Boton variante="secundario" onClick={() => setNuevaAnotacion(true)}>Anotar en hoja de vida</Boton>
          {f.cal_id && <Boton onClick={() => navegar(`/calificaciones/${f.cal_id}`)}>Abrir hoja de calificación</Boton>}
        </>}
      />

      {aviso && <Aviso tipo={aviso.tipo} titulo={aviso.titulo}>{aviso.texto}</Aviso>}

      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-12 place-items-center rounded-xl bg-marca-50 text-lg font-semibold text-marca-700">
              {f.nombres?.charAt(0)}{f.apellido_paterno?.charAt(0)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {f.aneiich && <InsigniaAneiich rol={f.rol_aneiich} />}
                {f.es_jefe_evaluador && <Insignia color="ambar">jefe evaluador · {dependientes.length} dependientes</Insignia>}
                <InsigniaEstado estado={f.estado} />
                {f.no_calificable && <Insignia color="gris">excluido de calificación</Insignia>}
                {!f.calificable && !f.no_calificable && <Insignia color="ambar">no calificable</Insignia>}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                RUT {f.rut} · {f.email ?? 'sin correo'} · {f.telefono ?? 'sin teléfono'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-right sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Promedio histórico</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900">{nf(promedio_historico?.promedio)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Períodos calificados</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900">{promedio_historico?.periodos ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Antigüedad</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900">
                {f.fecha_ingreso_servicio ? `${Math.floor((Date.now() - new Date(f.fecha_ingreso_servicio)) / 31557600000)} años` : '—'}
              </p>
            </div>
          </div>
        </div>
        {!f.calificable && (
          <Aviso tipo="alerta" className="mt-3" titulo="Situación frente al proceso calificatorio">
            {f.causal_no_calificable_calc ?? f.causal_no_calificable} — conserva su última calificación cuando corresponde (art. 5).
          </Aviso>
        )}
      </Tarjeta>

      <Pestanas
        activa={pestana} onChange={setPestana}
        pestanas={[
          { clave: 'datos', titulo: 'Datos funcionarios' },
          { clave: 'calificaciones', titulo: 'Calificaciones', contador: calificaciones.length },
          { clave: 'hojavida', titulo: 'Hoja de vida', contador: hv.length },
          { clave: 'informes', titulo: 'Informes de desempeño', contador: informes.length },
          { clave: 'recursos', titulo: 'Apelaciones', contador: apelaciones.length },
          { clave: 'dependientes', titulo: 'Dependientes', contador: dependientes.length },
        ]}
      />

      {pestana === 'datos' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Antecedentes personales y funcionarios</h3>
            <dl className="grid gap-2 sm:grid-cols-2">
              <Dato e="Nombres" v={f.nombres} />
              <Dato e="Apellidos" v={`${f.apellido_paterno} ${f.apellido_materno ?? ''}`} />
              <Dato e="RUT" v={f.rut} />
              <Dato e="Sexo" v={f.sexo === 'F' ? 'Femenino' : f.sexo === 'M' ? 'Masculino' : '—'} />
              <Dato e="Nacimiento" v={fechaCorta(f.fecha_nacimiento)} />
              <Dato e="Correo" v={f.email} />
              <Dato e="Cargo" v={f.cargo} />
              <Dato e="Grado" v={f.grado} />
              <Dato e="Estamento" v={`${f.planta} (coef. ${meta?.coeficientes?.[f.planta]?.rendimiento}/${meta?.coeficientes?.[f.planta]?.condiciones}/${meta?.coeficientes?.[f.planta]?.comportamiento})`} />
              <Dato e="Calidad jurídica" v={f.calidad_juridica} />
              <Dato e="Jornada" v={f.jornada} />
              <Dato e="Unidad" v={f.unidad_nombre} />
              <Dato e="Región" v={f.region} />
              <Dato e="Ingreso al servicio" v={fechaCorta(f.fecha_ingreso_servicio)} />
              <Dato e="Promoción al grado" v={fechaCorta(f.fecha_ingreso_grado)} />
              <Dato e="Ingreso a la Administración" v={fechaCorta(f.fecha_ingreso_administracion)} />
            </dl>
          </Tarjeta>

          <div className="flex flex-col gap-4">
            <Tarjeta className={f.aneiich ? 'ring-1 ring-aneiich-100' : ''}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Icono nombre="aneiich" className="size-4 text-aneiich-500" /> Condición gremial
              </h3>
              {f.aneiich ? (
                <dl className="grid gap-2 sm:grid-cols-2">
                  <Dato e="Asociado a" v={meta?.asociacion} />
                  <Dato e="Rol" v={f.rol_aneiich ?? 'Socio'} />
                  <Dato e="Afiliación" v={fechaCorta(f.fecha_afiliacion)} />
                  <Dato e="Dirigente" v={f.es_dirigente_asociacion ? 'Sí' : 'No'} />
                  <Dato e="Delegado del personal" v={f.es_delegado_personal ? 'Sí' : 'No'} />
                  <Dato e="Solicitó ser calificado" v={f.solicita_ser_calificado ? 'Sí' : 'No'} />
                  {f.observacion_aneiich && <Dato e="Observación" v={f.observacion_aneiich} />}
                </dl>
              ) : (
                <p className="text-sm text-slate-500">El funcionario no está marcado como asociado a {meta?.asociacion}.</p>
              )}
            </Tarjeta>

            <Tarjeta>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Evolución de puntajes</h3>
              {serie.length ? <Lineas datos={serie} altura={220} dominio={[40, 100]} categorias={[{ clave: 'puntaje', titulo: 'Puntaje', color: '#1f47dd' }]} />
                : <p className="text-sm text-slate-500">Aún no hay calificaciones con puntaje asignado.</p>}
            </Tarjeta>
          </div>
        </div>
      )}

      {pestana === 'calificaciones' && (
        <Seccion titulo="Calificaciones por período" descripcion="Cada período tiene su propia hoja con notas, argumentos y votación de la junta.">
          <Tabla
            onFila={(c) => navegar(`/calificaciones/${c.id}`)}
            columnas={[
              { clave: 'anio', titulo: 'Período' },
              { clave: 'estado', titulo: 'Etapa', render: (c) => <InsigniaEstado estado={c.estado} /> },
              { clave: 'precal_jefe_nombre', titulo: 'Jefe evaluador', render: (c) => <span className="text-[12px] text-slate-600">{c.precal_jefe_nombre ?? '—'}</span> },
              { clave: 'puntaje', titulo: 'Puntaje', clase: 'text-right', render: (c) => <span className="tabular-nums font-semibold">{nf(c.puntaje)}</span> },
              { clave: 'lista', titulo: 'Lista', render: (c) => <InsigniaLista lista={c.lista} /> },
              { clave: 'acta_numero', titulo: 'Acta' },
              { clave: 'notificada_fecha', titulo: 'Notificación', render: (c) => fechaCorta(c.notificada_fecha) },
              { clave: 'ejecutoriada_fecha', titulo: 'Ejecutoria', render: (c) => fechaCorta(c.ejecutoriada_fecha) },
              { clave: 'escala_numero', titulo: 'Escalafón' },
            ]}
            datos={calificaciones}
            vacio="Sin calificaciones registradas"
          />
        </Seccion>
      )}

      {pestana === 'hojavida' && (
        <Seccion
          titulo="Hoja de vida (arts. 8 a 11)"
          descripcion="Anotaciones de mérito y demérito dispuestas por el jefe directo, con su notificación, solicitudes del funcionario y resolución."
          acciones={<Boton onClick={() => setNuevaAnotacion(true)}><Icono nombre="mas" className="size-4" /> Nueva anotación</Boton>}
        >
          <Tabla
            columnas={[
              { clave: 'tipo', titulo: 'Tipo', render: (x) => <Insignia color={x.tipo === 'Mérito' ? 'esmeralda' : 'rojo'}>{x.tipo}</Insignia> },
              { clave: 'fecha', titulo: 'Fecha', render: (x) => fechaCorta(x.fecha) },
              { clave: 'categoria', titulo: 'Categoría' },
              { clave: 'descripcion', titulo: 'Descripción', render: (x) => <span className="text-[13px] text-slate-700">{x.descripcion}</span> },
              { clave: 'notificada_fecha', titulo: 'Notificada', render: (x) => fechaCorta(x.notificada_fecha) },
              { clave: 'solicitud_texto', titulo: 'Solicitud del funcionario', render: (x) => <span className="text-[11px] text-slate-600">{x.solicitud_fecha ? `Presentada el ${fechaCorta(x.solicitud_fecha)}` : '—'}</span> },
              { clave: 'resolucion', titulo: 'Resolución', render: (x) => <Insignia color={x.resolucion === 'Sin efecto' ? 'esmeralda' : x.resolucion === 'Con atenuantes' ? 'ambar' : x.resolucion === 'Pendiente' ? 'gris' : 'rojo'}>{x.resolucion}</Insignia> },
              { clave: 'copia_asociacion', titulo: 'Copia a la asociación', render: (x) => (x.copia_asociacion ? <Icono nombre="check" className="size-4 text-emerald-600" /> : '—') },
            ]}
            datos={hv}
            vacio="Sin anotaciones registradas"
          />
        </Seccion>
      )}

      {pestana === 'informes' && (
        <Seccion titulo="Informes de desempeño (art. 19)" descripcion="Dos informes por período, con hoja de observaciones del funcionario.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {informes.map((i) => (
              <Tarjeta key={i.id}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">{i.numero}° informe</h4>
                  <Insignia color={i.notificado_fecha ? 'esmeralda' : 'ambar'}>{i.notificado_fecha ? 'notificado' : 'pendiente'}</Insignia>
                </div>
                <p className="mt-1 text-xs text-slate-500">{fechaCorta(i.fecha_desde)} al {fechaCorta(i.fecha_hasta)}</p>
                <p className="mt-2 text-[13px] text-slate-700">{i.resumen ?? 'Sin contenido registrado.'}</p>
                {i.observaciones_funcionario && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600">{i.observaciones_funcionario}</p>}
              </Tarjeta>
            ))}
            {!informes.length && <Aviso tipo="info">Sin informes de desempeño registrados para este funcionario.</Aviso>}
          </div>
        </Seccion>
      )}

      {pestana === 'recursos' && (
        <Seccion titulo="Apelaciones y reclamos" descripcion="Recursos interpuestos contra las resoluciones de la Junta Calificadora.">
          <Tabla
            columnas={[
              { clave: 'anio', titulo: 'Período' },
              { clave: 'tipo', titulo: 'Recurso' },
              { clave: 'fecha', titulo: 'Interposición', render: (a) => fechaCorta(a.fecha) },
              { clave: 'autoridad', titulo: 'Autoridad' },
              { clave: 'puntaje_junta', titulo: 'Puntaje junta', clase: 'text-right tabular-nums' },
              { clave: 'puntaje_resuelto', titulo: 'Puntaje resuelto', clase: 'text-right tabular-nums' },
              { clave: 'resolucion', titulo: 'Resolución', render: (a) => <Insignia color={a.resolucion === 'Se eleva el puntaje' ? 'esmeralda' : a.resolucion === 'Pendiente de resolución' ? 'ambar' : 'gris'}>{a.resolucion}</Insignia> },
            ]}
            datos={apelaciones}
            vacio="Sin apelaciones registradas"
          />
        </Seccion>
      )}

      {pestana === 'dependientes' && (
        <Seccion titulo="Personal bajo su dependencia" descripcion="Funcionarios de quienes este jefe es precalificador (art. 21).">
          <Tabla
            columnas={[
              { clave: 'nombre', titulo: 'Funcionario', render: (d) => `${d.nombres} ${d.apellido_paterno} ${d.apellido_materno ?? ''}` },
              { clave: 'cargo', titulo: 'Cargo' },
              { clave: 'grado', titulo: 'Grado', clase: 'text-right tabular-nums' },
              { clave: 'acciones', titulo: '', render: (d) => <Link to={`/funcionarios/${d.id}`} className="text-xs font-medium text-marca-700 hover:underline">Ver ficha</Link> },
            ]}
            datos={dependientes}
            vacio="No tiene funcionarios a cargo"
          />
        </Seccion>
      )}

      {editando && (
        <FormularioFuncionario
          inicial={f}
          onCerrar={() => setEditando(false)}
          onGuardado={() => { setEditando(false); setAviso({ tipo: 'exito', titulo: 'Datos actualizados', texto: 'Los cambios quedaron guardados.' }); recargar(); recargarMeta() }}
        />
      )}

      {nuevaAnotacion && (
        <FormularioAnotacion
          funcionario={f}
          onCerrar={() => setNuevaAnotacion(false)}
          onListo={() => { setNuevaAnotacion(false); setAviso({ tipo: 'exito', titulo: 'Anotación registrada', texto: 'La anotación quedó incorporada a la hoja de vida del período.' }); recargar() }}
        />
      )}
    </div>
  )
}

function Dato({ e, v }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{e}</dt>
      <dd className="text-[13px] text-slate-800">{v ?? '—'}</dd>
    </div>
  )
}

function FormularioAnotacion({ funcionario, onCerrar, onListo }) {
  const { meta, periodoId } = useSistema()
  const [form, setForm] = useState({
    funcionario_id: funcionario.id, periodo_id: periodoId, tipo: 'Mérito', fecha: new Date().toISOString().slice(0, 10),
    categoria: '', descripcion: '', notificada_fecha: '', emitida_por_id: funcionario.jefe_id ?? '', copia_asociacion: 0, resolucion: 'Pendiente',
  })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const categorias = form.tipo === 'Mérito' ? meta?.categoriasMerito : meta?.categoriasDemerito

  return (
    <Modal
      abierto onCerrar={onCerrar}
      titulo="Anotación en la hoja de vida"
      descripcion={`${funcionario.nombres} ${funcionario.apellido_paterno} — ${funcionario.cargo ?? ''}`}
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton cargando={enviando} onClick={async () => {
          setEnviando(true)
          try {
            await api.post('/api/hoja-vida', form)
            onListo()
          } catch (e) { setError(e.message) } finally { setEnviando(false) }
        }}>Registrar anotación</Boton>
      </>}
    >
      {error && <Aviso tipo="error" className="mb-4" titulo="Revise los datos">{error}</Aviso>}
      <div className="grid gap-4">
        <Aviso tipo="norma">
          Las anotaciones de mérito o demérito las dispone por escrito el jefe directo y deben notificarse al funcionario dentro de tres
          días; el funcionario puede solicitar dejarlas sin efecto o consignar atenuantes dentro de cinco días (arts. 8 a 11).
        </Aviso>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Tipo de anotación" requerido>
            <Selector value={form.tipo} onChange={(e) => setForm((x) => ({ ...x, tipo: e.target.value, categoria: '' }))} opciones={['Mérito', 'Demérito']} />
          </Campo>
          <Campo etiqueta="Fecha de la anotación" requerido>
            <Entrada type="date" value={form.fecha} onChange={(e) => setForm((x) => ({ ...x, fecha: e.target.value }))} />
          </Campo>
          <Campo etiqueta="Fecha de notificación">
            <Entrada type="date" value={form.notificada_fecha} onChange={(e) => setForm((x) => ({ ...x, notificada_fecha: e.target.value }))} />
          </Campo>
        </div>
        <Campo etiqueta="Categoría" requerido>
          <Selector placeholder="Seleccione el tipo de anotación" value={form.categoria} onChange={(e) => setForm((x) => ({ ...x, categoria: e.target.value }))} opciones={categorias ?? []} />
        </Campo>
        <Campo etiqueta="Descripción de la conducta o desempeño" requerido>
          <AreaTexto filas={3} value={form.descripcion} onChange={(e) => setForm((x) => ({ ...x, descripcion: e.target.value }))} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Dispuesta por">
            <Selector value={form.emitida_por_id ?? ''} onChange={(e) => setForm((x) => ({ ...x, emitida_por_id: e.target.value }))}
              opciones={(meta?.jefes ?? []).map((j) => ({ valor: j.id, etiqueta: `${j.nombres} ${j.apellido_paterno}` }))} />
          </Campo>
          <div className="flex items-end pb-2">
            <Conmutador
              activo={Boolean(form.copia_asociacion)} onChange={(v) => setForm((x) => ({ ...x, copia_asociacion: v }))}
              etiqueta={`Enviar copia a ${meta?.asociacion ?? 'la asociación'}`} ayuda="Cuando el funcionario lo solicita expresamente (art. 9)"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
