import { Router } from 'express'
import { all, get, insertar, actualizar, eliminar, run, auditar, transaccion } from '../db.js'
import { env, aBool, periodoVigente } from './meta.js'
import { SUBFACTORES } from '../dominio.js'

const r = Router()

const ROLES_JUNTA = ['Presidente', 'Integrante', 'Secretario', 'Representante del personal', 'Suplente', 'Delegado ANEIICH']

/* ── Constitución de la Junta Calificadora (arts. 22 a 26) ──────────────── */
r.get('/juntas', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const juntas = all(`SELECT j.*, p.anio, u.nombre AS unidad_nombre,
      (SELECT (f.nombres || ' ' || f.apellido_paterno) FROM funcionarios f WHERE f.id = j.presidente_funcionario_id) AS presidente_nombre,
      (SELECT (f.nombres || ' ' || f.apellido_paterno) FROM funcionarios f WHERE f.id = j.secretario_funcionario_id) AS secretario_nombre,
      (SELECT COUNT(*) FROM calificaciones c WHERE c.junta_id = j.id) AS calificaciones_asignadas,
      (SELECT COUNT(*) FROM actas a WHERE a.junta_id = j.id) AS actas
    FROM juntas j JOIN periodos p ON p.id = j.periodo_id
    LEFT JOIN unidades u ON u.id = j.unidad_id
    ${periodo ? 'WHERE j.periodo_id = ?' : ''}
    ORDER BY p.anio DESC, j.tipo, j.region`, periodo ? [periodo.id] : [])
  const conIntegrantes = juntas.map((j) => {
    const integrantes = all('SELECT * FROM junta_integrantes WHERE junta_id = ? ORDER BY orden, id', [j.id])
    const asignadas = all('SELECT c.id, c.funcionario_id, c.estado, c.puntaje FROM calificaciones c WHERE c.junta_id = ?', [j.id])
    const conVotos = asignadas.filter((c) => get('SELECT COUNT(*) AS n FROM votos_subfactor WHERE calificacion_id = ?', [c.id]).n > 0)
    const esperados = asignadas.length * SUBFACTORES.length * integrantes.filter((i) => i.derecho_a_voto).length
    const registrados = asignadas.length
      ? get(`SELECT COUNT(*) AS n FROM votos_subfactor WHERE calificacion_id IN (${asignadas.map(() => '?').join(',') || 'NULL'})`, asignadas.map((c) => c.id)).n
      : 0
    return {
      ...j,
      integrantes,
      avance: {
        calificaciones: asignadas.length,
        con_votacion_iniciada: conVotos.length,
        votos_registrados: registrados,
        votos_esperados: esperados,
        porcentaje: esperados ? Math.round((registrados / esperados) * 100) : 0,
      },
    }
  })
  res.json({ periodo, roles: ROLES_JUNTA, datos: conIntegrantes })
}))

r.get('/juntas/sugerir', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const jefeSuperior = get('SELECT id FROM funcionarios WHERE es_jefe_superior = 1 LIMIT 1')
  const candidatos = all(`SELECT id, rut, nombres, apellido_paterno, apellido_materno, cargo, grado, planta,
      asociado_aneiich, rol_aneiich, es_dirigente_asociacion, es_delegado_personal
    FROM funcionarios
    WHERE (es_jefe_superior IS NULL OR es_jefe_superior = 0) AND COALESCE(id, 0) <> COALESCE(?, 0) AND estado = 'Vigente'
    ORDER BY grado ASC, fecha_ingreso_grado ASC
    LIMIT 12`, [jefeSuperior?.id ?? null])
  res.json({
    periodo,
    glosa: 'Art. 22: la Junta Calificadora Central se integra con los cinco funcionarios de más alto nivel jerárquico, excluido el Jefe Superior, y por un representante del personal. El nivel jerárquico se determina por el grado o nivel remuneratorio.',
    glosa_delegado: 'Art. 24: la asociación de funcionarios con mayor representación (ANEIICH) tiene derecho a designar un delegado que sólo tendrá derecho a voz ante la Junta Central y las Juntas Regionales.',
    candidatos: candidatos.map((c) => ({ ...c, nombre_completo: `${c.nombres} ${c.apellido_paterno} ${c.apellido_materno ?? ''}`.trim() })),
  })
}))

