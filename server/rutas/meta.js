import { Router } from 'express'
import {
  all, get, insertar, actualizar, eliminar, config, auditar, transaccion,
} from '../db.js'
import {
  FACTORES, SUBFACTORES, COEFICIENTES, CONCEPTOS, LISTAS, CAUSALES_NO_CALIFICABLE,
  ESTADOS_CALIFICACION, CATEGORIAS_MERITO, CATEGORIAS_DEMERITO, ESTAMENTOS, plazosPeriodo,
} from '../dominio.js'

const r = Router()

export const CALIDADES = ['Planta', 'Contrata', 'Honorarios (no afecto al Estatuto)']
export const ESTADOS_FUNCIONARIO = ['Vigente', 'En comisión de servicio', 'Con licencia médica prolongada', 'Suspendido', 'Jubilado', 'Finiquitado']
export const ROLES_ANEIICH = ['Socio', 'Dirigente Regional', 'Dirigente Nacional', 'Delegado ante la Junta']
export const JORNADAS = ['44 horas semanales', '28 horas semanales', 'Jornada completa', 'Jornada parcial']

/** Envuelve un handler para responder 400/500 con mensaje legible. */
export const env = (fn) => (req, res, next) => {
  try {
    fn(req, res, next)
  } catch (e) {
    console.error('[api]', req.method, req.originalUrl, e)
    res.status(400).json({ error: e?.message || 'Error al procesar la solicitud' })
  }
}

export const aBool = (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'si' || v === 'sí' ? 1 : 0)

/* ── Catálogos y constantes normativas ───────────────────────────────────── */
r.get('/meta', env((req, res) => {
  res.json({
    institucion: config.leer('institucion'),
    sigla: config.leer('sigla_institucion'),
    asociacion: config.leer('asociacion_nombre'),
    asociacion_detalle: config.leer('asociacion_detalle'),
    unidad_personal: config.leer('unidad_personal'),
    normas: 'DTO 1825 de 1998, Ministerio del Interior — Reglamento de Calificaciones del personal afecto al Estatuto Administrativo (ley N°18.834).',
    factores: FACTORES,
    subfactores: SUBFACTORES,
    coeficientes: COEFICIENTES,
    estamentos: ESTAMENTOS,
    conceptos: CONCEPTOS,
    listas: Object.values(LISTAS),
    causales: CAUSALES_NO_CALIFICABLE,
    estadosCalificacion: ESTADOS_CALIFICACION,
    categoriasMerito: CATEGORIAS_MERITO,
    categoriasDemerito: CATEGORIAS_DEMERITO,
    calidades: CALIDADES,
    estadosFuncionario: ESTADOS_FUNCIONARIO,
    rolesAneiich: ROLES_ANEIICH,
    jornadas: JORNADAS,
    periodos: all('SELECT * FROM periodos ORDER BY anio DESC'),
    unidades: all('SELECT * FROM unidades WHERE activo = 1 ORDER BY tipo, nombre'),
    periodoVigente: periodoVigente(),
    hoy: new Date().toISOString().slice(0, 10),
  })
}))

export function periodoVigente() {
  const id = config.leer('periodo_actual')
  return get('SELECT * FROM periodos WHERE id = ?', [id]) ?? get('SELECT * FROM periodos ORDER BY anio DESC LIMIT 1')
}

/* ── Configuración institucional ─────────────────────────────────────────── */
r.get('/config', env((req, res) => {
  res.json({ ...config.todas(), clave_acceso: undefined })
}))

r.put('/config', env((req, res) => {
  const permitidas = ['institucion', 'sigla_institucion', 'asociacion_nombre', 'asociacion_detalle', 'unidad_personal', 'jefe_superior_nombre', 'clave_acceso']
  for (const [k, v] of Object.entries(req.body ?? {})) {
    if (permitidas.includes(k) && v !== undefined && v !== null && String(v).trim() !== '') config.escribir(k, String(v))
  }
  auditar('Actualiza configuración', 'config', null, Object.keys(req.body ?? {}).join(', '))
  res.json({ ok: true })
}))

