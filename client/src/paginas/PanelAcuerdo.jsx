import { useState } from 'react'
import { api } from '../api'
import {
  AreaTexto, Aviso, Boton, Campo, Entrada, Insignia, InsigniaLista, Modal, Nota, Tarjeta, Icono,
} from '../componentes/ui'
import { useSistema } from '../contexto'

const nf = (v, d = 2) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }))

/**
 * Cierre del acuerdo de la junta (arts. 29, 30 y 37): consigna la fecha de la sesión,
 * el acta, la fundamentación del acuerdo y fija el puntaje definitivo con su lista.
 */
export function PanelAcuerdo({ datos, onCambio, setAviso }) {
  const { meta } = useSistema()
  const { calificacion: cal, subfactores, factores, calculo, periodo, junta, integrantes } = datos
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const [advertencias, setAdvertencias] = useState([])
  const [form, setForm] = useState({})

  const votantes = (integrantes ?? []).filter((i) => i.derecho_a_voto)
  const votosEsperados = votantes.length * subfactores.length
  const votosEmitidos = subfactores.reduce((a, s) => a + (s.votos ?? []).filter((v) => v.derecho_a_voto).length, 0)
  const sinVotos = subfactores.filter((s) => (s.votos ?? []).filter((v) => v.derecho_a_voto).length === 0)
  const notas = Object.fromEntries(subfactores.map((s) => [s.clave, s.agregado?.nota ?? s.nota_junta ?? s.precalificacion ?? null]))

  const abrir = () => {
    setError(null)
    setAdvertencias([])
    setForm({
      fecha: cal.cal_fecha_sesion || periodo?.fecha_constitucion_junta || '',
      acta: cal.acta_numero || '',
      observaciones: cal.cal_observaciones || '',
      acuerdo: cal.cal_json?.acuerdo || 'La Junta Calificadora, reunida conforme al art. 28, adopta su acuerdo por mayoría de votos, con los fundamentos que constan en el acta respectiva (arts. 29 y 30).',
      argumentos: Object.fromEntries(factores.map((f) => [f.clave, f.argumento_junta || f.argumento_precalificacion || ''])),
    })
    setAbierto(true)
  }

  const consignar = async () => {
    setOcupado(true)
    setError(null)
    try {
      const r = await api.put(`/api/calificaciones/${cal.id}/acuerdo`, {
        notas,
        argumentos: form.argumentos,
        acuerdo: form.acuerdo,
        acta_numero: form.acta,
        cal_fecha_sesion: form.fecha,
        cal_observaciones: form.observaciones,
        cerrar: true,
        estado: 'Calificado',
        junta_id: junta?.id,
      })
      setAdvertencias(r.advertencias ?? [])
      const sinVoto = subfactores.filter((s2) => s2.agregado?.nota === null).length
      setAviso({
        tipo: 'exito',
        titulo: 'Acuerdo consignado',
        texto: `Puntaje definitivo ${nf(r.calculo.puntaje)} — Lista N°${r.calculo.lista} de ${meta?.listas?.find((l) => l.numero === r.calculo.lista)?.nombre ?? ''} (art. 15).`
          + (sinVoto ? ` ${sinVoto} subfactor(es) quedaron con la precalificación del jefe directo al no registrarse votación (art. 27).` : ''),
      })
      if (!(r.advertencias ?? []).length) setAbierto(false)
      onCambio()
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Tarjeta padding={false} className="border-marca-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-marca-50/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">Acuerdo de la Junta Calificadora</h3>
          <p className="text-xs text-slate-600">
            {votosEmitidos} de {votosEsperados} votos registrados · puntaje proyectado <strong className="tabular-nums">{nf(calculo?.puntaje)}</strong> · Lista <strong>N°{calculo?.lista}</strong>
            {cal.puntaje !== null && <> · puntaje consignado <strong className="tabular-nums">{nf(cal.puntaje)}</strong></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cal.lista && <InsigniaLista lista={cal.lista} />}
          <Boton variante={cal.lista ? 'secundario' : 'primario'} tamano="sm" onClick={abrir}>
            <Icono nombre="check" className="size-3.5" />
            {cal.lista ? 'Revisar acuerdo' : 'Consignar acuerdo'}
          </Boton>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-[13px] leading-relaxed text-slate-700">
          {cal.cal_json?.acuerdo || 'El acuerdo de la junta debe ser fundado y se anota en el acta de calificaciones (art. 29).'}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Dato etiqueta="Sesión" valor={cal.cal_fecha_sesion || '—'} />
          <Dato etiqueta="Acta" valor={cal.acta_numero || '—'} />
          <Dato etiqueta="Estado de la ficha" valor={cal.estado} />
        </div>
      </div>

      {sinVotos.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <Aviso tipo="alerta" titulo="Subfactores sin votación registrada">
            {sinVotos.map((s) => s.nombre).join(', ')}. Mientras no haya votos se consigna la nota de la precalificación
            del jefe directo (art. 27); puede registrar la votación en la lista superior.
          </Aviso>
        </div>
      )}

      <Modal
        abierto={abierto}
        titulo="Consignar acuerdo de la Junta Calificadora"
        descripcion={`${datos.funcionario_nombre} · ${periodo?.anio} · ${junta?.tipo ?? ''} Junta Calificadora`}
        onCerrar={() => setAbierto(false)}
        ancho="max-w-3xl"
        pie={<>
          <Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton>
          <Boton cargando={ocupado} onClick={consignar}>Consignar acuerdo y fijar puntaje</Boton>
        </>}
      >
        <div className="grid gap-4">
          <Aviso tipo="norma">
            Los acuerdos se adoptan por mayoría de votos y, en caso de empate, decide el voto del presidente (art. 30).
            El acuerdo debe ser siempre fundado (art. 29) y una vez notificado el funcionario dispone de cinco días para apelar (art. 32).
          </Aviso>

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Fecha de la sesión">
              <Entrada type="date" value={form.fecha ?? ''} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </Campo>
            <Campo etiqueta="N° de acta">
              <Entrada value={form.acta ?? ''} onChange={(e) => setForm({ ...form, acta: e.target.value })} placeholder="ACTA 04/2026" />
            </Campo>
            <Campo etiqueta="Estado al cerrar">
              <Entrada value="Calificado (art. 31)" readOnly className="bg-slate-50 text-slate-500" />
            </Campo>
          </div>

          <Campo etiqueta="Fundamentación del acuerdo" ayuda="Se anota en el acta de calificaciones (art. 29).">
            <AreaTexto filas={3} value={form.acuerdo ?? ''} onChange={(e) => setForm({ ...form, acuerdo: e.target.value })} />
          </Campo>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Subfactor</th>
                  <th className="px-3 py-2 text-center font-semibold">Precalificación</th>
                  <th className="px-3 py-2 text-center font-semibold">Votación</th>
                  <th className="px-3 py-2 text-center font-semibold">Nota acordada</th>
                  <th className="px-3 py-2 text-left font-semibold">Criterio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subfactores.map((s) => (
                  <tr key={s.clave}>
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-800">{s.letra} {s.nombre}</span>
                      <span className="block text-[11px] text-slate-500">{s.factorNombre}</span>
                    </td>
                    <td className="px-3 py-2 text-center"><Nota valor={s.precalificacion} tamano="sm" tenue /></td>
                    <td className="px-3 py-2 text-center"><Nota valor={s.agregado?.nota} tamano="sm" /></td>
                    <td className="px-3 py-2 text-center"><Nota valor={s.nota_junta} tamano="sm" /></td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">{s.agregado?.criterio ?? 'Precalificación (art. 27)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {factores.map((f) => (
            <Campo key={f.clave} etiqueta={`Argumento del factor ${f.numero}. ${f.nombre}`}>
              <AreaTexto
                filas={2}
                value={form.argumentos?.[f.clave] ?? ''}
                onChange={(e) => setForm({ ...form, argumentos: { ...form.argumentos, [f.clave]: e.target.value } })}
              />
            </Campo>
          ))}

          <Campo etiqueta="Observaciones de la ficha" ayuda="Quedan registradas junto al acuerdo y en la auditoría del sistema.">
            <Entrada value={form.observaciones ?? ''} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Votación unánime; se consideran los informes de desempeño del período." />
          </Campo>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puntaje y lista resultantes</span>
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{nf(calculo?.puntaje)}</span>
              <InsigniaLista lista={calculo?.lista} />
              <span className="text-[12px] text-slate-600">
                {(factores ?? []).map((f) => `${f.nombre}: ${nf(f.nota)} × ${f.coeficiente} = ${nf(f.puntos)}`).join(' · ')}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Lista N°1 de Distinción 81,00 a 100 · Lista N°2 Buena 46,00 a 80,99 · Lista N°3 Condicional 30,00 a 45,99 · Lista N°4 de Eliminación 10,00 a 29,99 (art. 15).
            </p>
          </div>

          {advertencias.length > 0 && (
            <Aviso tipo="alerta" titulo="Notas ajustadas a la votación de la junta">
              <ul className="list-disc pl-4">{advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </Aviso>
          )}
          {error && <Aviso tipo="error" titulo="No se pudo consignar el acuerdo">{error}</Aviso>}
        </div>
      </Modal>
    </Tarjeta>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <span className="block truncate text-[13px] text-slate-800">{valor ?? '—'}</span>
    </div>
  )
}
