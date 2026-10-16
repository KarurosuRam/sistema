import { Router } from 'express'
import { all, get } from '../db.js'
import { FACTORES, SUBFACTORES, LISTAS, COEFICIENTES, ESTAMENTOS, evaluarCalificabilidad } from '../dominio.js'
import { env, periodoVigente } from './meta.js'
import { aCSV } from '../csv.js'

const r = Router()

const n2 = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100)

/** Días entre hoy y una fecha (positivo = por venir). */
function diasHasta(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(`${fecha}T00:00:00`)
  return Math.round((f - hoy) / 86400000)
}

function promedios(periodoId, agrupador) {
  return all(`SELECT ${agrupador} AS clave, COUNT(*) AS n,
      ROUND(AVG(c.puntaje), 2) AS promedio,
      ROUND(MIN(c.puntaje), 2) AS minimo,
      ROUND(MAX(c.puntaje), 2) AS maximo,
      SUM(CASE WHEN c.lista = 1 THEN 1 ELSE 0 END) AS lista1,
      SUM(CASE WHEN c.lista = 2 THEN 1 ELSE 0 END) AS lista2,
      SUM(CASE WHEN c.lista = 3 THEN 1 ELSE 0 END) AS lista3,
      SUM(CASE WHEN c.lista = 4 THEN 1 ELSE 0 END) AS lista4,
      ROUND(AVG(CASE WHEN f.asociado_aneiich = 1 THEN c.puntaje END), 2) AS promedio_aneiich,
      ROUND(AVG(CASE WHEN f.asociado_aneiich = 0 THEN c.puntaje END), 2) AS promedio_no_aneiich
    FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    WHERE c.periodo_id = ? AND c.puntaje IS NOT NULL
    GROUP BY clave ORDER BY promedio DESC`, [periodoId])
}