r.post('/juntas', env((req, res) => {
  const b = req.body ?? {}
  const periodo = b.periodo_id ? get('SELECT * FROM periodos WHERE id = ?', [b.periodo_id]) : periodoVigente()
  if (!periodo) throw new Error('Debe indicar el período de calificación.')
  const junta = insertar('juntas', {
    periodo_id: periodo.id,
    tipo: b.tipo || 'Central',
    region: b.region ?? (b.tipo === 'Central' ? 'Metropolitana de Santiago' : null),
    unidad_id: b.unidad_id ?? null,
    fecha_constitucion: b.fecha_constitucion || periodo.fecha_constitucion_junta || `${periodo.anio}-09-21`,
    presidente_funcionario_id: b.presidente_funcionario_id ?? null,
    secretario_funcionario_id: b.secretario_funcionario_id ?? null,
    estado: 'Constituida',
    observaciones: b.observaciones ?? 'Constituida conforme a los arts. 22, 26 y 28 del DTO 1825/1998.',
    creado_en: new Date().toISOString(),
  })
  if (b.integrantes?.length) {
    for (const [i, m] of b.integrantes.entries()) agregarIntegrante(junta.id, m, i + 1)
  }
  auditar('Constituye junta calificadora', 'juntas', junta.id, `${junta.tipo} — período ${periodo.anio}`)
  res.json(get('SELECT * FROM juntas WHERE id = ?', [junta.id]))
}))

function agregarIntegrante(juntaId, m, orden) {
  const f = m.funcionario_id ? get('SELECT * FROM funcionarios WHERE id = ?', [m.funcionario_id]) : null
  return insertar('junta_integrantes', {
    junta_id: juntaId,
    funcionario_id: f?.id ?? null,
    nombre: f ? `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno ?? ''}`.trim() : (m.nombre || 'Integrante externo'),
    cargo: f?.cargo ?? m.cargo ?? null,
    rol: ROLES_JUNTA.includes(m.rol) ? m.rol : 'Integrante',
    derecho_a_voto: m.rol === 'Delegado ANEIICH' ? 0 : (m.derecho_a_voto === undefined ? 1 : aBool(m.derecho_a_voto)),
    orden: m.orden ?? orden ?? 0,
  })
}

r.put('/juntas/:id', env((req, res) => {
  const campos = ['tipo', 'region', 'unidad_id', 'fecha_constitucion', 'presidente_funcionario_id', 'secretario_funcionario_id', 'estado', 'observaciones']
  const datos = {}
  for (const c of campos) if (req.body?.[c] !== undefined) datos[c] = req.body[c]
  const j = actualizar('juntas', req.params.id, datos)
  auditar('Actualiza junta calificadora', 'juntas', j.id, Object.keys(datos).join(', '))
  res.json(j)
}))

r.delete('/juntas/:id', env((req, res) => {
  run('UPDATE calificaciones SET junta_id = NULL WHERE junta_id = ?', [req.params.id])
  eliminar('juntas', req.params.id)
  res.json({ ok: true })
}))

r.post('/juntas/:id/integrantes', env((req, res) => {
  const orden = (get('SELECT MAX(orden) AS m FROM junta_integrantes WHERE junta_id = ?', [req.params.id])?.m ?? 0) + 1
  const m = agregarIntegrante(req.params.id, req.body ?? {}, orden)
  auditar('Agrega integrante a la junta', 'junta_integrantes', m.id, `${m.nombre} — ${m.rol}`)
  res.json(m)
}))

r.put('/junta-integrantes/:id', env((req, res) => {
  const campos = ['rol', 'derecho_a_voto', 'orden', 'nombre', 'cargo', 'funcionario_id']
  const datos = {}
  for (const c of campos) if (req.body?.[c] !== undefined) datos[c] = c === 'derecho_a_voto' ? aBool(req.body[c]) : req.body[c]
  res.json(actualizar('junta_integrantes', req.params.id, datos))
}))

r.delete('/junta-integrantes/:id', env((req, res) => {
  eliminar('junta_integrantes', req.params.id)
  res.json({ ok: true })
}))

/* ── Asignación de calificaciones a la junta y tablero de votación ──────── */
r.post('/juntas/:id/asignar', env((req, res) => {
  const junta = get('SELECT * FROM juntas WHERE id = ?', [req.params.id])
  if (!junta) throw new Error('Junta no encontrada')
  const b = req.body ?? {}
  const where = ['c.periodo_id = ?']
  const params = [junta.periodo_id]
  if (b.ids?.length) { where.push(`c.id IN (${b.ids.map(() => '?').join(',')})`); params.push(...b.ids.map(Number)) }
  if (b.region) { where.push('u.region = ?'); params.push(b.region) }
  if (b.unidad_id) { where.push('f.unidad_id = ?'); params.push(b.unidad_id) }
  if (b.solo_sin_junta !== false) where.push('(c.junta_id IS NULL OR c.junta_id = ' + Number(junta.id) + ')')
  const n = run(`UPDATE calificaciones SET junta_id = ? WHERE id IN (
      SELECT c.id FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id
      LEFT JOIN unidades u ON u.id = f.unidad_id WHERE ${where.join(' AND ')})`, [junta.id, ...params]).changes
  auditar('Asigna calificaciones a la junta', 'juntas', junta.id, `${n} fichas asignadas`)
  res.json({ ok: true, asignadas: n })
}))

