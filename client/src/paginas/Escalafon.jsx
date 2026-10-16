import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, descargar } from '../api'
import { useDatos, useSistema } from '../contexto'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, BarraProgreso, Boton, Cargando, Icono, Indicador, Insignia, InsigniaAneiich, InsigniaLista,
  Seccion, Selector, Tabla, Tarjeta, Vacio,
} from '../componentes/ui'

const nf = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const fechaCorta = (f) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-CL') : '—')

export default function Escalafon() {
  const { periodo, meta, recargar: recargarMeta } = useSistema()
  const [parametros, setParametros] = useSearchParams()
  const [grado, setGrado] = useState(parametros.get('grado') ?? '')
  const [aviso, setAviso] = useState(null)

  const { datos, cargando, error, recargar } = useDatos(() => api.get(`/api/escalafon?periodo=${periodo?.id ?? ''}`), [periodo?.id])

  const grados = Object.keys(datos?.grados ?? {}).sort((a, b) => Number(a) - Number(b))
  const visibles = grado ? [grado] : grados

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo={`Escalafón de mérito · período ${periodo?.anio ?? ''}`}
        descripcion="Confeccionado con el resultado de las calificaciones ejecutoriadas: los funcionarios de cada grado de la planta se disponen en orden decreciente conforme al puntaje obtenido; los empates se resuelven por antigüedad (art. 38)."
        acciones={<>
          <Boton variante="secundario" onClick={() => descargar(`/api/reportes/calificaciones.csv?periodo=${periodo?.id ?? ''}`, `escalafon-${periodo?.anio}.csv`)}>
            <Icono nombre="descargar" className="size-4" /> Exportar
          </Boton>
          <Boton
            variante="secundario"
            onClick={async () => {
              try {
                const r = await api.post('/api/escalafon/notificar', { periodo_id: periodo?.id })
                setAviso({ tipo: 'exito', titulo: 'Notificación registrada', texto: `${r.notificadas} funcionarios quedaron con constancia de notificación del escalafón (art. 39).` })
                recargar()
              } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
            }}
          >Registrar notificación del escalafón</Boton>
          <Boton
            onClick={async () => {
              try {
                const r = await api.post('/api/escalafon/generar', { periodo_id: periodo?.id })
                setAviso({ tipo: 'exito', titulo: 'Escalafón confeccionado', texto: `${r.total} funcionarios ubicados por grado según su puntaje.` })
                recargar()
                recargarMeta()
              } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
            }}
          >Confeccionar escalafón</Boton>
        </>}
      />

      {aviso && <Aviso tipo={aviso.tipo} titulo={aviso.titulo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}
      {error && <Aviso tipo="error" titulo="No fue posible cargar el escalafón">{error}</Aviso>}

      {cargando && !datos ? <Cargando /> : !datos?.total ? (
        <Vacio
          titulo="Aún no hay calificaciones con puntaje en este período"
          descripcion="El escalafón se confecciona una vez ejecutoriadas las calificaciones, y empieza a regir el 1 de enero del año siguiente (art. 39)."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador titulo="Funcionarios en el escalafón" valor={datos.total} detalle={`${grados.length} grados con funcionarios calificados`} icono={<Icono nombre="grafico" className="size-4" />} />
            <Indicador titulo="Primer lugar general" valor={nf(Math.max(...datos.filas.map((f) => f.puntaje)))} detalle="Puntaje más alto del período" color="esmeralda" icono={<Icono nombre="estrella" className="size-4" />} />
            <Indicador titulo="Ingresos al final del escalafón" valor={datos.filas.length ? 'Art. 38' : '—'} detalle="Quien asciende pasa a ocupar el último lugar del nuevo grado" color="ambar" icono={<Icono nombre="alerta" className="size-4" />} />
            <Indicador titulo="Asociados ANEIICH ubicados" valor={datos.filas.filter((f) => f.asociado_aneiich).length} detalle={`${((datos.filas.filter((f) => f.asociado_aneiich).length / datos.total) * 100).toFixed(1)}% del escalafón`} color="violeta" icono={<Icono nombre="aneiich" className="size-4" />} />
          </div>

          <Tarjeta>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Filtrar por grado</span>
                <Selector className="!w-64" value={grado} onChange={(e) => { setGrado(e.target.value); setParametros(e.target.value ? { grado: e.target.value } : {}) }}>
                  <option value="">Todos los grados</option>
                  {grados.map((g) => <option key={g} value={g}>Grado {g} ({datos.grados[g].length} funcionarios)</option>)}
                </Selector>
              </label>
              <p className="pb-2 text-xs text-slate-500">
                El escalafón es público para los funcionarios de la institución (art. 39) y debe remitirse a la Contraloría General de la República dentro de los quince días siguientes de expirado el proceso (art. 41).
              </p>
            </div>
          </Tarjeta>

          {visibles.map((g) => (
            <Seccion key={g} titulo={`Grado ${g}`} descripcion={`${datos.grados[g].length} funcionarios ordenados por puntaje decreciente`}>
              <Tabla
                densa
                columnas={[
                  { clave: 'lugar', titulo: 'Lugar', clase: 'w-16', render: (f) => <span className="font-semibold tabular-nums text-slate-700">{f.lugar}°</span> },
                  { clave: 'funcionario', titulo: 'Funcionario', render: (f) => (
                    <div className="flex items-center gap-2">
                      <span className={`size-1.5 rounded-full ${f.asociado_aneiich ? 'bg-aneiich-500' : 'bg-transparent'}`} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-800">
                          <Link to={`/calificaciones/${f.calificacion_id}`} className="truncate hover:text-marca-700">
                            {f.nombres} {f.apellido_paterno} {f.apellido_materno ?? ''}
                          </Link>
                          {f.asociado_aneiich && <InsigniaAneiich compacta rol={f.rol_aneiich} />}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{f.rut} · {f.cargo ?? '—'} · {f.unidad_nombre ?? ''}</p>
                      </div>
                    </div>
                  ) },
                  { clave: 'puntaje', titulo: 'Puntaje', clase: 'text-right', render: (f) => <span className="font-semibold tabular-nums text-slate-900">{nf(f.puntaje)}</span> },
                  { clave: 'lista', titulo: 'Lista', render: (f) => <InsigniaLista lista={f.lista} /> },
                  { clave: 'barra', titulo: '', clase: 'w-40', render: (f) => <BarraProgreso valor={f.puntaje} total={100} color={f.lista === 1 ? 'esmeralda' : f.lista === 3 ? 'ambar' : f.lista === 4 ? 'rojo' : 'marca'} altura="h-1.5" /> },
                  { clave: 'antiguedad', titulo: 'Promoción al grado', render: (f) => <span className="text-[11px] text-slate-500">{fechaCorta(f.fecha_ingreso_grado)}</span> },
                  { clave: 'ingreso', titulo: 'Ingreso al servicio', render: (f) => <span className="text-[11px] text-slate-500">{fechaCorta(f.fecha_ingreso_servicio)}</span> },
                  { clave: 'estado', titulo: 'Etapa', render: (f) => <Insignia color={f.estado === 'Ejecutoriado' ? 'esmeralda' : 'gris'}>{f.estado}</Insignia> },
                ]}
                datos={datos.grados[g]}
                vacio="Sin funcionarios en este grado"
              />
            </Seccion>
          ))}
        </>
      )}
    </div>
  )
}