/* ── Tablero principal ──────────────────────────────────────────────────── */
r.get('/dashboard', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const idPeriodo = periodo?.id ?? null

  const dotacion = get(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN estado = 'Vigente' THEN 1 ELSE 0 END) AS vigentes,
      SUM(CASE WHEN asociado_aneiich = 1 THEN 1 ELSE 0 END) AS aneiich,
      SUM(CASE WHEN es_jefe_evaluador = 1 THEN 1 ELSE 0 END) AS jefes,
      SUM(CASE WHEN calidad_juridica = 'Contrata' THEN 1 ELSE 0 END) AS contrata,
      SUM(CASE WHEN calidad_juridica LIKE 'Planta%' THEN 1 ELSE 0 END) AS planta,
      SUM(CASE WHEN es_dirigente_asociacion = 1 THEN 1 ELSE 0 END) AS dirigentes,
      SUM(CASE WHEN es_delegado_personal = 1 THEN 1 ELSE 0 END) AS delegados,
      ROUND(AVG(CAST((julianday('now') - julianday(fecha_ingreso_servicio)) / 365.25 AS REAL)), 1) AS antiguedad_promedio
    FROM funcionarios`) ?? {}

  const fichas = (idPeriodo ? get(`SELECT COUNT(*) AS fichas,
      SUM(CASE WHEN estado = 'Borrador' THEN 1 ELSE 0 END) AS borrador,
      SUM(CASE WHEN estado = 'Informes de desempeño' THEN 1 ELSE 0 END) AS informes,
      SUM(CASE WHEN estado = 'Precalificado' THEN 1 ELSE 0 END) AS precalificados,
      SUM(CASE WHEN estado = 'En junta' THEN 1 ELSE 0 END) AS en_junta,
      SUM(CASE WHEN estado = 'Calificado' THEN 1 ELSE 0 END) AS calificados,
      SUM(CASE WHEN estado = 'Apelación' THEN 1 ELSE 0 END) AS apelaciones,
      SUM(CASE WHEN estado = 'Ejecutoriado' THEN 1 ELSE 0 END) AS ejecutoriados,
      ROUND(AVG(puntaje), 2) AS promedio, ROUND(MIN(puntaje), 2) AS minimo, ROUND(MAX(puntaje), 2) AS maximo,
      SUM(CASE WHEN lista = 1 THEN 1 ELSE 0 END) AS lista1, SUM(CASE WHEN lista = 2 THEN 1 ELSE 0 END) AS lista2,
      SUM(CASE WHEN lista = 3 THEN 1 ELSE 0 END) AS lista3, SUM(CASE WHEN lista = 4 THEN 1 ELSE 0 END) AS lista4
    FROM calificaciones WHERE periodo_id = ?`, [idPeriodo]) : null) ?? {}

  // Personal no calificable del período (art. 5)
  const noCalificables = all("SELECT * FROM funcionarios WHERE estado <> 'Finiquitado'")
    .map((f) => ({ f, e: evaluarCalificabilidad(f, periodo) }))
    .filter((x) => !x.e.calificable)

  // Series históricas
  const porAnio = all(`SELECT p.anio, COUNT(*) AS n, ROUND(AVG(c.puntaje), 2) AS promedio,
      SUM(CASE WHEN c.lista = 1 THEN 1 ELSE 0 END) AS lista1, SUM(CASE WHEN c.lista = 2 THEN 1 ELSE 0 END) AS lista2,
      SUM(CASE WHEN c.lista = 3 THEN 1 ELSE 0 END) AS lista3, SUM(CASE WHEN c.lista = 4 THEN 1 ELSE 0 END) AS lista4,
      ROUND(AVG(CASE WHEN f.asociado_aneiich = 1 THEN c.puntaje END), 2) AS promedio_aneiich,
      ROUND(AVG(CASE WHEN f.asociado_aneiich = 0 THEN c.puntaje END), 2) AS promedio_no_aneiich,
      SUM(CASE WHEN f.asociado_aneiich = 1 THEN 1 ELSE 0 END) AS n_aneiich
    FROM calificaciones c JOIN periodos p ON p.id = c.periodo_id JOIN funcionarios f ON f.id = c.funcionario_id
    WHERE c.puntaje IS NOT NULL GROUP BY p.anio ORDER BY p.anio`)

  const porEstamentoAnio = all(`SELECT p.anio, f.planta AS estamento, COUNT(*) AS n,
      ROUND(AVG(c.puntaje), 2) AS promedio
    FROM calificaciones c JOIN periodos p ON p.id = c.periodo_id JOIN funcionarios f ON f.id = c.funcionario_id
    WHERE c.puntaje IS NOT NULL GROUP BY p.anio, f.planta ORDER BY p.anio`)

  // Notas por subfactor (promedio de las notas votadas / precalificadas del período)
  const notasSubfactor = {}
  const notasFactor = {}
  for (const s of SUBFACTORES) { notasSubfactor[s.clave] = { suma: 0, n: 0, nombre: s.nombre, factor: s.factor } }
  for (const f of FACTORES) notasFactor[f.clave] = { suma: 0, n: 0, nombre: f.nombre }
  const filasPeriodo = idPeriodo
    ? all(`SELECT c.precal_json, c.cal_json, f.planta FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id
           WHERE c.periodo_id = ?`, [idPeriodo])
    : []
  for (const fila of filasPeriodo) {
    let notas = null
    try { notas = (JSON.parse(fila.cal_json || 'null')?.subfactores) ?? (JSON.parse(fila.precal_json || 'null')?.subfactores) } catch { notas = null }
    if (!notas) continue
    const acumulado = {}
    for (const s of SUBFACTORES) {
      const v = notas[s.clave]
      if (typeof v !== 'number') continue
      notasSubfactor[s.clave].suma += v
      notasSubfactor[s.clave].n += 1
      acumulado[s.factor] = acumulado[s.factor] ?? []
      acumulado[s.factor].push(v)
    }
    for (const [clave, lista] of Object.entries(acumulado)) {
      notasFactor[clave].suma += lista.reduce((a, b) => a + b, 0) / lista.length
      notasFactor[clave].n += 1
    }
  }

  // Distribución de puntajes en tramos de 10 puntos

  const distribucionPuntajes = Array.from({ length: 10 }, (_, i) => {
    const desde = i * 10 === 0 ? 10 : i * 10
    const hasta = i === 9 ? 100 : i * 10 + 9.99
    const fila = idPeriodo
      ? get('SELECT COUNT(*) AS n FROM calificaciones WHERE periodo_id = ? AND puntaje >= ? AND puntaje <= ?', [idPeriodo, desde, hasta])
      : { n: 0 }
    return { tramo: `${desde}-${Math.round(hasta)}`, n: fila.n }
  })

  // Comparativa ANEIICH por estamento
  const comparativaAneiich = ESTAMENTOS.map((est) => {
    const base = idPeriodo
      ? get(`SELECT COUNT(*) AS n, ROUND(AVG(c.puntaje), 2) AS promedio,
            SUM(CASE WHEN f.asociado_aneiich = 1 THEN 1 ELSE 0 END) AS n_aneiich,
            ROUND(AVG(CASE WHEN f.asociado_aneiich = 1 THEN c.puntaje END), 2) AS promedio_aneiich,
            ROUND(AVG(CASE WHEN f.asociado_aneiich = 0 THEN c.puntaje END), 2) AS promedio_no_aneiich
          FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id
          WHERE c.periodo_id = ? AND f.planta = ? AND c.puntaje IS NOT NULL`, [idPeriodo, est])
      : null
    return { estamento: est, glosa: COEFICIENTES[est]?.glosa, ...(base ?? { n: 0 }) }
  }).filter((x) => x.n > 0)

  // Cumplimiento de los plazos legales
  const plazoInfo = (fecha, glosa) => {
    const dias = diasHasta(fecha)
    return {
      fecha, glosa, dias,
      estado: dias === null ? 'sin fecha' : dias < 0 ? 'vencido' : dias <= 15 ? 'por vencer' : 'en plazo',
    }
  }
  const plazos = periodo ? [
    plazoInfo(periodo.fecha_inicio, 'Inicio del período de desempeño (art. 3)'),
    plazoInfo(periodo.fecha_termino, 'Término del período de desempeño (art. 3)'),
    plazoInfo(periodo.fecha_constitucion_junta, 'Constitución de la Junta Calificadora (art. 28)'),
    plazoInfo(periodo.fecha_limite_calificaciones, 'Calificaciones en poder del secretario (art. 28)'),
    plazoInfo(periodo.fecha_limite_escalafon, 'Notificación del escalafón / vigencia (arts. 39 y 41)'),
  ] : []

  // Jefaturas: avance de precalificaciones
  const jefaturas = idPeriodo
    ? all(`SELECT f.id, (f.nombres || ' ' || f.apellido_paterno) AS jefe, f.cargo, u.nombre AS unidad,
        COUNT(c.id) AS dependientes,
        SUM(CASE WHEN c.precal_efectuada = 1 THEN 1 ELSE 0 END) AS precalificados,
        SUM(CASE WHEN c.precal_efectuada = 0 THEN 1 ELSE 0 END) AS pendientes,
        ROUND(AVG(c.puntaje), 2) AS promedio_dependientes
      FROM funcionarios f
      JOIN calificaciones c ON c.funcionario_id IN (SELECT id FROM funcionarios d WHERE d.jefe_id = f.id)
        AND c.periodo_id = ?
      LEFT JOIN unidades u ON u.id = f.unidad_id
      GROUP BY f.id ORDER BY pendientes DESC, dependientes DESC LIMIT 15`, [idPeriodo])
    : []

  const pendientes = idPeriodo ? all(`SELECT c.id, c.estado, c.puntaje, c.precal_efectuada,
      (f.nombres || ' ' || f.apellido_paterno || ' ' || COALESCE(f.apellido_materno,'')) AS funcionario,
      f.rut, f.grado, f.planta, u.nombre AS unidad, c.precal_jefe_nombre
    FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    WHERE c.periodo_id = ? AND c.estado NOT IN ('Ejecutoriado')
    ORDER BY CASE c.estado WHEN 'Borrador' THEN 1 WHEN 'Informes de desempeño' THEN 2 WHEN 'Precalificado' THEN 3
      WHEN 'En junta' THEN 4 WHEN 'Calificado' THEN 5 ELSE 6 END, f.grado LIMIT 40`, [idPeriodo]) : []

  res.json({
    periodo,
    periodos: all('SELECT id, anio, estado, vigente FROM periodos ORDER BY anio DESC'),
    dotacion,
    fichas,
    no_calificables: {
      total: noCalificables.length,
      detalle: noCalificables.slice(0, 25).map((x) => ({
        id: x.f.id, nombre: `${x.f.nombres} ${x.f.apellido_paterno}`, grado: x.f.grado,
        planta: x.f.planta, causal: x.e.causal, aneiich: Boolean(x.f.asociado_aneiich),
      })),
      por_causal: Object.entries(noCalificables.reduce((acc, x) => {
        const c = x.e.causal ?? 'Sin causal'
        acc[c] = (acc[c] ?? 0) + 1
        return acc
      }, {})).map(([causal, n]) => ({ causal, n })).sort((a, b) => b.n - a.n),
    },
    promedios_por_estamento: idPeriodo ? promedios(idPeriodo, 'f.planta') : [],
    promedios_por_unidad: idPeriodo ? promedios(idPeriodo, 'u.nombre').slice(0, 12) : [],
    promedios_por_region: idPeriodo ? promedios(idPeriodo, 'COALESCE(u.region, \'Sin región\')') : [],
    promedios_por_grado: idPeriodo ? promedios(idPeriodo, 'f.grado') : [],
    promedios_por_calidad: idPeriodo ? promedios(idPeriodo, 'f.calidad_juridica') : [],
    promedios_por_anio: porAnio,
    estamento_por_anio: porEstamentoAnio,
    notas_subfactor: Object.entries(notasSubfactor).map(([clave, v]) => ({
      clave, subfactor: v.nombre, factor: v.factor, n: v.n, promedio: v.n ? n2(v.suma / v.n) : null,
    })),
    notas_factor: Object.entries(notasFactor).map(([clave, v]) => ({
      clave, factor: v.nombre, n: v.n, promedio: v.n ? n2(v.suma / v.n) : null,
      coeficiente_directivos: COEFICIENTES.Directivos[clave],
    })),
    distribucion_puntajes: distribucionPuntajes,
    comparativa_aneiich: comparativaAneiich,
    composicion: {
      por_estamento: all('SELECT planta AS estamento, COUNT(*) AS n FROM funcionarios GROUP BY planta ORDER BY n DESC'),
      por_calidad: all('SELECT calidad_juridica AS calidad, COUNT(*) AS n FROM funcionarios GROUP BY calidad ORDER BY n DESC'),
      por_grado: all('SELECT grado, COUNT(*) AS n FROM funcionarios GROUP BY grado ORDER BY grado'),
      por_unidad: all(`SELECT u.nombre AS unidad, u.tipo, COUNT(f.id) AS n,
          SUM(CASE WHEN f.asociado_aneiich = 1 THEN 1 ELSE 0 END) AS aneiich
        FROM unidades u LEFT JOIN funcionarios f ON f.unidad_id = u.id GROUP BY u.id HAVING n > 0 ORDER BY n DESC`),
      por_region: all(`SELECT COALESCE(u.region, 'Sin región') AS region, COUNT(*) AS n FROM funcionarios f
        LEFT JOIN unidades u ON u.id = f.unidad_id GROUP BY region ORDER BY n DESC`),
    },
    aneiich: {
      total: dotacion.aneiich,
      porcentaje: dotacion.total ? n2((dotacion.aneiich / dotacion.total) * 100) : 0,
      por_rol: all(`SELECT COALESCE(rol_aneiich,'Socio') AS rol, COUNT(*) AS n FROM funcionarios
        WHERE asociado_aneiich = 1 GROUP BY rol ORDER BY n DESC`),
      por_estamento: all(`SELECT planta AS estamento, COUNT(*) AS n FROM funcionarios
        WHERE asociado_aneiich = 1 GROUP BY planta ORDER BY n DESC`),
      por_unidad: all(`SELECT u.nombre AS unidad, COUNT(*) AS n FROM funcionarios f LEFT JOIN unidades u ON u.id = f.unidad_id
        WHERE f.asociado_aneiich = 1 GROUP BY u.nombre ORDER BY n DESC LIMIT 10`),
      dirigentes: all(`SELECT id, (nombres || ' ' || apellido_paterno || ' ' || COALESCE(apellido_materno,'')) AS nombre,
          cargo, grado, planta, rol_aneiich, es_dirigente_asociacion, es_delegado_personal, solicita_ser_calificado
        FROM funcionarios WHERE es_dirigente_asociacion = 1 OR es_delegado_personal = 1 ORDER BY apellido_paterno`),
    },
    plazos,
    jefaturas,
    pendientes,
    destacados: idPeriodo ? {
      lista1: all(`SELECT c.id, c.puntaje, c.lista, (f.nombres || ' ' || f.apellido_paterno) AS funcionario, f.grado, f.planta,
          f.asociado_aneiich, u.nombre AS unidad
        FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id LEFT JOIN unidades u ON u.id = f.unidad_id
        WHERE c.periodo_id = ? AND c.lista = 1 ORDER BY c.puntaje DESC LIMIT 8`, [idPeriodo]),
      criticos: all(`SELECT c.id, c.puntaje, c.lista, (f.nombres || ' ' || f.apellido_paterno) AS funcionario, f.grado, f.planta,
          c.situacion_final, u.nombre AS unidad
        FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id LEFT JOIN unidades u ON u.id = f.unidad_id
        WHERE c.periodo_id = ? AND c.lista IN (3,4) ORDER BY c.puntaje ASC LIMIT 10`, [idPeriodo]),
    } : { lista1: [], criticos: [] },
    tasas: {
      precalificacion: fichas.fichas ? n2(((fichas.precalificados + fichas.en_junta + fichas.calificados + fichas.apelaciones + fichas.ejecutoriados) / fichas.fichas) * 100) : 0,
      calificacion: fichas.fichas ? n2(((fichas.calificados + fichas.apelaciones + fichas.ejecutoriados) / fichas.fichas) * 100) : 0,
      distincion: fichas.fichas ? n2(((fichas.lista1 ?? 0) / Math.max(1, (fichas.lista1 ?? 0) + (fichas.lista2 ?? 0) + (fichas.lista3 ?? 0) + (fichas.lista4 ?? 0))) * 100) : 0,
    },
    normas: {
      periodo: 'Art. 3: el período de calificación comprende doce meses, del 1 de septiembre al 31 de agosto del año siguiente; el proceso se inicia el 1 de septiembre y termina a más tardar el 30 de noviembre.',
      listas: 'Art. 15: Lista N°1 de Distinción de 81,00 a 100 puntos; Lista N°2 Buena de 46,00 a 80,99; Lista N°3 Condicional de 30,00 a 45,99; Lista N°4 de Eliminación de 10,00 a 29,99.',
      votacion: 'Art. 30: los acuerdos de la Junta se adoptan por mayoría de votos; en caso de empate decide el voto del presidente. Las deliberaciones y votaciones son confidenciales.',
      efectos: 'Art. 37: el funcionario calificado en Lista N°4 o por dos años consecutivos en Lista N°3 debe retirarse del servicio dentro de los 15 días hábiles siguientes.',
    },
  })
}))

/* ── Comparativo entre períodos ─────────────────────────────────────────── */
r.get('/dashboard/comparativo', env((req, res) => {
  const anios = all('SELECT * FROM periodos ORDER BY anio')
  const datos = anios.map((p) => {
    const g = get(`SELECT COUNT(*) AS calificados, ROUND(AVG(puntaje),2) AS promedio,
        SUM(CASE WHEN lista=1 THEN 1 ELSE 0 END) AS lista1, SUM(CASE WHEN lista=2 THEN 1 ELSE 0 END) AS lista2,
        SUM(CASE WHEN lista=3 THEN 1 ELSE 0 END) AS lista3, SUM(CASE WHEN lista=4 THEN 1 ELSE 0 END) AS lista4
      FROM calificaciones WHERE periodo_id = ? AND puntaje IS NOT NULL`, [p.id])
    return { periodo: p.anio, ...g }
  })
  res.json({ datos })
}))

/* ── Exportaciones ──────────────────────────────────────────────────────── */
r.get('/reportes/estamentos.csv', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const datos = promedios(periodo?.id, 'f.planta')
  res.type('text/csv; charset=utf-8').send(aCSV(datos, [
    { clave: 'clave', titulo: 'Estamento' }, { clave: 'n', titulo: 'Funcionarios calificados' },
    { clave: 'promedio', titulo: 'Puntaje promedio' }, { clave: 'minimo', titulo: 'Puntaje mínimo' },
    { clave: 'maximo', titulo: 'Puntaje máximo' }, { clave: 'lista1', titulo: 'Lista N°1' },
    { clave: 'lista2', titulo: 'Lista N°2' }, { clave: 'lista3', titulo: 'Lista N°3' }, { clave: 'lista4', titulo: 'Lista N°4' },
    { clave: 'promedio_aneiich', titulo: 'Promedio asociados ANEIICH' },
    { clave: 'promedio_no_aneiich', titulo: 'Promedio no asociados' },
  ]))
}))

r.get('/reportes/unidades.csv', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const datos = promedios(periodo?.id, "u.nombre || ' (' || COALESCE(u.region,'') || ')'")
  res.type('text/csv; charset=utf-8').send(aCSV(datos, [
    { clave: 'clave', titulo: 'Unidad' }, { clave: 'n', titulo: 'Funcionarios calificados' },
    { clave: 'promedio', titulo: 'Puntaje promedio' }, { clave: 'lista1', titulo: 'Lista N°1' },
    { clave: 'lista2', titulo: 'Lista N°2' }, { clave: 'lista3', titulo: 'Lista N°3' }, { clave: 'lista4', titulo: 'Lista N°4' },
  ]))
}))

r.get('/reportes/aneiich.csv', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const datos = all(`SELECT f.rut, f.nombres, f.apellido_paterno, f.apellido_materno, f.cargo, f.grado, f.planta,
      f.rol_aneiich, f.fecha_afiliacion, f.es_dirigente_asociacion, f.es_delegado_personal, f.solicita_ser_calificado,
      u.nombre AS unidad, u.region, c.puntaje, c.lista, c.estado
    FROM funcionarios f LEFT JOIN unidades u ON u.id = f.unidad_id
    LEFT JOIN calificaciones c ON c.funcionario_id = f.id AND c.periodo_id = ?
    WHERE f.asociado_aneiich = 1 ORDER BY f.apellido_paterno`, [periodo?.id ?? null])
  res.type('text/csv; charset=utf-8').send(aCSV(datos, [
    { clave: 'rut', titulo: 'RUT' }, { clave: 'nombres', titulo: 'Nombres' },
    { clave: 'apellido_paterno', titulo: 'Apellido paterno' }, { clave: 'apellido_materno', titulo: 'Apellido materno' },
    { clave: 'cargo', titulo: 'Cargo' }, { clave: 'grado', titulo: 'Grado' }, { clave: 'planta', titulo: 'Estamento' },
    { clave: 'unidad', titulo: 'Unidad' }, { clave: 'region', titulo: 'Región' },
    { clave: 'rol_aneiich', titulo: 'Rol ANEIICH' }, { clave: 'fecha_afiliacion', titulo: 'Afiliación' },
    { clave: 'es_dirigente_asociacion', titulo: 'Dirigente', valor: (f) => (f.es_dirigente_asociacion ? 'SI' : 'NO') },
    { clave: 'es_delegado_personal', titulo: 'Delegado del personal', valor: (f) => (f.es_delegado_personal ? 'SI' : 'NO') },
    { clave: 'solicita_ser_calificado', titulo: 'Solicitó ser calificado', valor: (f) => (f.solicita_ser_calificado ? 'SI' : 'NO') },
    { clave: 'puntaje', titulo: 'Puntaje' }, { clave: 'lista', titulo: 'Lista' }, { clave: 'estado', titulo: 'Estado del proceso' },
  ]))
}))

r.get('/reportes/hoja-vida.csv', env((req, res) => {
  const datos = all(`SELECT f.rut, (f.nombres || ' ' || f.apellido_paterno || ' ' || COALESCE(f.apellido_materno,'')) AS funcionario,
      f.grado, f.planta, f.asociado_aneiich, h.tipo, h.fecha, h.categoria, h.descripcion, h.emitida_por_nombre,
      h.notificada_fecha, h.resolucion, h.resolucion_fecha, h.copia_asociacion, p.anio
    FROM hoja_vida h JOIN funcionarios f ON f.id = h.funcionario_id
    LEFT JOIN periodos p ON p.id = h.periodo_id
    WHERE (? IS NULL OR h.periodo_id = ?) ORDER BY h.fecha DESC`, [req.query.periodo ?? null, req.query.periodo ?? null])
  res.type('text/csv; charset=utf-8').send(aCSV(datos, [
    { clave: 'rut', titulo: 'RUT' }, { clave: 'funcionario', titulo: 'Funcionario' },
    { clave: 'grado', titulo: 'Grado' }, { clave: 'planta', titulo: 'Estamento' },
    { clave: 'asociado_aneiich', titulo: 'ANEIICH', valor: (f) => (f.asociado_aneiich ? 'SI' : 'NO') },
    { clave: 'anio', titulo: 'Período' }, { clave: 'tipo', titulo: 'Tipo' }, { clave: 'fecha', titulo: 'Fecha' },
    { clave: 'categoria', titulo: 'Categoría' }, { clave: 'descripcion', titulo: 'Descripción' },
    { clave: 'emitida_por_nombre', titulo: 'Dispuesta por' }, { clave: 'notificada_fecha', titulo: 'Notificación' },
    { clave: 'resolucion', titulo: 'Resolución' }, { clave: 'resolucion_fecha', titulo: 'Fecha resolución' },
    { clave: 'copia_asociacion', titulo: 'Copia a la asociación', valor: (f) => (f.copia_asociacion ? 'SI' : 'NO') },
  ]))
}))

export default r