r.get('/juntas/:id/tablero', env((req, res) => {
  const junta = get('SELECT * FROM juntas WHERE id = ?', [req.params.id])
  if (!junta) throw new Error('Junta no encontrada')
  const integrantes = all('SELECT * FROM junta_integrantes WHERE junta_id = ? ORDER BY orden', [junta.id])
  const fichas = all(`SELECT c.id, c.estado, c.puntaje, c.lista, c.planta_aplicada, f.rut, f.grado,
      (f.nombres || ' ' || f.apellido_paterno || ' ' || COALESCE(f.apellido_materno,'')) AS funcionario_nombre,
      f.planta, f.asociado_aneiich, u.nombre AS unidad_nombre
    FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    WHERE c.junta_id = ? ORDER BY f.apellido_paterno`, [junta.id])
  const conVotos = new Set(all(`SELECT DISTINCT calificacion_id FROM votos_subfactor
    WHERE calificacion_id IN (${fichas.map(() => '?').join(',') || 'NULL'})`, fichas.map((f) => f.id)).map((x) => x.calificacion_id))
  const votosPorSubfactor = all(`SELECT v.calificacion_id, v.subfactor_clave, COUNT(*) AS n
    FROM votos_subfactor v WHERE v.calificacion_id IN (${fichas.map(() => '?').join(',') || 'NULL'})
    GROUP BY 1,2`, fichas.map((f) => f.id))
  const votantes = integrantes.filter((i) => i.derecho_a_voto)
  res.json({
    junta: { ...junta, integrantes },
    integrantes,
    votantes_con_derecho_a_voto: votantes.length,
    datos: fichas.map((f) => {
      const votos = votosPorSubfactor.filter((v) => v.calificacion_id === f.id)
      return {
        ...f,
        aneiich: Boolean(f.asociado_aneiich),
        votos_registrados: votos.reduce((a, b) => a + b.n, 0),
        votos_esperados: SUBFACTORES.length * votantes.length,
        subfactores_con_votos: votos.length,
        completo: votos.length === SUBFACTORES.length && conVotos.has(f.id),
      }
    }),
    subfactores: SUBFACTORES,
  })
}))

/* ── Libro de actas (arts. 25 y 29) ─────────────────────────────────────── */
r.get('/actas', env((req, res) => {
  const where = []
  const params = []
  if (req.query.junta) { where.push('a.junta_id = ?'); params.push(req.query.junta) }
  if (req.query.periodo) { where.push('a.periodo_id = ?'); params.push(req.query.periodo) }
  res.json(all(`SELECT a.*, p.anio, j.tipo AS junta_tipo, j.region
    FROM actas a LEFT JOIN periodos p ON p.id = a.periodo_id
    LEFT JOIN juntas j ON j.id = a.junta_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY a.fecha DESC`, params))
}))

r.post('/actas', env((req, res) => {
  const b = req.body ?? {}
  const junta = b.junta_id ? get('SELECT * FROM juntas WHERE id = ?', [b.junta_id]) : null
  const acta = insertar('actas', {
    junta_id: junta?.id ?? null,
    periodo_id: b.periodo_id ?? junta?.periodo_id ?? null,
    numero: b.numero || `${new Date().getFullYear()}-${String(get('SELECT COUNT(*) AS n FROM actas').n + 1).padStart(2, '0')}`,
    fecha: b.fecha || new Date().toISOString().slice(0, 10),
    tipo: b.tipo || 'Calificación',
    asistentes: b.asistentes, acuerdos: b.acuerdos, contenido: b.contenido,
    aprobada: aBool(b.aprobada), fecha_aprobacion: b.fecha_aprobacion,
    creado_en: new Date().toISOString(),
  })
  auditar('Levanta acta', 'actas', acta.id, `Acta ${acta.numero} — ${acta.tipo}`)
  res.json(acta)
}))

r.put('/actas/:id', env((req, res) => {
  const campos = ['numero', 'fecha', 'tipo', 'asistentes', 'acuerdos', 'contenido', 'aprobada', 'fecha_aprobacion']
  const datos = {}
  for (const c of campos) if (req.body?.[c] !== undefined) datos[c] = c === 'aprobada' ? aBool(req.body[c]) : req.body[c]
  res.json(actualizar('actas', req.params.id, datos))
}))

r.delete('/actas/:id', env((req, res) => {
  eliminar('actas', req.params.id)
  res.json({ ok: true })
}))

export default r
