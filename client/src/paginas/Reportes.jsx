import { useState } from 'react'
import { api, descargar } from '../api'
import { useDatos, useSistema } from '../contexto'
import { Barras } from '../componentes/Graficos'
import { EncabezadoPagina } from '../componentes/Diseno'
import {
  Aviso, Boton, Cargando, Icono, Indicador, Insignia, Seccion, Tabla, Tarjeta,
} from '../componentes/ui'

const nf = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-CL') : '—')

export default function Reportes() {
  const { periodo, meta } = useSistema()
  const [aviso, setAviso] = useState(null)
  const { datos, cargando, error } = useDatos(() => api.get(`/api/dashboard?periodo=${periodo?.id ?? ''}`), [periodo?.id])
  const { datos: base } = useDatos(() => api.get('/api/resumen-base'), [])
  const { datos: auditoria } = useDatos(() => api.get('/api/auditoria'), [])

  const descargas = [
    { nombre: 'Consolidado de calificaciones', ruta: `/api/reportes/calificaciones.csv?periodo=${periodo?.id ?? ''}`, archivo: `calificaciones-${periodo?.anio}.csv`, glosa: 'Una fila por funcionario: notas, listas, jefes evaluadores, fechas, escalafón y situación final.' },
    { nombre: 'Promedios por estamento', ruta: `/api/reportes/estamentos.csv?periodo=${periodo?.id ?? ''}`, archivo: `promedios-estamentos-${periodo?.anio}.csv`, glosa: 'Puntajes promedio, mínimos, máximos y distribución por lista en cada estamento (art. 17).' },
    { nombre: 'Promedios por unidad', ruta: `/api/reportes/unidades.csv?periodo=${periodo?.id ?? ''}`, archivo: `promedios-unidades-${periodo?.anio}.csv`, glosa: 'Consolidado por dirección regional, subdirección y unidad.' },
    { nombre: 'Padrón ANEIICH', ruta: `/api/reportes/aneiich.csv?periodo=${periodo?.id ?? ''}`, archivo: 'padron-aneiich.csv', glosa: `${meta?.asociacion_detalle}. Incluye rol, afiliación y condición de calificabilidad.` },
    { nombre: 'Hoja de vida del período', ruta: `/api/reportes/hoja-vida.csv?periodo=${periodo?.id ?? ''}`, archivo: `hoja-vida-${periodo?.anio}.csv`, glosa: 'Anotaciones de mérito y demérito con notificación y resolución (arts. 8 a 11).' },
    { nombre: 'Base de funcionarios', ruta: `/api/funcionarios/export.csv`, archivo: 'funcionarios.csv', glosa: 'Dotación completa con jefaturas, unidades y condición gremial.' },
    { nombre: 'Plantilla de importación', ruta: `/api/funcionarios/plantilla.csv`, archivo: 'plantilla-funcionarios.csv', glosa: 'Formato para cargar o actualizar dotación desde una planilla.' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Reportes y exportación de datos"
        descripcion="Descargue los antecedentes del proceso calificatorio en formato CSV (compatible con Excel y con el sistema de hojas de cálculo que use el servicio)."
      />

      {aviso && <Aviso tipo={aviso.tipo} titulo={aviso.titulo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}
      {error && <Aviso tipo="error" titulo="No fue posible consolidar los datos">{error}</Aviso>}

      {base && (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Indicador titulo="Funcionarios" valor={base.funcionarios} icono={<Icono nombre="personas" className="size-4" />} />
          <Indicador titulo="Fichas" valor={base.calificaciones} color="marca" icono={<Icono nombre="documento" className="size-4" />} />
          <Indicador titulo="Votos de junta" valor={base.votos} color="violeta" icono={<Icono nombre="balanza" className="size-4" />} />
          <Indicador titulo="Anotaciones hoja de vida" valor={base.hojas_de_vida} color="ambar" icono={<Icono nombre="libro" className="size-4" />} />
          <Indicador titulo="Informes de desempeño" valor={base.informes} color="esmeralda" icono={<Icono nombre="sobre" className="size-4" />} />
          <Indicador titulo="Asociados ANEIICH" valor={base.asociados_aneiich} color="violeta" icono={<Icono nombre="aneiich" className="size-4" />} />
        </div>
      )}

      <Seccion titulo="Archivos disponibles">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {descargas.map((d) => (
            <Tarjeta key={d.nombre} className="flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{d.nombre}</h3>
                <p className="mt-1 text-xs text-slate-500">{d.glosa}</p>
              </div>
              <Boton
                variante="secundario" tamano="sm" className="mt-3 self-start"
                onClick={async () => {
                  try {
                    await descargar(d.ruta, d.archivo)
                    setAviso({ tipo: 'exito', titulo: 'Archivo generado', texto: `Se descargó ${d.archivo}.` })
                  } catch (e) { setAviso({ tipo: 'error', titulo: 'Error', texto: e.message }) }
                }}
              >
                <Icono nombre="descargar" className="size-3.5" /> Descargar
              </Boton>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {cargando && !datos ? <Cargando /> : datos && (
        <>
          <Seccion titulo={`Consolidado por estamento · período ${periodo?.anio ?? ''}`} descripcion="Puntajes promedio y distribución por lista de calificación.">
            <div className="grid gap-4 xl:grid-cols-2">
              <Tarjeta>
                <Barras
                  altura={260} horizontal
                  datos={(datos.promedios_por_estamento ?? []).map((e) => ({ nombre: e.clave, Promedio: e.promedio, 'Lista N°1': e.lista1 }))}
                  categorias={[
                    { clave: 'Promedio', titulo: 'Puntaje promedio', color: '#1f47dd' },
                    { clave: 'Lista N°1', titulo: 'En Lista N°1', color: '#10b981' },
                  ]}
                />
              </Tarjeta>
              <Tabla
                densa
                columnas={[
                  { clave: 'clave', titulo: 'Estamento' },
                  { clave: 'n', titulo: 'N', clase: 'text-right tabular-nums' },
                  { clave: 'promedio', titulo: 'Promedio', clase: 'text-right tabular-nums font-semibold', render: (f) => nf(f.promedio) },
                  { clave: 'minimo', titulo: 'Mín.', clase: 'text-right tabular-nums', render: (f) => nf(f.minimo) },
                  { clave: 'maximo', titulo: 'Máx.', clase: 'text-right tabular-nums', render: (f) => nf(f.maximo) },
                  { clave: 'lista1', titulo: 'L1', clase: 'text-right tabular-nums' },
                  { clave: 'lista2', titulo: 'L2', clase: 'text-right tabular-nums' },
                  { clave: 'lista3', titulo: 'L3', clase: 'text-right tabular-nums' },
                  { clave: 'lista4', titulo: 'L4', clase: 'text-right tabular-nums' },
                ]}
                datos={datos.promedios_por_estamento ?? []}
              />
            </div>
          </Seccion>

          <Seccion titulo="Consolidado por unidad" descripcion="Direcciones regionales, subdirecciones y unidades del servicio.">
            <Tabla
              densa
              columnas={[
                { clave: 'clave', titulo: 'Unidad' },
                { clave: 'n', titulo: 'Calificados', clase: 'text-right tabular-nums' },
                { clave: 'promedio', titulo: 'Promedio', clase: 'text-right tabular-nums font-semibold', render: (f) => nf(f.promedio) },
                { clave: 'lista1', titulo: 'Lista N°1', clase: 'text-right tabular-nums' },
                { clave: 'lista2', titulo: 'Lista N°2', clase: 'text-right tabular-nums' },
                { clave: 'lista3', titulo: 'Lista N°3', clase: 'text-right tabular-nums' },
                { clave: 'lista4', titulo: 'Lista N°4', clase: 'text-right tabular-nums' },
                { clave: 'promedio_aneiich', titulo: 'Prom. ANEIICH', clase: 'text-right tabular-nums text-aneiich-700', render: (f) => nf(f.promedio_aneiich) },
              ]}
              datos={datos.promedios_por_unidad ?? []}
            />
          </Seccion>

          <Seccion titulo="Histórico por año" descripcion="Comparación de los períodos calificatorios registrados en el sistema.">
            <Tabla
              densa
              columnas={[
                { clave: 'anio', titulo: 'Período' },
                { clave: 'n', titulo: 'Calificados', clase: 'text-right tabular-nums' },
                { clave: 'promedio', titulo: 'Promedio', clase: 'text-right tabular-nums font-semibold', render: (f) => nf(f.promedio) },
                { clave: 'promedio_aneiich', titulo: 'Prom. ANEIICH', clase: 'text-right tabular-nums text-aneiich-700', render: (f) => nf(f.promedio_aneiich) },
                { clave: 'promedio_no_aneiich', titulo: 'Prom. no asociados', clase: 'text-right tabular-nums', render: (f) => nf(f.promedio_no_aneiich) },
                { clave: 'lista1', titulo: 'Lista N°1', clase: 'text-right tabular-nums' },
                { clave: 'lista2', titulo: 'Lista N°2', clase: 'text-right tabular-nums' },
                { clave: 'lista3', titulo: 'Lista N°3', clase: 'text-right tabular-nums' },
                { clave: 'lista4', titulo: 'Lista N°4', clase: 'text-right tabular-nums' },
              ]}
              datos={datos.promedios_por_anio ?? []}
            />
          </Seccion>
        </>
      )}

      <Seccion titulo="Bitácora del sistema" descripcion="Registro de las actuaciones relevantes: generación de fichas, precalificaciones, acuerdos, apelaciones y mantención de datos.">
        <Tabla
          densa
          columnas={[
            { clave: 'fecha', titulo: 'Fecha y hora', render: (a) => <span className="text-[11px] text-slate-500">{fechaHora(a.fecha)}</span> },
            { clave: 'accion', titulo: 'Actuación', render: (a) => <span className="font-medium text-slate-700">{a.accion}</span> },
            { clave: 'entidad', titulo: 'Entidad', render: (a) => <Insignia color="gris">{a.entidad}{a.entidad_id ? ` #${a.entidad_id}` : ''}</Insignia> },
            { clave: 'detalle', titulo: 'Detalle', render: (a) => <span className="text-[12px] text-slate-600">{a.detalle}</span> },
          ]}
          datos={auditoria ?? []}
          vacio="Sin actuaciones registradas"
        />
      </Seccion>
    </div>
  )
}
