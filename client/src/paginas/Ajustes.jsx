import { useState } from 'react'
import { api } from '../api'
import { useDatos, useSistema } from '../contexto'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, Boton, Campo, Cargando, Entrada, Icono, Insignia, Modal, Seccion, Selector, Tabla, Tarjeta,
} from '../componentes/ui'

const fechaCorta = (f) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-CL') : '—')

export default function Ajustes() {
  const { meta, recargar: recargarMeta, setPeriodoId } = useSistema()
  const [aviso, setAviso] = useState(null)
  const [nuevoPeriodo, setNuevoPeriodo] = useState(false)
  const [nuevaUnidad, setNuevaUnidad] = useState(false)
  const [confirmacion, setConfirmacion] = useState(null)
  const [config, setConfig] = useState(null)

  const { datos: periodos, cargando, recargar } = useDatos(() => api.get('/api/periodos'), [])
  const { datos: unidades, recargar: recargarUnidades } = useDatos(() => api.get('/api/unidades'), [])
  const { datos: base, recargar: recargarBase } = useDatos(() => api.get('/api/resumen-base'), [])
  const { datos: configActual } = useDatos(() => api.get('/api/config'), [])

  const valorConfig = config ?? configActual ?? {}

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Ajustes, períodos y datos del sistema"
        descripcion="Configure la institución, administre los períodos de calificación, las unidades y la carga de datos."
      />

      {aviso && <Aviso tipo={aviso.tipo} titulo={aviso.titulo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Tarjeta>
          <Seccion titulo="Identificación institucional" descripcion="Estos datos aparecen en las hojas de calificación, reportes y encabezados del sistema.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Institución"><Entrada value={valorConfig.institucion ?? ''} onChange={(e) => setConfig({ ...valorConfig, institucion: e.target.value })} /></Campo>
              <Campo etiqueta="Sigla"><Entrada value={valorConfig.sigla_institucion ?? ''} onChange={(e) => setConfig({ ...valorConfig, sigla_institucion: e.target.value })} /></Campo>
              <Campo etiqueta="Asociación de funcionarios" ayuda="Se usa para identificar a los asociados en todo el sistema">
                <Entrada value={valorConfig.asociacion_nombre ?? ''} onChange={(e) => setConfig({ ...valorConfig, asociacion_nombre: e.target.value })} />
              </Campo>
              <Campo etiqueta="Nombre completo de la asociación"><Entrada value={valorConfig.asociacion_detalle ?? ''} onChange={(e) => setConfig({ ...valorConfig, asociacion_detalle: e.target.value })} /></Campo>
              <Campo etiqueta="Unidad encargada de personal"><Entrada value={valorConfig.unidad_personal ?? ''} onChange={(e) => setConfig({ ...valorConfig, unidad_personal: e.target.value })} /></Campo>
              <Campo etiqueta="Clave de acceso" ayuda="Se solicita al ingresar al sistema">
                <Entrada type="text" value={valorConfig.clave_acceso ?? ''} onChange={(e) => setConfig({ ...valorConfig, clave_acceso: e.target.value })} />
              </Campo>
            </div>
            <Boton
              className="mt-3"
              onClick={async () => {
                try {
                  await api.put('/api/config', valorConfig)
                  setAviso({ tipo: 'exito', titulo: 'Configuración guardada', texto: 'Los cambios se aplicarán en los próximos documentos que genere.' })
                  recargarMeta()
                } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
              }}
            >Guardar configuración</Boton>
          </Seccion>
        </Tarjeta>

        <Tarjeta>
          <Seccion
            titulo="Datos del sistema"
            descripcion="Cargue datos de ejemplo para capacitación o deje la base vacía para incorporar la dotación real."
            acciones={<Boton variante="secundario" tamano="sm" onClick={recargarBase}>Actualizar</Boton>}
          >
            {base && (
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries({
                  Funcionarios: base.funcionarios, 'Jefes evaluadores': base.jefes, 'Asociados ANEIICH': base.asociados_aneiich,
                  Unidades: base.unidades, Períodos: base.periodos, Calificaciones: base.calificaciones,
                  'Votos de junta': base.votos, 'Hojas de vida': base.hojas_de_vida,
                  'Informes de desempeño': base.informes, Apelaciones: base.apelaciones, Actas: base.actas,
                }).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="text-xs text-slate-600">{k}</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-800">{v}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Boton variante="secundario" onClick={() => setConfirmacion('demo')}>Recargar datos de ejemplo</Boton>
              <Boton variante="peligro" onClick={() => setConfirmacion('vacio')}>Vaciar la base de datos</Boton>
            </div>
          </Seccion>
        </Tarjeta>
      </div>

      <Seccion
        titulo="Períodos de calificación"
        descripcion="El período comprende doce meses de desempeño, del 1 de septiembre al 31 de agosto del año siguiente; el proceso se inicia el 1 de septiembre y termina a más tardar el 30 de noviembre (art. 3)."
        acciones={<Boton onClick={() => setNuevoPeriodo(true)}><Icono nombre="mas" className="size-4" /> Nuevo período</Boton>}
      >
        {cargando && !periodos ? <Cargando /> : (
          <Tabla
            densa
            columnas={[
              { clave: 'anio', titulo: 'Período', render: (p) => <span className="font-semibold text-slate-800">{p.anio}</span> },
              { clave: 'rango', titulo: 'Desempeño evaluado', render: (p) => `${fechaCorta(p.fecha_inicio)} al ${fechaCorta(p.fecha_termino)}` },
              { clave: 'fecha_constitucion_junta', titulo: 'Constitución junta', render: (p) => fechaCorta(p.fecha_constitucion_junta) },
              { clave: 'fecha_limite_calificaciones', titulo: 'Límite calificaciones', render: (p) => fechaCorta(p.fecha_limite_calificaciones) },
              { clave: 'estado', titulo: 'Estado', render: (p) => <Insignia color={p.estado === 'En proceso' ? 'marca' : 'gris'}>{p.estado}{p.vigente ? ' · actual' : ''}</Insignia> },
              { clave: 'estadisticas', titulo: 'Fichas', clase: 'text-right', render: (p) => (
                <span className="text-xs text-slate-600">{p.estadisticas?.total ?? 0} fichas · {p.estadisticas?.con_puntaje ?? 0} con puntaje</span>
              ) },
              { clave: 'listas', titulo: 'Listas', render: (p) => (
                <span className="flex gap-1">
                  {(p.rango_listas ?? []).map((l) => (
                    <Insignia key={l.lista} color={l.lista === 1 ? 'esmeralda' : l.lista === 2 ? 'cielo' : l.lista === 3 ? 'ambar' : 'rojo'}>L{l.lista}: {l.n}</Insignia>
                  ))}
                </span>
              ) },
              { clave: 'acciones', titulo: '', render: (p) => (
                <div className="flex gap-2">
                  {!p.vigente && (
                    <Boton variante="enlace" tamano="sm" onClick={async () => {
                      await api.post(`/api/periodos/${p.id}/vigente`)
                      setPeriodoId(p.id)
                      recargar()
                      recargarMeta()
                    }}>Marcar actual</Boton>
                  )}
                  <Boton variante="enlace" tamano="sm" className="!text-rose-600" onClick={() => setConfirmacion({ tipo: 'periodo', periodo: p })}>Eliminar</Boton>
                </div>
              ) },
            ]}
            datos={periodos ?? []}
            vacio="Sin períodos registrados"
          />
        )}
      </Seccion>

      <Seccion
        titulo="Unidades y direcciones regionales"
        descripcion="Estructura orgánica usada para asignar funcionarios y consolidar promedios por unidad y región."
        acciones={<Boton onClick={() => setNuevaUnidad(true)}><Icono nombre="mas" className="size-4" /> Nueva unidad</Boton>}
      >
        <Tabla
          densa
          columnas={[
            { clave: 'nombre', titulo: 'Unidad' },
            { clave: 'sigla', titulo: 'Sigla' },
            { clave: 'tipo', titulo: 'Tipo' },
            { clave: 'region', titulo: 'Región' },
            { clave: 'dotacion', titulo: 'Dotación', clase: 'text-right tabular-nums' },
            { clave: 'acciones', titulo: '', render: (u) => (
              <Boton variante="enlace" tamano="sm" className="!text-rose-600" onClick={async () => {
                try {
                  await api.del(`/api/unidades/${u.id}`)
                  recargarUnidades()
                } catch (e) { setAviso({ tipo: 'error', titulo: 'No se pudo eliminar', texto: e.message }) }
              }}>Eliminar</Boton>
            ) },
          ]}
          datos={unidades ?? []}
          vacio="Sin unidades registradas"
        />
      </Seccion>

      <Aviso tipo="norma" titulo="Trazabilidad del proceso">
        Todas las actuaciones relevantes quedan registradas en la bitácora del sistema, disponible en la sección de Reportes. Las
        calificaciones son confidenciales durante su tramitación, pero el escalafón de mérito es público para los funcionarios de la
        institución (art. 39).
      </Aviso>

      {nuevoPeriodo && <FormularioPeriodo onCerrar={() => setNuevoPeriodo(false)} onListo={(p) => { setNuevoPeriodo(false); setPeriodoId(p.id); recargar(); recargarMeta(); setAviso({ tipo: 'exito', titulo: 'Período creado', texto: `Se creó el período ${p.anio} y quedó seleccionado como período actual.` }) }} />}
      {nuevaUnidad && <FormularioUnidad onCerrar={() => setNuevaUnidad(false)} onListo={() => { setNuevaUnidad(false); recargarUnidades(); recargarMeta() }} />}

      {confirmacion && (
        <Modal
          abierto ancho="max-w-lg" onCerrar={() => setConfirmacion(null)}
          titulo={confirmacion === 'demo' ? 'Recargar datos de ejemplo' : confirmacion === 'vacio' ? 'Vaciar la base de datos' : `Eliminar el período ${confirmacion.periodo?.anio ?? ''}`}
          pie={<>
            <Boton variante="secundario" onClick={() => setConfirmacion(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={async () => {
              try {
                if (confirmacion === 'demo') await api.post('/api/admin/reiniciar', { modo: 'demo' })
                else if (confirmacion === 'vacio') await api.post('/api/admin/reiniciar', { modo: 'vacio' })
                else await api.del(`/api/periodos/${confirmacion.periodo.id}?forzar=1`)
                setConfirmacion(null)
                recargar()
                recargarBase()
                recargarMeta()
                setAviso({ tipo: 'exito', titulo: 'Operación realizada', texto: 'La base de datos quedó actualizada.' })
              } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
            }}>Confirmar</Boton>
          </>}
        >
          <Aviso tipo="alerta">
            {confirmacion === 'demo' && 'Se eliminarán TODOS los registros actuales y se cargará una dotación de ejemplo con funcionarios, jefes, calificaciones y votaciones de la junta.'}
            {confirmacion === 'vacio' && 'Se eliminarán TODOS los registros (funcionarios, calificaciones, votos, hojas de vida, informes, actas y períodos). Esta acción no se puede deshacer.'}
            {confirmacion !== 'demo' && confirmacion !== 'vacio' && 'Se eliminará el período y todas las fichas de calificación asociadas.'}
          </Aviso>
        </Modal>
      )}
    </div>
  )
}

function FormularioPeriodo({ onCerrar, onListo }) {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [error, setError] = useState(null)
  return (
    <Modal
      abierto ancho="max-w-lg" onCerrar={onCerrar}
      titulo="Crear período de calificación"
      descripcion="Ingrese el año de la calificación; el sistema calculará las fechas legales del proceso."
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={async () => {
          try {
            const r = await api.post('/api/periodos', { anio: Number(anio) })
            await api.post(`/api/periodos/${r.id}/vigente`)
            onListo(r)
          } catch (e) { setError(e.message) }
        }}>Crear período</Boton>
      </>}
    >
      {error && <Aviso tipo="error" className="mb-4">{error}</Aviso>}
      <Campo etiqueta="Año de la calificación" requerido ayuda="Ejemplo: 2027 comprende el desempeño entre el 1 de septiembre de 2026 y el 31 de agosto de 2027.">
        <Entrada type="number" min="1998" max="2100" value={anio} onChange={(e) => setAnio(e.target.value)} />
      </Campo>
      <Aviso tipo="norma" className="mt-3">
        Se fijan automáticamente: constitución de la junta el 21 de septiembre, calificaciones en poder del secretario antes del 15 de
        octubre y vigencia del escalafón el 31 de diciembre (arts. 28 y 39).
      </Aviso>
    </Modal>
  )
}

function FormularioUnidad({ onCerrar, onListo }) {
  const { meta } = useSistema()
  const [form, setForm] = useState({ nombre: '', sigla: '', tipo: 'Unidad', region: '', direccion: '' })
  const [error, setError] = useState(null)
  return (
    <Modal
      abierto onCerrar={onCerrar}
      titulo="Registrar unidad"
      pie={<>
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={async () => {
          try {
            await api.post('/api/unidades', form)
            onListo()
          } catch (e) { setError(e.message) }
        }}>Registrar unidad</Boton>
      </>}
    >
      {error && <Aviso tipo="error" className="mb-4">{error}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" requerido><Entrada value={form.nombre} onChange={(e) => setForm((x) => ({ ...x, nombre: e.target.value }))} /></Campo>
        <Campo etiqueta="Sigla"><Entrada value={form.sigla} onChange={(e) => setForm((x) => ({ ...x, sigla: e.target.value }))} /></Campo>
        <Campo etiqueta="Tipo"><Selector value={form.tipo} onChange={(e) => setForm((x) => ({ ...x, tipo: e.target.value }))} opciones={['Nivel Central', 'Subdirección', 'Dirección Regional', 'Departamento', 'Unidad']} /></Campo>
        <Campo etiqueta="Región"><Entrada value={form.region} onChange={(e) => setForm((x) => ({ ...x, region: e.target.value }))} placeholder="Metropolitana de Santiago" /></Campo>
        <Campo etiqueta="Dirección" className="sm:col-span-2"><Entrada value={form.direccion} onChange={(e) => setForm((x) => ({ ...x, direccion: e.target.value }))} /></Campo>
      </div>
      <p className="mt-3 text-xs text-slate-500">{meta?.unidad_personal} es la unidad encargada de llevar las hojas de vida y de personal.</p>
    </Modal>
  )
}
