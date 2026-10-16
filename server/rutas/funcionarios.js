import { Router } from 'express'
import {
  all, get, insertar, actualizar, eliminar, auditar, run,
} from '../db.js'
import { evaluarCalificabilidad, ESTAMENTOS } from '../dominio.js'
import { env, aBool, periodoVigente, CALIDADES, ESTADOS_FUNCIONARIO, ROLES_ANEIICH } from './meta.js'
import { parseCSV, aCSV, normalizarRut, validarRut } from '../csv.js'

const r = Router()

const CAMPOS_FUNCIONARIO = [
  'rut', 'nombres', 'apellido_paterno', 'apellido_materno', 'email', 'telefono', 'sexo', 'fecha_nacimiento',
  'unidad_id', 'cargo', 'grado', 'planta', 'calidad_juridica', 'jornada',
  'fecha_ingreso_servicio', 'fecha_ingreso_grado', 'fecha_ingreso_administracion', 'anios_servicio',
  'jefe_id', 'es_jefe_evaluador', 'asociado_aneiich', 'rol_aneiich', 'fecha_afiliacion', 'observacion_aneiich',
  'es_jefe_superior', 'es_subrogante', 'integrante_junta', 'es_delegado_personal', 'es_dirigente_asociacion',
  'solicita_ser_calificado', 'meses_desempeno_periodo', 'no_calificable', 'causal_no_calificable',
  'fecha_termino', 'estado', 'observaciones', 'foto_url',
]

const BOOLEANOS = ['es_jefe_evaluador', 'asociado_aneiich', 'es_jefe_superior', 'es_subrogante', 'integrante_junta',
  'es_delegado_personal', 'es_dirigente_asociacion', 'solicita_ser_calificado', 'no_calificable']

export const SQL_LISTADO = `
  SELECT f.*,
    u.nombre AS unidad_nombre, u.tipo AS unidad_tipo, u.region AS region,
    (j.nombres || ' ' || j.apellido_paterno || COALESCE(' ' || j.apellido_materno, '')) AS jefe_nombre,
    j.cargo AS jefe_cargo,
    (SELECT COUNT(*) FROM funcionarios d WHERE d.jefe_id = f.id AND d.estado = 'Vigente') AS dependientes,
    c.id AS cal_id, c.estado AS cal_estado, c.puntaje, c.lista, c.nota_final, c.escala_numero,
    c.precal_efectuada, c.precal_jefe_nombre, c.cal_fecha_sesion, c.notificado_por
  FROM funcionarios f
  LEFT JOIN unidades u ON u.id = f.unidad_id
  LEFT JOIN funcionarios j ON j.id = f.jefe_id
  LEFT JOIN calificaciones c ON c.funcionario_id = f.id AND c.periodo_id = ?`

function filtros(q) {
  const where = []
  const params = []
  if (q.buscar && /^[\d.\-kK]+$/.test(q.buscar)) {
    where.push('f.rut LIKE ?')
    params.push(`%${normalizarRut(q.buscar)}%`)
  }
  if (q.buscar) {
    where.push(`(f.rut LIKE ? OR f.nombres LIKE ? OR f.apellido_paterno LIKE ? OR f.apellido_materno LIKE ?
      OR (f.nombres || ' ' || f.apellido_paterno || ' ' || COALESCE(f.apellido_materno,'')) LIKE ?
      OR f.cargo LIKE ? OR f.email LIKE ?)`)
    const t = `%${q.buscar}%`
    params.push(t, t, t, t, t, t, t)
  }
  if (q.unidad) { where.push('f.unidad_id = ?'); params.push(q.unidad) }
  if (q.region) { where.push('u.region = ?'); params.push(q.region) }
  if (q.planta) { where.push('f.planta = ?'); params.push(q.planta) }
  if (q.calidad) { where.push('f.calidad_juridica = ?'); params.push(q.calidad) }
  if (q.estado) { where.push('f.estado = ?'); params.push(q.estado) }
  if (q.grado) { where.push('f.grado = ?'); params.push(q.grado) }
  if (q.jefe) { where.push('f.jefe_id = ?'); params.push(q.jefe) }
  if (q.solo_jefes === '1') where.push('f.es_jefe_evaluador = 1')
  if (q.aneiich === '1') where.push('f.asociado_aneiich = 1')
  if (q.aneiich === '0') where.push('f.asociado_aneiich = 0')
  if (q.rol_aneiich) { where.push('f.rol_aneiich = ?'); params.push(q.rol_aneiich) }
  if (q.no_calificable === '1') where.push('f.no_calificable = 1')
  return { sql: where.length ? ` WHERE ${where.join(' AND ')}` : '', params }
}

