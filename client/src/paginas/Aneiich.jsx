import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, descargar } from '../api'
import { useDatos, useSistema } from '../contexto'
import { Barras, Torta } from '../componentes/Graficos'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, Boton, Campo, Cargando, Entrada, Icono, Indicador, Insignia, InsigniaAneiich, InsigniaLista,
  Modal, Seccion, Selector, Tabla, Tarjeta,
} from '../componentes/ui'

const nf = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export default function Aneiich() {
  const { meta, periodo, recargar: recargarMeta } = useSistema()
  const [buscar, setBuscar] = useState('')
  const [rol, setRol] = useState('')
  const [unidad, setUnidad] = useState('')
  const [estamento, setEstamento] = useState('')
  const [seleccion, setSeleccion] = useState([])
  const [aviso, setAviso] = useState(null)
  const [accion, setAccion] = useState(null)

  const { datos, cargando, error, recargar } = useDatos(() => api.get('/api/aneiich/padron'), [periodo?.id])

  const filas = useMemo(() => {
    const base = datos?.datos ?? []
    return base.filter((f) => {
      if (rol && (f.rol_aneiich ?? 'Socio') !== rol) return false
      if (unidad && f.unidad_nombre !== unidad) return false
      if (estamento && f.planta !== estamento) return false
      if (buscar) {
        const t = buscar.toLowerCase()
        const texto = `${f.nombre_completo} ${f.rut} ${f.cargo ?? ''} ${f.unidad_nombre ?? ''}`.toLowerCase()
        if (!texto.includes(t)) return false
      }
      return true
    })
  }, [datos, buscar, rol, unidad, estamento])

  const asociacion = meta?.asociacion ?? 'ANEIICH'
  const conPuntaje = filas.filter((f) => f.puntaje !== null)
  const promedio = conPuntaje.length ? conPuntaje.reduce((a, f) => a + f.puntaje, 0) / conPuntaje.length : null

  const aplicar = async (cuerpo) => {
    try {
      const r = await api.post('/api/funcionarios/masivo', { ids: seleccion, ...cuerpo })
      setAviso({ tipo: 'exito', titulo: 'Acción aplicada', texto: `${r.detalle} — ${r.afectados} funcionarios.` })
      setAccion(null)
      setSeleccion([])
      recargar()
      recargarMeta()
    } catch (e) {
      setAviso({ tipo: 'error', titulo: 'No se pudo aplicar la acción', texto: e.message })
    }
  }

  const seleccionarTodos = () => {
    const todos = seleccion.length === filas.length && filas.length > 0
    setSeleccion(todos ? [] : filas.map((f) => f.id))
    setAviso(todos
      ? null
      : {
        tipo: 'exito',
        titulo: 'Selección rápida aplicada',
        texto: `Se seleccionaron ${filas.length} asociados a ${asociacion}. Puede asignar roles, reasignar jefaturas o exportar el padrón.`,
      })
  }

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo={`Padrón de asociados a ${asociacion}`}
        descripcion={`${meta?.asociacion_detalle ?? ''} Los asociados se identifican visualmente en todo el sistema y pueden seleccionarse de forma rápida para acciones masivas.`}
        acciones={<>
          <Boton variante="secundario" onClick={() => descargar(`/api/reportes/aneiich.csv?periodo=${periodo?.id ?? ''}`, `padron-${asociacion.toLowerCase()}.csv`)}>
            <Icono nombre="descargar" className="size-4" /> Exportar padrón
          </Boton>
          <Link to="/funcionarios"><Boton variante="secundario">Base de funcionarios</Boton></Link>
        </>}
      />

      {aviso && <Aviso tipo={aviso.tipo} titulo={aviso.titulo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}
      {error && <Aviso tipo="error" titulo="No fue posible cargar el padrón">{error}</Aviso>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Asociados" valor={datos?.total ?? 0} detalle="Marcados en la base de funcionarios" color="violeta" icono={<Icono nombre="aneiich" className="size-4" />} />
        <Indicador titulo="En la selección actual" valor={filas.length} detalle={`${seleccion.length} seleccionados para acciones masivas`} icono={<Icono nombre="check" className="size-4" />} />
        <Indicador titulo="Dirigentes y delegados" valor={datos?.dirigentes?.length ?? 0} detalle="No calificados salvo solicitud (art. 5)" color="ambar" icono={<Icono nombre="alerta" className="size-4" />} />
        <Indicador
          titulo={`Puntaje promedio ${periodo?.anio ?? ''}`} valor={nf(promedio)}
          detalle={`${conPuntaje.length} asociados con calificación en el período`} color="esmeralda" icono={<Icono nombre="grafico" className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Tarjeta>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Composición por estamento</h3>
          <Torta
            altura={220}
            datos={(datos?.por_estamento ?? []).map((x) => ({ nombre: x.estamento, valor: x.n }))}
            colores={['#7c3aed', '#1f47dd', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e']}
          />
        </Tarjeta>
        <Tarjeta>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Por rol en la asociación</h3>
          <Barras
            altura={220} horizontal
            datos={(datos?.por_rol ?? []).map((x) => ({ nombre: x.rol, Asociados: x.n }))}
            categorias={[{ clave: 'Asociados', titulo: 'Asociados', color: '#7c3aed' }]}
          />
        </Tarjeta>
        <Tarjeta>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Por unidad</h3>
          <Barras
            altura={220} horizontal
            datos={(datos?.por_unidad ?? []).slice(0, 8).map((x) => ({ nombre: x.unidad?.length > 26 ? `${x.unidad.slice(0, 26)}…` : x.unidad, Asociados: x.n }))}
            categorias={[{ clave: 'Asociados', titulo: 'Asociados', color: '#1f47dd' }]}
          />
        </Tarjeta>
      </div>

      {datos?.dirigentes?.length > 0 && (
        <Aviso tipo="alerta" titulo="Situación estatutaria especial de dirigentes y delegados (art. 5)">
          <p className="mt-1 text-xs">
            Los dirigentes de la asociación y los delegados del personal no son calificados, salvo que soliciten serlo. Si integran la Junta
            Calificadora, tampoco se califican y conservan su última calificación.
          </p>
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {datos.dirigentes.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <Insignia color={d.solicita_ser_calificado ? 'esmeralda' : 'gris'}>
                  {d.solicita_ser_calificado ? 'solicitó ser calificado' : 'no calificado'}
                </Insignia>
                <Link to={`/funcionarios/${d.id}`} className="truncate font-medium text-slate-700 hover:text-marca-700">
                  {d.nombre}
                </Link>
                <span className="truncate text-slate-500">{d.rol_aneiich ?? (d.es_delegado_personal ? 'Delegado del personal' : 'Dirigente')}</span>
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      <Tarjeta>
        <div className="grid gap-3 md:grid-cols-4">
          <Campo etiqueta="Buscar asociado" className="md:col-span-2">
            <Entrada placeholder="Nombre, RUT, cargo o unidad…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </Campo>
          <Campo etiqueta="Rol">
            <Selector placeholder="Todos los roles" value={rol} onChange={(e) => setRol(e.target.value)} opciones={meta?.rolesAneiich ?? []} />
          </Campo>
          <Campo etiqueta="Estamento">
            <Selector placeholder="Todos" value={estamento} onChange={(e) => setEstamento(e.target.value)} opciones={meta?.estamentos ?? []} />
          </Campo>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Boton variante="violeta" tamano="sm" onClick={seleccionarTodos}>
            <Icono nombre="aneiich" className="size-3.5" /> {seleccion.length === filas.length && filas.length ? 'Quitar selección' : `Selección rápida (${filas.length})`}
          </Boton>
          {seleccion.length > 0 && (
            <>
              <Boton variante="suave" tamano="sm" onClick={() => setAccion('rol')}>Asignar rol</Boton>
              <Boton variante="suave" tamano="sm" onClick={() => setAccion('jefe')}>Reasignar jefatura</Boton>
              <Boton variante="suave" tamano="sm" onClick={() => aplicar({ accion: 'calificable' })}>Restablecer calificabilidad</Boton>
              <Boton variante="suave" tamano="sm" onClick={() => aplicar({ accion: 'desmarcar_aneiich' })}>Quitar marca ANEIICH</Boton>
            </>
          )}
          <span className="ml-auto text-xs text-slate-500">{seleccion.length} de {filas.length} seleccionados</span>
        </div>
      </Tarjeta>

      {cargando && !datos ? <Cargando /> : (
        <Tabla
          densa
          seleccionadas={seleccion}
          columnas={[
            { clave: 'sel', titulo: '', clase: 'w-8', render: (f) => (
              <input
                type="checkbox" checked={seleccion.includes(f.id)}
                onChange={() => setSeleccion((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : [...s, f.id]))}
                className="size-4 rounded border-slate-300 text-aneiich-600"
              />
            ) },
            { clave: 'nombre', titulo: 'Asociado', render: (f) => (
              <div className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full bg-aneiich-500" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-slate-800">
                    <Link to={`/funcionarios/${f.id}`} className="truncate hover:text-marca-700">{f.nombre_completo}</Link>
                    {f.rol_aneiich && <InsigniaAneiich rol={f.rol_aneiich} compacta />}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{f.rut} · {f.cargo ?? '—'}</p>
                </div>
              </div>
            ) },
            { clave: 'grado', titulo: 'Grado', clase: 'text-right tabular-nums' },
            { clave: 'planta', titulo: 'Estamento' },
            { clave: 'unidad_nombre', titulo: 'Unidad', render: (f) => <span className="text-[12px] text-slate-600">{f.unidad_nombre ?? '—'}</span> },
            { clave: 'fecha_afiliacion', titulo: 'Afiliación' },
            { clave: 'rol_aneiich', titulo: 'Rol' },
            { clave: 'calificacion', titulo: `Calificación ${periodo?.anio ?? ''}`, render: (f) => (f.puntaje !== null ? <InsigniaLista lista={f.lista} puntaje={f.puntaje} /> : <span className="text-[11px] text-slate-400">{f.cal_estado ?? 'sin ficha'}</span>) },
            { clave: 'acciones', titulo: '', render: (f) => (f.cal_id ? <Link to={`/calificaciones/${f.cal_id}`} className="text-xs font-medium text-marca-700 hover:underline">Hoja</Link> : null) },
          ]}
          datos={filas}
          vacio={`No hay asociados a ${asociacion} que coincidan con los filtros`}
        />
      )}

      {accion && (
        <Modal
          abierto onCerrar={() => setAccion(null)}
          titulo={accion === 'rol' ? 'Asignar rol en la asociación' : 'Reasignar jefatura'}
          descripcion={`${seleccion.length} asociados seleccionados`}
          ancho="max-w-lg"
          pie={<Boton variante="secundario" onClick={() => setAccion(null)}>Cancelar</Boton>}
        >
          <AccionSeleccion accion={accion} onAplicar={(valor) => aplicar({ accion: accion === 'rol' ? 'rol_aneiich' : 'asignar_jefe', valor })} />
        </Modal>
      )}
    </div>
  )
}

function AccionSeleccion({ accion, onAplicar }) {
  const { meta } = useSistema()
  const [valor, setValor] = useState('')
  return (
    <div className="grid gap-4">
      <Campo etiqueta={accion === 'rol' ? 'Rol en la asociación' : 'Jefe directo'} requerido>
        <Selector
          value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Seleccione…"
          opciones={accion === 'rol'
            ? (meta?.rolesAneiich ?? [])
            : (meta?.jefes ?? []).map((j) => ({ valor: j.id, etiqueta: `${j.nombres} ${j.apellido_paterno} — ${j.cargo ?? ''}` }))}
        />
      </Campo>
      {accion === 'rol' && valor === 'Dirigente Nacional' && (
        <Aviso tipo="alerta">Los dirigentes no son calificados salvo solicitud expresa (art. 5). El sistema excluirá sus fichas automáticamente, salvo que se marque la solicitud en su ficha.</Aviso>
      )}
      <Boton disabled={!valor} onClick={() => onAplicar(valor)}>Aplicar a los seleccionados</Boton>
    </div>
  )
}