/* ── Períodos de calificación (art. 3) ───────────────────────────────────── */
r.get('/periodos', env((req, res) => {
  const periodos = all('SELECT * FROM periodos ORDER BY anio DESC')
  res.json(periodos.map((p) => ({
    ...p,
    estadisticas: get(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN puntaje IS NOT NULL THEN 1 ELSE 0 END) AS con_puntaje,
        SUM(CASE WHEN estado = 'Ejecutoriado' THEN 1 ELSE 0 END) AS ejecutoriadas
      FROM calificaciones WHERE periodo_id = ?`, [p.id]),
    junta: get('SELECT * FROM juntas WHERE periodo_id = ? ORDER BY id LIMIT 1', [p.id]),
    rango_listas: all(`SELECT lista, COUNT(*) AS n FROM calificaciones WHERE periodo_id = ? AND lista IS NOT NULL GROUP BY lista ORDER BY lista`, [p.id]),
  })))
}))

r.post('/periodos', env((req, res) => {
  const anio = Number(req.body?.anio)
  if (!anio) throw new Error('Debe indicar el año de la calificación (por ejemplo 2026, comprendiendo de septiembre de 2025 a agosto de 2026).')
  if (get('SELECT id FROM periodos WHERE anio = ?', [anio])) throw new Error(`El período ${anio} ya existe.`)
  const base = plazosPeriodo(anio)
  const p = insertar('periodos', {
    anio,
    fecha_inicio: req.body?.fecha_inicio || base.fecha_inicio,
    fecha_termino: req.body?.fecha_termino || base.fecha_termino,
    fecha_constitucion_junta: req.body?.fecha_constitucion_junta || base.fecha_constitucion_junta,
    fecha_limite_calificaciones: req.body?.fecha_limite_calificaciones || base.fecha_limite_calificaciones,
    fecha_limite_escalafon: req.body?.fecha_limite_escalafon || base.fecha_limite_escalafon,
    estado: 'En proceso',
    vigente: 0,
    observaciones: req.body?.observaciones,
    creado_en: new Date().toISOString(),
  })
  auditar('Crea período', 'periodos', p.id, `Período ${anio}`)
  res.json(p)
}))

r.put('/periodos/:id', env((req, res) => {
  const campos = ['fecha_inicio', 'fecha_termino', 'fecha_constitucion_junta', 'fecha_limite_calificaciones', 'fecha_limite_escalafon', 'estado', 'observaciones']
  const datos = {}
  for (const c of campos) if (req.body?.[c] !== undefined) datos[c] = req.body[c]
  const p = actualizar('periodos', req.params.id, datos)
  auditar('Actualiza período', 'periodos', p.id, JSON.stringify(datos))
  res.json(p)
}))

r.post('/periodos/:id/vigente', env((req, res) => {
  const p = get('SELECT * FROM periodos WHERE id = ?', [req.params.id])
  if (!p) throw new Error('Período no encontrado')
  all('SELECT id FROM periodos').forEach((x) => actualizar('periodos', x.id, { vigente: x.id === p.id ? 1 : 0 }))
  config.escribir('periodo_actual', String(p.id))
  res.json({ ok: true, periodo: p })
}))

r.delete('/periodos/:id', env((req, res) => {
  const n = get('SELECT COUNT(*) AS n FROM calificaciones WHERE periodo_id = ?', [req.params.id]).n
  if (n > 0 && !req.query.forzar) {
    throw new Error(`El período tiene ${n} calificaciones asociadas. Confirme con ?forzar=1 para eliminar también esas fichas.`)
  }
  eliminar('periodos', req.params.id)
  auditar('Elimina período', 'periodos', req.params.id, `Calificaciones eliminadas: ${n}`)
  res.json({ ok: true, eliminadas: n })
}))

/* ── Unidades / direcciones regionales ───────────────────────────────────── */
r.get('/unidades', env((req, res) => {
  res.json(all(`SELECT u.*, (SELECT COUNT(*) FROM funcionarios f WHERE f.unidad_id = u.id) AS dotacion
    FROM unidades u ORDER BY u.tipo, u.nombre`))
}))

r.post('/unidades', env((req, res) => {
  if (!req.body?.nombre) throw new Error('El nombre de la unidad es obligatorio.')
  res.json(insertar('unidades', {
    nombre: req.body.nombre, sigla: req.body.sigla, tipo: req.body.tipo || 'Unidad',
    region: req.body.region, padre_id: req.body.padre_id || null, direccion: req.body.direccion,
    activo: 1, creado_en: new Date().toISOString(),
  }))
}))

r.put('/unidades/:id', env((req, res) => {
  const campos = ['nombre', 'sigla', 'tipo', 'region', 'padre_id', 'direccion', 'activo']
  const datos = {}
  for (const c of campos) if (req.body?.[c] !== undefined) datos[c] = req.body[c]
  res.json(actualizar('unidades', req.params.id, datos))
}))

r.delete('/unidades/:id', env((req, res) => {
  const n = get('SELECT COUNT(*) AS n FROM funcionarios WHERE unidad_id = ?', [req.params.id]).n
  if (n > 0) throw new Error(`La unidad tiene ${n} funcionarios asignados. Reasígnelos antes de eliminarla.`)
  eliminar('unidades', req.params.id)
  res.json({ ok: true })
}))

/* ── Mantención de la base ───────────────────────────────────────────────── */
r.post('/admin/reiniciar', env(async (req, res) => {
  const { cargarDemo, vaciar } = await import('../seed.js')
  if (req.body?.modo === 'vacio') {
    vaciar()
    auditar('Vacía la base de datos', 'admin', null, 'Se eliminaron todos los registros')
    return res.json({ ok: true, modo: 'vacio' })
  }
  vaciar()
  cargarDemo()
  auditar('Carga datos de demostración', 'admin', null, 'Base reiniciada con dotación de ejemplo')
  res.json({ ok: true, modo: 'demo', funcionarios: get('SELECT COUNT(*) AS n FROM funcionarios').n })
}))

r.get('/auditoria', env((req, res) => {
  res.json(all('SELECT * FROM auditoria ORDER BY id DESC LIMIT 200'))
}))

r.get('/resumen-base', env((req, res) => {
  const t = (tabla) => get(`SELECT COUNT(*) AS n FROM ${tabla}`).n
  res.json({
    funcionarios: t('funcionarios'),
    jefes: get('SELECT COUNT(*) AS n FROM funcionarios WHERE es_jefe_evaluador = 1').n,
    asociados_aneiich: get('SELECT COUNT(*) AS n FROM funcionarios WHERE asociado_aneiich = 1').n,
    unidades: t('unidades'),
    periodos: t('periodos'),
    calificaciones: t('calificaciones'),
    votos: t('votos_subfactor'),
    hojas_de_vida: t('hoja_vida'),
    informes: t('informes_desempeno'),
    apelaciones: t('apelaciones'),
    actas: t('actas'),
  })
}))

export default r