function desplegar(fila, periodo) {
  const eleg = evaluarCalificabilidad(fila, periodo)
  return {
    ...fila,
    nombre_completo: `${fila.nombres} ${fila.apellido_paterno}${fila.apellido_materno ? ` ${fila.apellido_materno}` : ''}`,
    aneiich: Boolean(fila.asociado_aneiich),
    calificable: eleg.calificable,
    causal_no_calificable_calc: eleg.causal,
    meses_acreditados: eleg.meses ?? fila.meses_desempeno_periodo,
  }
}

/* ── Listado con filtros, orden y paginación ─────────────────────────────── */
r.get('/funcionarios', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const idPeriodo = periodo?.id ?? null
  const f = filtros(req.query)
  const ordenables = {
    nombre: 'f.apellido_paterno, f.nombres',
    grado: 'f.grado',
    puntaje: 'c.puntaje',
    antiguedad: 'f.fecha_ingreso_servicio',
    aneiich: 'f.asociado_aneiich DESC, f.apellido_paterno',
    unidad: 'u.nombre, f.apellido_paterno',
  }
  const orden = ordenables[req.query.orden] || ordenables.nombre
  const dir = String(req.query.dir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  const porPagina = Math.min(Number(req.query.porPagina) || 25, 500)
  const pagina = Math.max(Number(req.query.pagina) || 1, 1)

  const total = get(`SELECT COUNT(*) AS n FROM funcionarios f LEFT JOIN unidades u ON u.id = f.unidad_id${f.sql}`, f.params).n
  const filas = all(`${SQL_LISTADO}${f.sql} ORDER BY ${orden} ${dir} LIMIT ? OFFSET ?`,
    [idPeriodo, ...f.params, porPagina, (pagina - 1) * porPagina])

  const ids = filas.map((x) => x.id)
  const historial = ids.length
    ? all(`SELECT funcionario_id, p.anio, c.puntaje, c.lista FROM calificaciones c
           JOIN periodos p ON p.id = c.periodo_id WHERE c.funcionario_id IN (${ids.map(() => '?').join(',')})
           AND c.puntaje IS NOT NULL ORDER BY p.anio`, ids)
    : []

  res.json({
    total,
    pagina,
    porPagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    periodo: periodo ? { id: periodo.id, anio: periodo.anio } : null,
    datos: filas.map((fila) => ({
      ...desplegar(fila, periodo),
      historial: historial.filter((h) => h.funcionario_id === fila.id),
    })),
    resumen: get(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN f.asociado_aneiich = 1 THEN 1 ELSE 0 END) AS aneiich,
        SUM(CASE WHEN f.es_jefe_evaluador = 1 THEN 1 ELSE 0 END) AS jefes,
        SUM(CASE WHEN f.calidad_juridica = 'Contrata' THEN 1 ELSE 0 END) AS contrata,
        SUM(CASE WHEN f.estado <> 'Vigente' THEN 1 ELSE 0 END) AS no_vigentes
      FROM funcionarios f LEFT JOIN unidades u ON u.id = f.unidad_id${f.sql}`, f.params),
  })
}))

/* ── Selección rápida ANEIICH ────────────────────────────────────────────── */
r.get('/aneiich/padron', env((req, res) => {
  const periodo = periodoVigente()
  const filas = all(`${SQL_LISTADO} WHERE f.asociado_aneiich = 1 ORDER BY f.apellido_paterno, f.nombres`, [periodo?.id ?? null])
  res.json({
    total: filas.length,
    por_rol: all(`SELECT COALESCE(rol_aneiich, 'Socio') AS rol, COUNT(*) AS n FROM funcionarios
      WHERE asociado_aneiich = 1 GROUP BY rol ORDER BY n DESC`),
    por_estamento: all(`SELECT planta AS estamento, COUNT(*) AS n FROM funcionarios
      WHERE asociado_aneiich = 1 GROUP BY planta ORDER BY n DESC`),
    por_unidad: all(`SELECT u.nombre AS unidad, COUNT(*) AS n FROM funcionarios f
      JOIN unidades u ON u.id = f.unidad_id WHERE f.asociado_aneiich = 1 GROUP BY u.nombre ORDER BY n DESC`),
    sin_reconocimiento: all(`SELECT COUNT(*) AS n FROM funcionarios WHERE es_dirigente_asociacion = 1 AND asociado_aneiich = 0`),
    dirigentes: all(`SELECT * FROM funcionarios WHERE es_dirigente_asociacion = 1 OR es_delegado_personal = 1`),
    datos: filas.map((f) => desplegar(f, periodo)),
  })
}))

/* ── Base de jefes evaluadores ───────────────────────────────────────────── */
r.get('/jefes', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const jefes = all(`
    SELECT f.*, u.nombre AS unidad_nombre, u.region,
      (SELECT COUNT(*) FROM funcionarios d WHERE d.jefe_id = f.id) AS dependientes,
      (SELECT COUNT(*) FROM funcionarios d WHERE d.jefe_id = f.id AND d.estado = 'Vigente') AS dependientes_vigentes,
      (SELECT COUNT(*) FROM calificaciones c JOIN funcionarios d ON d.id = c.funcionario_id
        WHERE d.jefe_id = f.id AND c.periodo_id = ?) AS fichas,
      (SELECT COUNT(*) FROM calificaciones c JOIN funcionarios d ON d.id = c.funcionario_id
        WHERE d.jefe_id = f.id AND c.periodo_id = ? AND c.precal_efectuada = 1) AS precalificados,
      (SELECT ROUND(AVG(c.puntaje), 2) FROM calificaciones c JOIN funcionarios d ON d.id = c.funcionario_id
        WHERE d.jefe_id = f.id AND c.periodo_id = ? AND c.puntaje IS NOT NULL) AS promedio_dependientes,
      (SELECT ROUND(AVG(c2.puntaje), 2) FROM calificaciones c2 WHERE c2.funcionario_id = f.id AND c2.puntaje IS NOT NULL) AS promedio_propio,
      (SELECT COUNT(*) FROM juntas j WHERE j.presidente_funcionario_id = f.id) AS juntas_presididas
    FROM funcionarios f
    LEFT JOIN unidades u ON u.id = f.unidad_id
    WHERE f.es_jefe_evaluador = 1 OR EXISTS(SELECT 1 FROM funcionarios d WHERE d.jefe_id = f.id)
    ORDER BY dependientes DESC, f.apellido_paterno`, [periodo?.id ?? null, periodo?.id ?? null, periodo?.id ?? null])
  res.json({
    periodo,
    datos: jefes.map((j) => ({
      ...j,
      nombre_completo: `${j.nombres} ${j.apellido_paterno}${j.apellido_materno ? ` ${j.apellido_materno}` : ''}`,
      pendientes: Math.max(0, (j.fichas ?? 0) - (j.precalificados ?? 0)),
      aneiich: Boolean(j.asociado_aneiich),
    })),
  })
}))

r.get('/jefes/:id', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const jefe = get(`${SQL_LISTADO} WHERE f.id = ?`, [periodo?.id ?? null, req.params.id])
  if (!jefe) throw new Error('Jefe evaluador no encontrado')
  const dependientes = all(`${SQL_LISTADO} WHERE f.jefe_id = ? ORDER BY f.apellido_paterno`, [periodo?.id ?? null, req.params.id])
  res.json({
    jefe: desplegar(jefe, periodo),
    periodo,
    dependientes: dependientes.map((d) => desplegar(d, periodo)),
    historial: all(`SELECT p.anio, c.puntaje, c.lista, c.estado, c.precal_jefe_nombre
      FROM calificaciones c JOIN periodos p ON p.id = c.periodo_id
      WHERE c.funcionario_id = ? ORDER BY p.anio DESC`, [req.params.id]),
  })
}))

/* ── Exportaciones / plantilla ───────────────────────────────────────────── */
const COLUMNAS_IMPORTACION = [
  { clave: 'rut', titulo: 'RUT' },
  { clave: 'nombres', titulo: 'Nombres' },
  { clave: 'apellido_paterno', titulo: 'Apellido paterno' },
  { clave: 'apellido_materno', titulo: 'Apellido materno' },
  { clave: 'email', titulo: 'Email' },
  { clave: 'telefono', titulo: 'Teléfono' },
  { clave: 'sexo', titulo: 'Sexo' },
  { clave: 'fecha_nacimiento', titulo: 'Fecha de nacimiento' },
  { clave: 'cargo', titulo: 'Cargo' },
  { clave: 'grado', titulo: 'Grado' },
  { clave: 'planta', titulo: 'Estamento' },
  { clave: 'calidad_juridica', titulo: 'Calidad jurídica' },
  { clave: 'jornada', titulo: 'Jornada' },
  { clave: 'unidad', titulo: 'Unidad' },
  { clave: 'nombre_jefe', titulo: 'Jefe directo' },
  { clave: 'fecha_ingreso_servicio', titulo: 'Fecha ingreso al servicio' },
  { clave: 'fecha_ingreso_grado', titulo: 'Fecha de promoción al grado' },
  { clave: 'fecha_ingreso_administracion', titulo: 'Fecha ingreso a la Administración' },
  { clave: 'asociado_aneiich', titulo: 'ANEIICH (SI/NO)' },
  { clave: 'rol_aneiich', titulo: 'Rol en ANEIICH' },
  { clave: 'fecha_afiliacion', titulo: 'Fecha de afiliación ANEIICH' },
  { clave: 'estado', titulo: 'Estado funcionario' },
  { clave: 'observaciones', titulo: 'Observaciones' },
]

r.get('/funcionarios/plantilla.csv', env((req, res) => {
  const ejemplo = [{
    rut: '12.345.678-9', nombres: 'María José', apellido_paterno: 'González', apellido_materno: 'Rojas',
    email: 'mjgonzalez@sii.cl', telefono: '+56 9 1234 5678', sexo: 'F', fecha_nacimiento: '1985-04-12',
    cargo: 'Fiscalizador Tributario', grado: 11, planta: 'Fiscalizadores', calidad_juridica: 'Planta',
    jornada: '44 horas semanales', unidad: 'Dirección Regional Valparaíso', nombre_jefe: 'Pedro Soto Díaz',
    fecha_ingreso_servicio: '2010-03-01', fecha_ingreso_grado: '2021-06-01', fecha_ingreso_administracion: '2008-01-15',
    asociado_aneiich: 'SI', rol_aneiich: 'Socio', fecha_afiliacion: '2012-05-02', estado: 'Vigente',
    observaciones: 'Sin observaciones',
  }]
  res.type('text/csv; charset=utf-8').send(aCSV(ejemplo, COLUMNAS_IMPORTACION))
}))

r.get('/funcionarios/export.csv', env((req, res) => {
  const periodo = periodoVigente()
  const filas = all(`${SQL_LISTADO}${filtros(req.query).sql} ORDER BY f.apellido_paterno`, [periodo?.id ?? null, ...filtros(req.query).params])
    .map((f) => desplegar(f, periodo))
  const columnas = [
    ...COLUMNAS_IMPORTACION.filter((c) => c.clave !== 'unidad' && c.clave !== 'nombre_jefe'),
    { clave: 'unidad_nombre', titulo: 'Unidad' },
    { clave: 'jefe_nombre', titulo: 'Jefe directo' },
    { clave: 'cal_estado', titulo: `Estado calificación ${periodo?.anio ?? ''}` },
    { clave: 'puntaje', titulo: `Puntaje ${periodo?.anio ?? ''}` },
    { clave: 'lista', titulo: `Lista ${periodo?.anio ?? ''}` },
    { clave: 'causal_no_calificable_calc', titulo: 'Causal de no calificación' },
  ]
  res.type('text/csv; charset=utf-8').send(aCSV(filas, columnas))
}))

/* ── Importación masiva desde planilla ───────────────────────────────────── */
r.post('/funcionarios/importar', env((req, res) => {
  const texto = req.body?.csv
  if (!texto) throw new Error('Debe adjuntar el contenido CSV. Use la plantilla descargable como referencia.')
  const filas = parseCSV(texto, req.body?.delimitador)
  if (!filas.length) throw new Error('El archivo no contiene filas de datos.')
  const unidades = all('SELECT * FROM unidades')
  const funcionarios = all('SELECT id, rut, nombres, apellido_paterno, apellido_materno FROM funcionarios')
  const buscarUnidad = (nombre) => {
    if (!nombre) return null
    const n = String(nombre).trim().toLowerCase()
    return unidades.find((u) => u.nombre.toLowerCase() === n || (u.sigla || '').toLowerCase() === n)
      ?? insertar('unidades', { nombre: String(nombre).trim(), tipo: 'Unidad', activo: 1, creado_en: new Date().toISOString() })
  }
  const buscarJefe = (nombre) => {
    if (!nombre) return null
    const n = String(nombre).trim().toLowerCase()
    return funcionarios.find((f) => `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno ?? ''}`.toLowerCase().includes(n))
      ?? funcionarios.find((f) => normalizarRut(f.rut) === normalizarRut(nombre))
  }

  const resumen = { total: filas.length, creados: 0, actualizados: 0, errores: [], advertencias: [] }
  const mapear = (fila) => {
    const normal = {}
    for (const [k, v] of Object.entries(fila)) normal[k.trim().toLowerCase()] = v
    const tomar = (...claves) => {
      for (const c of claves) {
        const k = Object.keys(normal).find((x) => x === c || x.startsWith(c))
        if (k && normal[k] !== '') return normal[k]
      }
      return ''
    }
    const planta = tomar('estamento', 'planta')
    const plantaNormalizada = ESTAMENTOS.find((e) => e.toLowerCase() === String(planta).toLowerCase())
      ?? (String(planta).toLowerCase().includes('fiscaliz') ? 'Fiscalizadores'
        : String(planta).toLowerCase().includes('direct') ? 'Directivos'
          : String(planta).toLowerCase().includes('profes') ? 'Profesionales'
            : String(planta).toLowerCase().includes('téc') ? 'Técnicos'
              : String(planta).toLowerCase().includes('aux') ? 'Auxiliares' : 'Administrativos')
    const unidad = buscarUnidad(tomar('unidad', 'dirección regional', 'repartición'))
    const jefe = buscarJefe(tomar('jefe directo', 'jefe', 'nombre jefe'))
    return {
      rut: normalizarRut(tomar('rut')),
      nombres: tomar('nombres'),
      apellido_paterno: tomar('apellido paterno', 'paterno'),
      apellido_materno: tomar('apellido materno', 'materno'),
      email: tomar('email', 'correo'),
      telefono: tomar('teléfono', 'telefono', 'fono'),
      sexo: tomar('sexo', 'género'),
      fecha_nacimiento: tomar('fecha de nacimiento', 'nacimiento'),
      unidad_id: unidad?.id ?? null,
      cargo: tomar('cargo', 'denominación'),
      grado: Number(tomar('grado')) || null,
      planta: plantaNormalizada,
      calidad_juridica: tomar('calidad jurídica', 'calidad') || 'Planta',
      jornada: tomar('jornada'),
      fecha_ingreso_servicio: tomar('fecha ingreso al servicio', 'ingreso al servicio', 'ingreso servicio'),
      fecha_ingreso_grado: tomar('fecha de promoción', 'promoción al grado', 'ingreso al grado'),
      fecha_ingreso_administracion: tomar('ingreso a la administración', 'fecha ingreso administración'),
      asociado_aneiich: /^(si|sí|s|1|x)$/i.test(tomar('aneiich')) ? 1 : 0,
      rol_aneiich: ROLES_ANEIICH.find((x) => x.toLowerCase() === String(tomar('rol en aneiich', 'rol')).toLowerCase()) ?? (tomar('rol en aneiich', 'rol') ? 'Socio' : null),
      fecha_afiliacion: tomar('fecha de afiliación', 'afiliación'),
      estado: ESTADOS_FUNCIONARIO.find((e) => e.toLowerCase() === String(tomar('estado funcionario', 'estado')).toLowerCase()) ?? 'Vigente',
      observaciones: tomar('observaciones'),
      jefe_id: jefe?.id ?? null,
    }
  }

  for (const [i, fila] of filas.entries()) {
    const datos = mapear(fila)
    if (!datos.rut) { resumen.errores.push(`Fila ${i + 2}: falta el RUT.`); continue }
    if (!datos.nombres || !datos.apellido_paterno) { resumen.errores.push(`Fila ${i + 2} (${datos.rut}): faltan nombres o apellido paterno.`); continue }
    if (!validarRut(datos.rut)) resumen.advertencias.push(`Fila ${i + 2} (${datos.rut}): el dígito verificador no calza; se cargó de todos modos.`)
    const existente = get('SELECT id FROM funcionarios WHERE rut = ?', [datos.rut])
    try {
      if (existente) {
        actualizar('funcionarios', existente.id, { ...datos, actualizado_en: new Date().toISOString() })
        resumen.actualizados++
      } else {
        insertar('funcionarios', { ...datos, creado_en: new Date().toISOString() })
        resumen.creados++
      }
    } catch (e) {
      resumen.errores.push(`Fila ${i + 2} (${datos.rut}): ${e.message}`)
    }
  }
  auditar('Importa funcionarios', 'funcionarios', null, resumen)
  res.json(resumen)
}))

/* ── Acciones masivas (selección rápida) ────────────────────────────────── */
r.post('/funcionarios/masivo', env((req, res) => {
  const ids = (req.body?.ids ?? []).map(Number).filter(Boolean)
  const { accion, valor } = req.body ?? {}
  if (!ids.length) throw new Error('Debe seleccionar al menos un funcionario.')
  const marcador = ids.map(() => '?').join(',')
  let detalle = ''
  switch (accion) {
    case 'marcar_aneiich':
      run(`UPDATE funcionarios SET asociado_aneiich = 1, rol_aneiich = COALESCE(rol_aneiich, 'Socio'),
        fecha_afiliacion = COALESCE(fecha_afiliacion, date('now')) WHERE id IN (${marcador})`, ids)
      detalle = 'Se marcaron como asociados a ANEIICH'
      break
    case 'desmarcar_aneiich':
      run(`UPDATE funcionarios SET asociado_aneiich = 0, rol_aneiich = NULL WHERE id IN (${marcador})`, ids)
      detalle = 'Se desmarcaron de ANEIICH'
      break
    case 'rol_aneiich':
      run(`UPDATE funcionarios SET asociado_aneiich = 1, rol_aneiich = ? WHERE id IN (${marcador})`, [valor, ...ids])
      detalle = `Se asignó el rol ANEIICH "${valor}"`
      break
    case 'asignar_jefe':
      run(`UPDATE funcionarios SET jefe_id = ? WHERE id IN (${marcador})`, [valor || null, ...ids])
      detalle = 'Se reasignó la jefatura directa'
      break
    case 'asignar_unidad':
      run(`UPDATE funcionarios SET unidad_id = ? WHERE id IN (${marcador})`, [valor, ...ids])
      detalle = 'Se reasignó la unidad'
      break
    case 'cambiar_estado':
      run(`UPDATE funcionarios SET estado = ? WHERE id IN (${marcador})`, [valor, ...ids])
      detalle = `Se cambió el estado a "${valor}"`
      break
    case 'marcar_jefe':
      run(`UPDATE funcionarios SET es_jefe_evaluador = 1 WHERE id IN (${marcador})`, ids)
      detalle = 'Se marcaron como jefes evaluadores'
      break
    case 'no_calificable':
      run(`UPDATE funcionarios SET no_calificable = 1, causal_no_calificable = ? WHERE id IN (${marcador})`,
        [valor || 'Excluido manualmente por la unidad de personal', ...ids])
      detalle = 'Se marcaron como no calificables (art. 5)'
      break
    case 'calificable':
      run(`UPDATE funcionarios SET no_calificable = 0, causal_no_calificable = NULL WHERE id IN (${marcador})`, ids)
      detalle = 'Se restableció la obligación de calificar'
      break
    default:
      throw new Error(`Acción masiva desconocida: ${accion}`)
  }
  auditar('Acción masiva', 'funcionarios', null, `${detalle} (${ids.length} funcionarios)`, req.body?.usuario)
  res.json({ ok: true, afectados: ids.length, detalle })
}))

/* ── CRUD de funcionario ─────────────────────────────────────────────────── */
r.get('/funcionarios/:id', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const f = get(`${SQL_LISTADO} WHERE f.id = ?`, [periodo?.id ?? null, req.params.id])
  if (!f) throw new Error('Funcionario no encontrado')
  const calificaciones = all(`SELECT c.*, p.anio, p.estado AS periodo_estado,
      (j.tipo || COALESCE(' · ' || j.region, '')) AS junta_nombre
    FROM calificaciones c JOIN periodos p ON p.id = c.periodo_id
    LEFT JOIN juntas j ON j.id = c.junta_id
    WHERE c.funcionario_id = ? ORDER BY p.anio DESC`, [req.params.id])
  res.json({
    funcionario: desplegar(f, periodo),
    periodo,
    calificaciones,
    hoja_vida: all('SELECT * FROM hoja_vida WHERE funcionario_id = ? ORDER BY fecha DESC', [req.params.id]),
    informes: all('SELECT * FROM informes_desempeno WHERE funcionario_id = ? ORDER BY numero DESC', [req.params.id]),
    apelaciones: all(`SELECT a.*, p.anio FROM apelaciones a JOIN calificaciones c ON c.id = a.calificacion_id
      JOIN periodos p ON p.id = c.periodo_id WHERE c.funcionario_id = ? ORDER BY a.fecha DESC`, [req.params.id]),
    dependientes: all('SELECT id, nombres, apellido_paterno, apellido_materno, cargo, grado FROM funcionarios WHERE jefe_id = ?', [req.params.id]),
    promedio_historico: get('SELECT ROUND(AVG(puntaje), 2) AS promedio, COUNT(*) AS periodos FROM calificaciones WHERE funcionario_id = ? AND puntaje IS NOT NULL', [req.params.id]),
  })
}))

r.post('/funcionarios', env((req, res) => {
  const datos = {}
  for (const c of CAMPOS_FUNCIONARIO) if (req.body?.[c] !== undefined) datos[c] = BOOLEANOS.includes(c) ? aBool(req.body[c]) : req.body[c]
  if (!datos.rut) throw new Error('El RUT es obligatorio.')
  datos.rut = normalizarRut(datos.rut)
  if (!validarRut(datos.rut)) throw new Error('El RUT ingresado no es válido (revise el dígito verificador).')
  if (!datos.nombres || !datos.apellido_paterno) throw new Error('Nombres y apellido paterno son obligatorios.')
  if (get('SELECT id FROM funcionarios WHERE rut = ?', [datos.rut])) throw new Error('Ya existe un funcionario con ese RUT.')
  if (datos.asociado_aneiich && !datos.rol_aneiich) datos.rol_aneiich = 'Socio'
  const f = insertar('funcionarios', { ...datos, creado_en: new Date().toISOString() })
  auditar('Crea funcionario', 'funcionarios', f.id, `${f.nombres} ${f.apellido_paterno} (${f.rut})`)
  res.json(desplegar(f, periodoVigente()))
}))

r.put('/funcionarios/:id', env((req, res) => {
  const actual = get('SELECT * FROM funcionarios WHERE id = ?', [req.params.id])
  if (!actual) throw new Error('Funcionario no encontrado')
  const datos = {}
  for (const c of CAMPOS_FUNCIONARIO) if (req.body?.[c] !== undefined) datos[c] = BOOLEANOS.includes(c) ? aBool(req.body[c]) : req.body[c]
  if (datos.rut) {
    datos.rut = normalizarRut(datos.rut)
    if (!validarRut(datos.rut)) throw new Error('El RUT ingresado no es válido.')
    if (get('SELECT id FROM funcionarios WHERE rut = ? AND id <> ?', [datos.rut, req.params.id])) throw new Error('Otro funcionario ya usa ese RUT.')
  }
  if (datos.asociado_aneiich === 1 && !datos.rol_aneiich && !actual.rol_aneiich) datos.rol_aneiich = 'Socio'
  if (datos.asociado_aneiich === 0) datos.rol_aneiich = null
  const f = actualizar('funcionarios', req.params.id, { ...datos, actualizado_en: new Date().toISOString() })
  auditar('Actualiza funcionario', 'funcionarios', f.id, Object.keys(datos).join(', '))
  res.json(desplegar(f, periodoVigente()))
}))

r.delete('/funcionarios/:id', env((req, res) => {
  const f = get('SELECT * FROM funcionarios WHERE id = ?', [req.params.id])
  if (!f) throw new Error('Funcionario no encontrado')
  const dependientes = get('SELECT COUNT(*) AS n FROM funcionarios WHERE jefe_id = ?', [req.params.id]).n
  if (dependientes > 0) throw new Error(`El funcionario es jefe directo de ${dependientes} funcionarios. Reasígnelos antes de eliminarlo.`)
  eliminar('funcionarios', req.params.id)
  auditar('Elimina funcionario', 'funcionarios', Number(req.params.id), `${f.nombres} ${f.apellido_paterno} (${f.rut})`)
  res.json({ ok: true })
}))

// Catálogos auxiliares para formularios
r.get('/catalogos', env((req, res) => {
  res.json({
    estamentos: ESTAMENTOS,
    calidades: CALIDADES,
    estados: ESTADOS_FUNCIONARIO,
    rolesAneiich: ROLES_ANEIICH,
    unidades: all('SELECT id, nombre, sigla, tipo, region FROM unidades WHERE activo = 1 ORDER BY nombre'),
    jefes: all(`SELECT id, nombres, apellido_paterno, apellido_materno, cargo, unidad_id FROM funcionarios
      WHERE es_jefe_evaluador = 1 OR EXISTS(SELECT 1 FROM funcionarios d WHERE d.jefe_id = funcionarios.id)
      ORDER BY apellido_paterno`),
  })
}))

export default r
