import { Router } from 'express'
import {
  all, get, insertar, actualizar, eliminar, run, auditar, transaccion, config,
} from '../db.js'
import {
  FACTORES, SUBFACTORES, subfactorPorClave, calcular, agregarVotos, listaDePuntaje, conceptoDeNota,
  evaluarCalificabilidad, situacionPorLista, informesDelPeriodo, redondear2, COEFICIENTES,
} from '../dominio.js'
import { env, aBool, periodoVigente } from './meta.js'
import { SQL_LISTADO } from './funcionarios.js'
import { aCSV } from '../csv.js'

const r = Router()

const parseJson = (txt) => {
  if (!txt) return null
  try { return JSON.parse(txt) } catch { return null }
}

/* ── Listado de calificaciones del período ───────────────────────────────── */
r.get('/calificaciones', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  if (!periodo) return res.json({ periodo: null, datos: [], resumen: {} })
  const where = ['c.periodo_id = ?']
  const params = [periodo.id]
  if (req.query.estado) { where.push('c.estado = ?'); params.push(req.query.estado) }
  if (req.query.lista) { where.push('c.lista = ?'); params.push(Number(req.query.lista)) }
  if (req.query.planta) { where.push('f.planta = ?'); params.push(req.query.planta) }
  if (req.query.unidad) { where.push('f.unidad_id = ?'); params.push(req.query.unidad) }
  if (req.query.aneiich === '1') where.push('f.asociado_aneiich = 1')
  if (req.query.jefe) { where.push('c.precal_jefe_id = ?'); params.push(req.query.jefe) }
  if (req.query.buscar) {
    where.push(`(f.rut LIKE ? OR (f.nombres || ' ' || f.apellido_paterno || ' ' || COALESCE(f.apellido_materno,'')) LIKE ?)`)
    params.push(`%${req.query.buscar}%`, `%${req.query.buscar}%`)
  }
  if (req.query.pendientes === '1') where.push("c.estado IN ('Borrador','Informes de desempeño','Precalificado','En junta')")
  const condicion = ` WHERE ${where.join(' AND ')}`

  const datos = all(`SELECT c.id, c.funcionario_id, c.periodo_id, c.junta_id, c.planta_aplicada, c.estado, c.puntaje,
      c.lista, c.escala_numero, c.precal_efectuada, c.precal_fecha, c.precal_jefe_nombre, c.cal_fecha_sesion,
      c.acta_numero, c.notificada_fecha, c.ejecutoriada_fecha, c.situacion_final, c.cal_observaciones,
      f.rut, f.nombres, f.apellido_paterno, f.apellido_materno, f.cargo, f.grado, f.planta,
      f.calidad_juridica, f.asociado_aneiich, f.rol_aneiich, f.unidad_id, f.jefe_id,
      u.nombre AS unidad_nombre, u.region,
      (SELECT COUNT(*) FROM votos_subfactor v WHERE v.calificacion_id = c.id) AS votos_registrados
    FROM calificaciones c
    JOIN funcionarios f ON f.id = c.funcionario_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    ${condicion}
    ORDER BY f.apellido_paterno, f.nombres`, params)

  const pendientesDePuntaje = datos.filter((d) => d.puntaje === null).map((d) => d.id)
  const proyecciones = new Map()
  if (pendientesDePuntaje.length) {
    const filas = all(`SELECT id, precal_json, cal_json, planta_aplicada FROM calificaciones
      WHERE id IN (${pendientesDePuntaje.map(() => '?').join(',')})`, pendientesDePuntaje)
    for (const fila of filas) {
      const notasJunta = parseJson(fila.cal_json)?.subfactores ?? null
      const notasPrecal = parseJson(fila.precal_json)?.subfactores ?? null
      const calculo = notasJunta ? calcular(fila.planta_aplicada, notasJunta)
        : notasPrecal ? calcular(fila.planta_aplicada, notasPrecal) : null
      if (calculo) proyecciones.set(fila.id, { calculo, fuente: notasJunta ? 'junta' : 'precalificacion' })
    }
  }

  res.json({
    periodo,
    datos: datos.map((d) => {
      const proyeccion = proyecciones.get(d.id) ?? null
      return {
        ...d,
        nombre_completo: `${d.nombres} ${d.apellido_paterno}${d.apellido_materno ? ` ${d.apellido_materno}` : ''}`,
        aneiich: Boolean(d.asociado_aneiich),
        con_votacion: d.votos_registrados > 0,
        votos_esperados: SUBFACTORES.length * 6,
        puntaje_calculado: d.puntaje ?? proyeccion?.calculo?.puntaje ?? null,
        lista_calculada: d.lista ?? proyeccion?.calculo?.lista ?? null,
        fuente_calculo: d.puntaje !== null ? 'junta' : (proyeccion?.fuente ?? null),
      }
    }),
    resumen: get(`SELECT COUNT(*) AS fichas,
        SUM(CASE WHEN c.estado = 'Ejecutoriado' THEN 1 ELSE 0 END) AS ejecutoriadas,
        SUM(CASE WHEN c.estado = 'Calificado' THEN 1 ELSE 0 END) AS calificadas,
        SUM(CASE WHEN c.estado = 'En junta' THEN 1 ELSE 0 END) AS en_junta,
        SUM(CASE WHEN c.estado = 'Precalificado' THEN 1 ELSE 0 END) AS precalificadas,
        SUM(CASE WHEN c.estado = 'Borrador' THEN 1 ELSE 0 END) AS borradores,
        SUM(CASE WHEN c.estado = 'Apelación' THEN 1 ELSE 0 END) AS apelaciones,
        SUM(CASE WHEN c.lista = 1 THEN 1 ELSE 0 END) AS lista1,
        SUM(CASE WHEN c.lista = 2 THEN 1 ELSE 0 END) AS lista2,
        SUM(CASE WHEN c.lista = 3 THEN 1 ELSE 0 END) AS lista3,
        SUM(CASE WHEN c.lista = 4 THEN 1 ELSE 0 END) AS lista4,
        ROUND(AVG(c.puntaje), 2) AS promedio
      FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id ${condicion}`, params),
  })
}))

/* ── Generación de fichas del período ───────────────────────────────────── */
r.post('/calificaciones/generar', env((req, res) => {
  const periodo = req.body?.periodo_id ? get('SELECT * FROM periodos WHERE id = ?', [req.body.periodo_id]) : periodoVigente()
  if (!periodo) throw new Error('Debe crear y seleccionar un período de calificación.')
  const jefeSuperiorNombre = config.leer('jefe_superior_nombre', 'Jefe Superior')
  const resultado = { creadas: 0, existentes: 0, no_calificables: [], omitidas: 0 }
  transaccion(() => {
    for (const f of all("SELECT * FROM funcionarios WHERE estado <> 'Finiquitado'")) {
      const eleg = evaluarCalificabilidad(f, periodo)
      if (!eleg.calificable) {
        resultado.no_calificables.push({ id: f.id, nombre: `${f.nombres} ${f.apellido_paterno}`, causal: eleg.causal })
        continue
      }
      if (get('SELECT id FROM calificaciones WHERE funcionario_id = ? AND periodo_id = ?', [f.id, periodo.id])) {
        resultado.existentes++
        continue
      }
      const jefe = f.jefe_id ? get('SELECT * FROM funcionarios WHERE id = ?', [f.jefe_id]) : null
      insertar('calificaciones', {
        funcionario_id: f.id,
        periodo_id: periodo.id,
        planta_aplicada: f.planta,
        estado: 'Borrador',
        precal_jefe_id: jefe?.id ?? null,
        precal_jefe_nombre: jefe ? `${jefe.nombres} ${jefe.apellido_paterno} ${jefe.apellido_materno ?? ''}`.trim() : null,
        precal_jefe_cargo: jefe?.cargo ?? null,
        precal_jefe_desde: periodo.fecha_inicio,
        precal_jefe_hasta: periodo.fecha_termino,
        creado_en: new Date().toISOString(),
      })
      resultado.creadas++
    }
  })
  auditar('Genera fichas de calificación', 'calificaciones', periodo.id, `${resultado.creadas} fichas creadas en el período ${periodo.anio}`)
  // Se registran las exclusiones del art. 5 para respaldo
  for (const nc of resultado.no_calificables) {
    run(`INSERT INTO auditoria (fecha, accion, entidad, entidad_id, detalle, usuario)
         VALUES (?, 'Exclusión de calificación (art. 5)', 'funcionarios', ?, ?, ?)`,
    [new Date().toISOString(), nc.id, `${nc.nombre}: ${nc.causal}`, 'Sistema'])
  }
  res.json({ periodo, ...resultado, total_no_calificables: resultado.no_calificables.length })
}))

r.post('/calificaciones', env((req, res) => {
  const f = get('SELECT * FROM funcionarios WHERE id = ?', [req.body?.funcionario_id])
  const periodo = get('SELECT * FROM periodos WHERE id = ?', [req.body?.periodo_id])
  if (!f || !periodo) throw new Error('Funcionario y período son obligatorios.')
  if (get('SELECT id FROM calificaciones WHERE funcionario_id = ? AND periodo_id = ?', [f.id, periodo.id])) {
    throw new Error('El funcionario ya tiene una ficha de calificación en ese período.')
  }
  const jefe = f.jefe_id ? get('SELECT * FROM funcionarios WHERE id = ?', [f.jefe_id]) : null
  const cal = insertar('calificaciones', {
    funcionario_id: f.id, periodo_id: periodo.id, planta_aplicada: req.body?.planta_aplicada || f.planta,
    estado: 'Borrador',
    precal_jefe_id: jefe?.id ?? null,
    precal_jefe_nombre: jefe ? `${jefe.nombres} ${jefe.apellido_paterno} ${jefe.apellido_materno ?? ''}`.trim() : null,
    precal_jefe_cargo: jefe?.cargo ?? null,
    precal_jefe_desde: periodo.fecha_inicio, precal_jefe_hasta: periodo.fecha_termino,
    creado_en: new Date().toISOString(),
  })
  res.json(cal)
}))

/* ── Ficha única por funcionario: todo el detalle en un solo lugar ───────── */
r.get('/calificaciones/:id', env((req, res) => {
  const cal = get(`SELECT c.*, f.rut, f.nombres, f.apellido_paterno, f.apellido_materno, f.cargo AS cargo_funcionario,
      f.grado, f.planta, f.calidad_juridica, f.asociado_aneiich, f.rol_aneiich, f.unidad_id, f.jefe_id,
      f.fecha_ingreso_servicio, f.fecha_ingreso_grado, u.nombre AS unidad_nombre, u.region,
      p.anio, p.fecha_inicio, p.fecha_termino, p.fecha_limite_calificaciones, p.fecha_constitucion_junta, p.estado AS periodo_estado
    FROM calificaciones c
    JOIN funcionarios f ON f.id = c.funcionario_id
    JOIN periodos p ON p.id = c.periodo_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    WHERE c.id = ?`, [req.params.id])
  if (!cal) throw new Error('Ficha de calificación no encontrada')

  const funcionario = get('SELECT * FROM funcionarios WHERE id = ?', [cal.funcionario_id])
  const periodo = get('SELECT * FROM periodos WHERE id = ?', [cal.periodo_id])
  const precalJson = parseJson(cal.precal_json) ?? {}
  const calJson = parseJson(cal.cal_json) ?? {}
  const plantaAplicada = cal.planta_aplicada || cal.planta

  // Junta calificadora y sus integrantes
  const junta = cal.junta_id
    ? get('SELECT * FROM juntas WHERE id = ?', [cal.junta_id])
    : get('SELECT * FROM juntas WHERE periodo_id = ? ORDER BY id LIMIT 1', [cal.periodo_id])
  const integrantes = junta
    ? all('SELECT * FROM junta_integrantes WHERE junta_id = ? ORDER BY orden, id', [junta.id])
    : []
  const votos = all(`SELECT v.*, i.rol AS integrante_rol, i.orden AS integrante_orden
    FROM votos_subfactor v LEFT JOIN junta_integrantes i ON i.id = v.integrante_id
    WHERE v.calificacion_id = ?`, [cal.id])

  const notasPrecal = precalJson.subfactores ?? {}
  const notasAcuerdo = calJson.subfactores ?? {}
  const hayVotos = votos.length > 0

  const subfactores = SUBFACTORES.map((s) => {
    const votosSub = votos
      .filter((v) => v.subfactor_clave === s.clave)
      .sort((a, b) => (a.integrante_orden ?? 99) - (b.integrante_orden ?? 99))
      .map((v) => ({
        id: v.id, integrante_id: v.integrante_id, votante: v.votante_nombre, rol: v.integrante_rol ?? v.votante_rol,
        nota: v.nota, argumento: v.argumento, criterio: v.criterio,
        derecho_a_voto: integrantes.find((i) => i.id === v.integrante_id)?.derecho_a_voto ?? 1,
      }))
    const agregado = agregarVotos(votosSub.filter((v) => v.derecho_a_voto), integrantes)
    const notaRegistrada = notasAcuerdo[s.clave] ?? notasPrecal[s.clave] ?? null
    const notaFinal = agregado.nota ?? notasAcuerdo[s.clave] ?? null
    return {
      ...s,
      precalificacion: notasPrecal[s.clave] ?? null,
      nota_acuerdo: notasAcuerdo[s.clave] ?? null,
      nota_junta: notaFinal,
      nota_calculada: agregado.nota,
      agregado,
      concepto: conceptoDeNota(notaFinal),
      votos: votosSub,
      integrantes_sin_voto: integrantes.filter((i) => i.derecho_a_voto && !votosSub.some((v) => v.integrante_id === i.id)),
    }
  })

  const notasParaCalculo = Object.fromEntries(subfactores.map((s) => [s.clave, s.nota_junta ?? s.precalificacion]).filter(([, n]) => typeof n === 'number'))
  const calculo = calcular(plantaAplicada, notasParaCalculo)
  const calculoPrecal = calcular(plantaAplicada, notasPrecal)
  const calculoJunta = Object.keys(notasAcuerdo).length ? calcular(plantaAplicada, notasAcuerdo) : null

  const factores = FACTORES.map((f) => ({
    ...f,
    subfactores: subfactores.filter((s) => s.factor === f.clave),
    nota: calculo.factores[f.clave]?.nota ?? null,
    coeficiente: calculo.factores[f.clave]?.coeficiente ?? 0,
    puntos: calculo.factores[f.clave]?.puntos ?? null,
    argumento_precalificacion: precalJson.factores?.[f.clave]?.argumento ?? null,
    argumento_junta: calJson.factores?.[f.clave]?.argumento ?? null,
    concepto: conceptoDeNota(calculo.factores[f.clave]?.nota),
  }))

  const eleg = evaluarCalificabilidad(funcionario, periodo)
  const escala = get(`SELECT COUNT(*) + 1 AS lugar FROM calificaciones c2
    JOIN funcionarios f2 ON f2.id = c2.funcionario_id
    WHERE c2.periodo_id = ? AND f2.grado = ? AND c2.puntaje > COALESCE(?, 0)`,
  [cal.periodo_id, cal.grado, cal.puntaje])?.lugar ?? null

  res.json({
    calificacion: {
      ...cal, precal_json: precalJson, cal_json: calJson,
    },
    funcionario,
    funcionario_nombre: `${cal.nombres} ${cal.apellido_paterno}${cal.apellido_materno ? ` ${cal.apellido_materno}` : ''}`,
    aneiich: Boolean(cal.asociado_aneiich),
    periodo,
    junta: junta ? { ...junta, integrantes } : null,
    integrantes,
    planta_aplicada: plantaAplicada,
    coeficientes: COEFICIENTES[plantaAplicada] ?? COEFICIENTES.Administrativos,
    factores,
    subfactores,
    calculo,
    calculo_precalificacion: calculoPrecal,
    calculo_junta: calculoJunta,
    hay_votos: hayVotos,
    elegibilidad: eleg,
    escala_lugar: escala,
    situacion_final: cal.lista ? situacionPorLista(cal.lista, all(`SELECT c.lista FROM calificaciones c JOIN periodos p ON p.id = c.periodo_id
      WHERE c.funcionario_id = ? AND p.anio < ? ORDER BY p.anio DESC LIMIT 1`, [cal.funcionario_id, cal.anio]).map((x) => x.lista)) : null,
    apelaciones: all('SELECT * FROM apelaciones WHERE calificacion_id = ? ORDER BY fecha', [cal.id]),
    hoja_vida: all('SELECT * FROM hoja_vida WHERE funcionario_id = ? AND (periodo_id = ? OR periodo_id IS NULL) ORDER BY tipo DESC, fecha',
      [cal.funcionario_id, cal.periodo_id]),
    informes: all('SELECT * FROM informes_desempeno WHERE funcionario_id = ? AND periodo_id = ? ORDER BY numero', [cal.funcionario_id, cal.periodo_id]),
    historial: all(`SELECT c2.id, p.anio, c2.puntaje, c2.lista, c2.estado, c2.acta_numero, c2.escala_numero
      FROM calificaciones c2 JOIN periodos p ON p.id = c2.periodo_id
      WHERE c2.funcionario_id = ? AND c2.id <> ? ORDER BY p.anio DESC`, [cal.funcionario_id, cal.id]),
    jefe_directo: cal.precal_jefe_id ? get('SELECT * FROM funcionarios WHERE id = ?', [cal.precal_jefe_id]) : null,
    dependientes_del_jefe: cal.precal_jefe_id
      ? all('SELECT id, nombres, apellido_paterno, apellido_materno, cargo FROM funcionarios WHERE jefe_id = ?', [cal.precal_jefe_id])
      : [],
  })
}))

/* ── Precalificación del jefe directo (arts. 19 y 20) ───────────────────── */
r.put('/calificaciones/:id/precalificacion', env((req, res) => {
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [req.params.id])
  if (!cal) throw new Error('Ficha no encontrada')
  const funcionario = get('SELECT * FROM funcionarios WHERE id = ?', [cal.funcionario_id])
  const b = req.body ?? {}
  const notas = b.notas ?? {}
  const argumentos = b.argumentos ?? {}

  // Validación de notas de subfactor: enteros de 1 a 10 (art. 14)
  for (const s of SUBFACTORES) {
    const n = notas[s.clave]
    if (n === null || n === undefined || n === '') continue
    const v = Number(n)
    if (!Number.isInteger(v) || v < 1 || v > 10) {
      throw new Error(`La nota del subfactor "${s.nombre}" debe ser un número entero entre 1 y 10 (art. 14).`)
    }
  }
  const faltantes = SUBFACTORES.filter((s) => notas[s.clave] === null || notas[s.clave] === undefined || notas[s.clave] === '')
  if (b.exigir_completo !== false && faltantes.length) {
    throw new Error(`Faltan notas en ${faltantes.length} subfactor(es): ${faltantes.map((s) => s.nombre).join(', ')}.`)
  }
  const sinArgumento = FACTORES.filter((f) => !String(argumentos[f.clave] ?? '').trim())
  if (b.exigir_completo !== false && sinArgumento.length) {
    throw new Error(`La calificación debe ser fundada: falta el argumento del factor ${sinArgumento.map((f) => f.nombre).join(', ')} (art. 29).`)
  }
  const jefe = b.jefe_id ? get('SELECT * FROM funcionarios WHERE id = ?', [b.jefe_id]) : null
  const jefeNombre = jefe ? `${jefe.nombres} ${jefe.apellido_paterno} ${jefe.apellido_materno ?? ''}`.trim() : b.precal_jefe_nombre
  const json = {
    factores: Object.fromEntries(FACTORES.map((f) => [f.clave, { argumento: argumentos[f.clave] ?? '' }])),
    subfactores: Object.fromEntries(SUBFACTORES.map((s) => [s.clave, notas[s.clave] === '' || notas[s.clave] === undefined ? null : Number(notas[s.clave])])),
  }
  const calc = calcular(cal.planta_aplicada, json.subfactores)
  const actualizada = actualizar('calificaciones', cal.id, {
    precal_efectuada: 1,
    precal_jefe_id: jefe?.id ?? cal.precal_jefe_id ?? funcionario.jefe_id,
    precal_jefe_nombre: jefeNombre || 'Jefatura Directa',
    precal_jefe_cargo: jefe?.cargo ?? cal.precal_jefe_cargo ?? b.precal_jefe_cargo,
    precal_jefe_otro_nombre: b.precal_jefe_otro_nombre ?? cal.precal_jefe_otro_nombre,
    precal_jefe_desde: b.precal_jefe_desde ?? cal.precal_jefe_desde,
    precal_jefe_hasta: b.precal_jefe_hasta ?? cal.precal_jefe_hasta,
    precal_fecha: b.precal_fecha || new Date().toISOString().slice(0, 10),
    precal_notificada_fecha: b.precal_notificada_fecha ?? cal.precal_notificada_fecha,
    precal_observaciones: b.precal_observaciones ?? cal.precal_observaciones,
    precal_obs_funcionario: b.precal_obs_funcionario ?? cal.precal_obs_funcionario,
    precal_obs_fecha: b.precal_obs_fecha ?? cal.precal_obs_fecha,
    precal_json: JSON.stringify(json),
    estado: cal.estado === 'Borrador' || cal.estado === 'Informes de desempeño' ? 'Precalificado' : cal.estado,
    actualizado_en: new Date().toISOString(),
  })
  auditar('Registra precalificación', 'calificaciones', cal.id, `${jefeNombre ?? 'Jefe'} — puntaje proyectado ${calc.puntaje}`)
  res.json({ ok: true, calificacion: actualizada, calculo: calc })
}))

/* ── Votación de la junta por subfactor (arts. 29 y 30) ─────────────────── */
r.put('/calificaciones/:id/votos', env((req, res) => {
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [req.params.id])
  if (!cal) throw new Error('Ficha no encontrada')
  const lista = Array.isArray(req.body?.votos) ? req.body.votos : [req.body]
  let guardados = 0
  transaccion(() => {
    for (const v of lista) {
      if (!v?.subfactor_clave) throw new Error('Cada voto debe indicar el subfactor.')
      const sub = subfactorPorClave(v.subfactor_clave)
      if (!sub) throw new Error(`Subfactor desconocido: ${v.subfactor_clave}`)
      const nota = v.nota === '' || v.nota === null || v.nota === undefined ? null : Number(v.nota)
      if (nota !== null && (!Number.isInteger(nota) || nota < 1 || nota > 10)) {
        throw new Error(`La nota votada en "${sub.nombre}" debe ser un entero entre 1 y 10 (art. 14).`)
      }
      const integrante = v.integrante_id ? get('SELECT * FROM junta_integrantes WHERE id = ?', [v.integrante_id]) : null
      if (!integrante && !v.votante_nombre) throw new Error('Debe indicar el integrante de la junta que emite el voto.')
      const existente = get('SELECT id FROM votos_subfactor WHERE calificacion_id = ? AND subfactor_clave = ? AND integrante_id IS ?',
        [cal.id, v.subfactor_clave, integrante?.id ?? null])
      const datos = {
        calificacion_id: cal.id,
        subfactor_clave: v.subfactor_clave,
        integrante_id: integrante?.id ?? null,
        votante_nombre: integrante?.nombre ?? v.votante_nombre,
        votante_rol: integrante?.rol ?? v.votante_rol ?? 'Integrante',
        criterio: v.criterio || (nota === null ? 'Se abstiene' : 'Fija nota'),
        nota,
        argumento: v.argumento ?? null,
      }
      if (existente) actualizar('votos_subfactor', existente.id, datos)
      else insertar('votos_subfactor', { ...datos, creado_en: new Date().toISOString() })
      guardados++
    }
  })
  auditar('Registra votación de la junta', 'calificaciones', cal.id, `${guardados} voto(s)`)
  res.json({ ok: true, guardados, detalle: recomputarAcuerdo(cal.id) })
}))

r.delete('/votos/:id', env((req, res) => {
  const v = get('SELECT * FROM votos_subfactor WHERE id = ?', [req.params.id])
  if (!v) throw new Error('Voto no encontrado')
  eliminar('votos_subfactor', v.id)
  auditar('Elimina voto de la junta', 'calificaciones', v.calificacion_id, `${v.votante_nombre} — ${v.subfactor_clave}`)
  res.json({ ok: true, detalle: recomputarAcuerdo(v.calificacion_id) })
}))

/**
 * Consolida la votación en las notas de acuerdo de la ficha.
 * Si la junta votó un subfactor, la nota acordada es la que resulta de la votación
 * (mayoría y, en caso de empate, voto del presidente — art. 30).
 */
function recomputarAcuerdo(calificacionId) {
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [calificacionId])
  if (!cal) return null
  const junta = cal.junta_id ? get('SELECT * FROM juntas WHERE id = ?', [cal.junta_id]) : null
  const integrantes = junta ? all('SELECT * FROM junta_integrantes WHERE junta_id = ? ORDER BY orden', [junta.id]) : []
  const votos = all('SELECT * FROM votos_subfactor WHERE calificacion_id = ?', [cal.id])
  const precalJson = parseJson(cal.precal_json) ?? {}
  const calJson = parseJson(cal.cal_json) ?? {}
  const notas = {}
  const detalle = {}
  for (const s of SUBFACTORES) {
    const votosSub = votos.filter((v) => v.subfactor_clave === s.clave)
      .filter((v) => (integrantes.find((i) => i.id === v.integrante_id)?.derecho_a_voto ?? 1) === 1)
    const ag = agregarVotos(votosSub, integrantes)
    const manual = calJson.subfactores?.[s.clave]
    const valor = ag.nota ?? manual ?? null
    if (valor !== null) notas[s.clave] = valor
    detalle[s.clave] = ag
  }
  const calc = calcular(cal.planta_aplicada, notas)
  const manualExistente = calJson.subfactores ?? {}
  const discrepancias = SUBFACTORES
    .filter((s) => detalle[s.clave].nota !== null && manualExistente[s.clave] !== undefined && manualExistente[s.clave] !== detalle[s.clave].nota)
    .map((s) => ({ subfactor: s.nombre, votada: detalle[s.clave].nota, registrada: manualExistente[s.clave] }))
  actualizar('calificaciones', cal.id, {
    cal_json: JSON.stringify({ ...calJson, subfactores: notas, factores: calJson.factores ?? {}, resultado: { puntaje: calc.puntaje, lista: calc.lista } }),
    puntaje: calc.puntaje,
    lista: calc.lista,
  })
  return { notas, detalle, calculo: calc, discrepancias }
}

/* ── Acuerdo de la junta: notas, argumentos y cierre de la calificación ─── */
r.put('/calificaciones/:id/acuerdo', env((req, res) => {
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [req.params.id])
  if (!cal) throw new Error('Ficha no encontrada')
  const b = req.body ?? {}
  const notasEntrada = b.notas ?? {}
  const argumentos = b.argumentos ?? {}
  const votos = all('SELECT * FROM votos_subfactor WHERE calificacion_id = ?', [cal.id])
  const juntaId = b.junta_id ?? cal.junta_id
  const junta = juntaId ? get('SELECT * FROM juntas WHERE id = ?', [juntaId]) : null
  const integrantes = junta ? all('SELECT * FROM junta_integrantes WHERE junta_id = ? ORDER BY orden', [junta.id]) : []

  const notasFinales = {}
  const advertencias = []
  for (const s of SUBFACTORES) {
    const votosSub = votos.filter((v) => v.subfactor_clave === s.clave)
      .filter((v) => (integrantes.find((i) => i.id === v.integrante_id)?.derecho_a_voto ?? 1) === 1)
    const ag = votosSub.length ? agregarVotos(votosSub, integrantes) : { nota: null, criterio: 'Sin votos registrados', detalle: '' }
    const manual = notasEntrada[s.clave] === '' || notasEntrada[s.clave] === undefined || notasEntrada[s.clave] === null
      ? null : Number(notasEntrada[s.clave])
    if (manual !== null && (!Number.isInteger(manual) || manual < 1 || manual > 10)) {
      throw new Error(`La nota acordada en "${s.nombre}" debe ser un entero entre 1 y 10 (art. 14).`)
    }
    if (ag.nota !== null && manual !== null && ag.nota !== manual) {
      advertencias.push(`En "${s.nombre}" la votación de la junta arroja nota ${ag.nota} y usted ingresó ${manual}. Se consigna la nota votada (art. 30): ${ag.nota}.`)
    }
    const valor = ag.nota ?? manual
    if (valor !== null) notasFinales[s.clave] = valor
  }
  const faltantes = SUBFACTORES.filter((s) => notasFinales[s.clave] === undefined)
  if (faltantes.length && b.cerrar) {
    throw new Error(`No se puede cerrar el acuerdo: faltan notas en ${faltantes.map((s) => s.nombre).join(', ')}. Registre la votación de la junta o ingrese la nota acordada.`)
  }
  const calc = calcular(cal.planta_aplicada, notasFinales)
  const argumentosPrecal = parseJson(cal.precal_json)?.factores ?? {}
  const json = {
    subfactores: notasFinales,
    factores: Object.fromEntries(FACTORES.map((f) => [f.clave, {
      argumento: String(argumentos[f.clave] ?? '').trim() || argumentosPrecal[f.clave]?.argumento || '',
      nota: calc.factores[f.clave]?.nota ?? null,
      coeficiente: calc.factores[f.clave]?.coeficiente ?? null,
      puntos: calc.factores[f.clave]?.puntos ?? null,
    }])),
    acuerdo: b.acuerdo ?? cal.cal_json?.acuerdo ?? 'La Junta adopta su acuerdo por mayoría de votos, con los fundamentos consignados en el acta respectiva (arts. 29 y 30).',
    resultado: { puntaje: calc.puntaje, lista: calc.lista, puntaje_precalificacion: calcular(cal.planta_aplicada, parseJson(cal.precal_json)?.subfactores ?? {}).puntaje },
  }
  const estado = b.cerrar ? (b.estado || 'Calificado') : (b.estado || (cal.estado === 'Precalificado' ? 'En junta' : cal.estado))
  const actualizada = actualizar('calificaciones', cal.id, {
    junta_id: juntaId ?? cal.junta_id,
    cal_json: JSON.stringify(json),
    puntaje: calc.puntaje,
    lista: calc.lista,
    estado,
    cal_fecha_sesion: b.cal_fecha_sesion ?? cal.cal_fecha_sesion,
    acta_numero: b.acta_numero ?? cal.acta_numero,
    cal_observaciones: b.cal_observaciones ?? cal.cal_observaciones,
    situacion_final: calc.lista ? situacionPorLista(calc.lista,
      all(`SELECT c2.lista FROM calificaciones c2 JOIN periodos p ON p.id = c2.periodo_id
           WHERE c2.funcionario_id = ? AND p.anio < (SELECT anio FROM periodos WHERE id = ?) ORDER BY p.anio DESC LIMIT 1`,
      [cal.funcionario_id, cal.periodo_id]).map((x) => x.lista)) : null,
    actualizado_en: new Date().toISOString(),
  })
  auditar('Registra acuerdo de la junta', 'calificaciones', cal.id, `Puntaje ${calc.puntaje} — Lista N°${calc.lista}`)
  res.json({ ok: true, calificacion: actualizada, calculo: calc, advertencias })
}))

/* ── Estados, notificación y ejecutoria (arts. 31, 33 y 37) ─────────────── */
r.put('/calificaciones/:id/estado', env((req, res) => {
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [req.params.id])
  if (!cal) throw new Error('Ficha no encontrada')
  const b = req.body ?? {}
  if (b.estado === 'Ejecutoriado' && cal.puntaje === null) {
    throw new Error('No se puede declarar ejecutoriada una calificación sin puntaje asignado por la junta.')
  }
  const datos = { estado: b.estado ?? cal.estado, actualizado_en: new Date().toISOString() }
  for (const c of ['notificada_fecha', 'notificado_por', 'ejecutoriada_fecha', 'cal_fecha_sesion', 'acta_numero', 'cal_observaciones']) {
    if (b[c] !== undefined) datos[c] = b[c]
  }
  if (datos.estado === 'Ejecutoriado' && !datos.ejecutoriada_fecha && !cal.ejecutoriada_fecha) {
    datos.ejecutoriada_fecha = new Date().toISOString().slice(0, 10)
  }
  const actualizada = actualizar('calificaciones', cal.id, datos)
  auditar('Cambia estado de calificación', 'calificaciones', cal.id, `Estado: ${datos.estado}`)
  res.json(actualizada)
}))

/* ── Apelaciones y reclamos (arts. 32 a 36) ─────────────────────────────── */
r.post('/calificaciones/:id/apelacion', env((req, res) => {
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [req.params.id])
  if (!cal) throw new Error('Ficha no encontrada')
  const b = req.body ?? {}
  if (!b.fecha) throw new Error('Debe indicar la fecha de interposición del recurso.')
  if (!String(b.fundamentos ?? '').trim()) throw new Error('La apelación debe señalar sus fundamentos.')
  const ap = insertar('apelaciones', {
    calificacion_id: cal.id,
    tipo: b.tipo || 'Apelación',
    fecha: b.fecha,
    plazo_dias: Number(b.plazo_dias) || 5,
    extemporanea: aBool(b.extemporanea),
    fundamentos: b.fundamentos,
    autoridad: b.autoridad || 'Jefe Superior del Servicio',
    puntaje_junta: cal.puntaje,
    creado_en: new Date().toISOString(),
  })
  actualizar('calificaciones', cal.id, {
    estado: 'Apelación',
    notificada_fecha: b.notificada_fecha ?? cal.notificada_fecha,
    actualizado_en: new Date().toISOString(),
  })
  auditar('Registra apelación', 'calificaciones', cal.id, `Apelación del ${b.fecha} — autoridad: ${ap.autoridad}`)
  res.json(ap)
}))

r.put('/apelaciones/:id', env((req, res) => {
  const ap = get('SELECT * FROM apelaciones WHERE id = ?', [req.params.id])
  if (!ap) throw new Error('Apelación no encontrada')
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [ap.calificacion_id])
  const b = req.body ?? {}
  const datos = {}
  for (const c of ['resolucion', 'fundamento_resolucion', 'fecha_resolucion', 'notificada_fecha', 'autoridad', 'extemporanea']) {
    if (b[c] !== undefined) datos[c] = c === 'extemporanea' ? aBool(b[c]) : b[c]
  }
  if (b.puntaje_resuelto !== undefined && b.puntaje_resuelto !== null && b.puntaje_resuelto !== '') {
    const nuevo = redondear2(Number(b.puntaje_resuelto))
    if (nuevo < (ap.puntaje_junta ?? 0)) {
      throw new Error(`El puntaje asignado por la Junta (${ap.puntaje_junta}) puede mantenerse o elevarse, pero no rebajarse en caso alguno (art. 33).`)
    }
    datos.puntaje_resuelto = nuevo
  }
  const actualizada = actualizar('apelaciones', ap.id, datos)
  if (datos.puntaje_resuelto !== undefined && cal) {
    const lista = listaDePuntaje(datos.puntaje_resuelto)
    actualizar('calificaciones', cal.id, {
      puntaje: datos.puntaje_resuelto, lista,
      estado: datos.fecha_resolucion || b.ejecutoriar ? 'Ejecutoriado' : cal.estado,
      ejecutoriada_fecha: b.ejecutoriar ? (datos.fecha_resolucion || new Date().toISOString().slice(0, 10)) : cal.ejecutoriada_fecha,
      cal_observaciones: `${cal.cal_observaciones ?? ''}\nFallo de apelación: ${datos.resolucion ?? actualizada.resolucion} — puntaje ${ap.puntaje_junta} → ${datos.puntaje_resuelto} (art. 33).`.trim(),
    })
  } else if (cal && (datos.fecha_resolucion || b.ejecutoriar)) {
    actualizar('calificaciones', cal.id, {
      estado: 'Ejecutoriado',
      ejecutoriada_fecha: datos.fecha_resolucion || new Date().toISOString().slice(0, 10),
    })
  }
  auditar('Resuelve apelación', 'apelaciones', ap.id, `${datos.resolucion ?? ''} ${datos.puntaje_resuelto ? `— puntaje ${datos.puntaje_resuelto}` : ''}`)
  res.json(actualizar('apelaciones', ap.id, {}))
}))

/* ── Informes de desempeño (art. 19) ────────────────────────────────────── */
r.get('/informes', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const where = []
  const params = []
  if (periodo) { where.push('i.periodo_id = ?'); params.push(periodo.id) }
  if (req.query.jefe) { where.push('i.jefe_id = ?'); params.push(req.query.jefe) }
  if (req.query.numero) { where.push('i.numero = ?'); params.push(Number(req.query.numero)) }
  const datos = all(`SELECT i.*, (f.nombres || ' ' || f.apellido_paterno || ' ' || COALESCE(f.apellido_materno,'')) AS funcionario_nombre,
      f.rut, f.cargo, u.nombre AS unidad_nombre
    FROM informes_desempeno i JOIN funcionarios f ON f.id = i.funcionario_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY f.apellido_paterno, i.numero`, params)
  res.json({ periodo, datos })
}))

r.post('/informes/generar', env((req, res) => {
  const periodo = req.body?.periodo_id ? get('SELECT * FROM periodos WHERE id = ?', [req.body.periodo_id]) : periodoVigente()
  if (!periodo) throw new Error('Debe indicar el período.')
  let creados = 0
  transaccion(() => {
    for (const c of all('SELECT c.id, c.funcionario_id, c.precal_jefe_id, f.jefe_id FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id WHERE c.periodo_id = ?', [periodo.id])) {
      const jefeId = c.precal_jefe_id ?? c.jefe_id
      const jefe = jefeId ? get('SELECT * FROM funcionarios WHERE id = ?', [jefeId]) : null
      for (const inf of informesDelPeriodo(periodo.anio)) {
        if (get('SELECT id FROM informes_desempeno WHERE funcionario_id = ? AND periodo_id = ? AND numero = ?', [c.funcionario_id, periodo.id, inf.numero])) continue
        insertar('informes_desempeno', {
          funcionario_id: c.funcionario_id, periodo_id: periodo.id, numero: inf.numero,
          fecha_desde: inf.desde, fecha_hasta: inf.hasta,
          jefe_id: jefe?.id ?? null,
          jefe_nombre: jefe ? `${jefe.nombres} ${jefe.apellido_paterno} ${jefe.apellido_materno ?? ''}`.trim() : null,
          creado_en: new Date().toISOString(),
        })
        creados++
      }
    }
  })
  auditar('Genera informes de desempeño', 'informes_desempeno', periodo.id, `${creados} informes (art. 19)`)
  res.json({ ok: true, creados })
}))

r.put('/informes/:id', env((req, res) => {
  const campos = ['resumen', 'observaciones_jefe', 'notificado_fecha', 'observaciones_funcionario', 'obs_funcionario_fecha', 'fecha_emision', 'jefe_nombre']
  const datos = {}
  for (const c of campos) if (req.body?.[c] !== undefined) datos[c] = req.body[c]
  res.json(actualizar('informes_desempeno', req.params.id, datos))
}))

r.delete('/informes/:id', env((req, res) => {
  eliminar('informes_desempeno', req.params.id)
  res.json({ ok: true })
}))

/* ── Hoja de vida (arts. 8 a 11) ────────────────────────────────────────── */
r.get('/hoja-vida', env((req, res) => {
  const where = []
  const params = []
  if (req.query.funcionario) { where.push('h.funcionario_id = ?'); params.push(req.query.funcionario) }
  if (req.query.periodo) { where.push('h.periodo_id = ?'); params.push(req.query.periodo) }
  if (req.query.tipo) { where.push('h.tipo = ?'); params.push(req.query.tipo) }
  if (req.query.resolucion) { where.push('h.resolucion = ?'); params.push(req.query.resolucion) }
  if (req.query.aneiich === '1') where.push('f.asociado_aneiich = 1')
  res.json(all(`SELECT h.*, (f.nombres || ' ' || f.apellido_paterno || ' ' || COALESCE(f.apellido_materno,'')) AS funcionario_nombre,
      f.rut, f.planta, f.grado, u.nombre AS unidad_nombre, p.anio
    FROM hoja_vida h JOIN funcionarios f ON f.id = h.funcionario_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    LEFT JOIN periodos p ON p.id = h.periodo_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY h.fecha DESC`, params))
}))

r.post('/hoja-vida', env((req, res) => {
  const b = req.body ?? {}
  if (!b.funcionario_id) throw new Error('Debe indicar el funcionario.')
  if (!b.tipo || !['Mérito', 'Demérito'].includes(b.tipo)) throw new Error('El tipo de anotación debe ser Mérito o Demérito.')
  if (!String(b.descripcion ?? '').trim()) throw new Error('Debe describir la conducta o desempeño objeto de la anotación.')
  if (!b.fecha) throw new Error('Debe indicar la fecha de la anotación.')
  const funcionario = get('SELECT * FROM funcionarios WHERE id = ?', [b.funcionario_id])
  if (!funcionario) throw new Error('El funcionario indicado no existe en la base de datos.')
  const periodoAnotacion = b.periodo_id ? get('SELECT * FROM periodos WHERE id = ?', [b.periodo_id]) : periodoVigente()
  if (b.periodo_id && !periodoAnotacion) throw new Error('El período indicado no existe.')
  const jefe = b.emitida_por_id ? get('SELECT * FROM funcionarios WHERE id = ?', [b.emitida_por_id]) : null
  if (b.emitida_por_id && !jefe) throw new Error('El funcionario informante indicado no existe en la base de datos.')
  const hv = insertar('hoja_vida', {
    funcionario_id: b.funcionario_id,
    periodo_id: periodoAnotacion?.id ?? null,
    tipo: b.tipo,
    fecha: b.fecha,
    categoria: b.categoria,
    descripcion: b.descripcion,
    emitida_por_id: jefe?.id ?? b.emitida_por_id ?? null,
    emitida_por_nombre: jefe ? `${jefe.nombres} ${jefe.apellido_paterno} ${jefe.apellido_materno ?? ''}`.trim() : b.emitida_por_nombre,
    notificada_fecha: b.notificada_fecha,
    copia_asociacion: aBool(b.copia_asociacion),
    resolucion: b.resolucion || 'Pendiente',
    creado_en: new Date().toISOString(),
  })
  auditar(`Anotación de ${b.tipo}`, 'hoja_vida', hv.id, b.descripcion.slice(0, 140))
  res.json(hv)
}))

r.put('/hoja-vida/:id', env((req, res) => {
  const campos = ['tipo', 'fecha', 'categoria', 'descripcion', 'notificada_fecha', 'solicitud_fecha', 'solicitud_texto',
    'orden_anotacion_fecha', 'resolucion', 'resolucion_fundamento', 'resolucion_fecha', 'solicito_efecto', 'copia_asociacion']
  const datos = {}
  for (const c of campos) if (req.body?.[c] !== undefined) datos[c] = c === 'copia_asociacion' ? aBool(req.body[c]) : req.body[c]
  const hv = actualizar('hoja_vida', req.params.id, datos)
  auditar('Actualiza anotación de hoja de vida', 'hoja_vida', hv.id, `Resolución: ${hv.resolucion}`)
  res.json(hv)
}))

r.delete('/hoja-vida/:id', env((req, res) => {
  eliminar('hoja_vida', req.params.id)
  res.json({ ok: true })
}))

/* ── Escalafón de mérito (arts. 38 a 41) ────────────────────────────────── */
export function escalafonDe(periodoId) {
  const filas = all(`
    SELECT c.id AS calificacion_id, c.puntaje, c.lista, c.escala_numero, c.estado, c.nota_final,
      f.id AS funcionario_id, f.rut, f.nombres, f.apellido_paterno, f.apellido_materno, f.cargo, f.grado, f.planta,
      f.calidad_juridica, f.asociado_aneiich, f.rol_aneiich, f.fecha_ingreso_grado, f.fecha_ingreso_servicio,
      f.fecha_ingreso_administracion, u.nombre AS unidad_nombre, u.region,
      (SELECT COUNT(*) FROM calificaciones c2 JOIN periodos p2 ON p2.id = c2.periodo_id
        WHERE c2.funcionario_id = f.id AND p2.anio < p.anio) AS periodos_anteriores
    FROM calificaciones c
    JOIN funcionarios f ON f.id = c.funcionario_id
    JOIN periodos p ON p.id = c.periodo_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    WHERE c.periodo_id = ? AND c.puntaje IS NOT NULL
    ORDER BY f.grado ASC, c.puntaje DESC, f.fecha_ingreso_grado ASC, f.fecha_ingreso_servicio ASC`,
  [periodoId])
  const porGrado = {}
  for (const f of filas) {
    porGrado[f.grado] ??= []
    porGrado[f.grado].push({ ...f, lugar: porGrado[f.grado].length + 1 })
  }
  return { total: filas.length, grados: porGrado, filas }
}

r.get('/escalafon', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  if (!periodo) return res.json({ periodo: null, grados: {}, total: 0 })
  const esc = escalafonDe(periodo.id)
  if (req.query.grado) {
    const g = String(req.query.grado)
    return res.json({ periodo, grados: { [g]: esc.grados[g] ?? [] }, total: (esc.grados[g] ?? []).length })
  }
  return res.json({ periodo, ...esc })
}))

r.post('/escalafon/generar', env((req, res) => {
  const periodo = req.body?.periodo_id ? get('SELECT * FROM periodos WHERE id = ?', [req.body.periodo_id]) : periodoVigente()
  if (!periodo) throw new Error('Debe indicar el período.')
  const esc = escalafonDe(periodo.id)
  transaccion(() => {
    for (const fila of esc.filas) {
      const lugar = esc.grados[fila.grado].find((x) => x.calificacion_id === fila.calificacion_id).lugar
      actualizar('calificaciones', fila.calificacion_id, { escala_numero: lugar })
    }
  })
  auditar('Confecciona escalafón de mérito', 'calificaciones', periodo.id, `${esc.total} funcionarios ubicados (art. 38)`)
  res.json({ ok: true, total: esc.total, periodo })
}))

r.post('/escalafon/notificar', env((req, res) => {
  const periodo = req.body?.periodo_id ? get('SELECT * FROM periodos WHERE id = ?', [req.body.periodo_id]) : periodoVigente()
  if (!periodo) throw new Error('Debe indicar el período.')
  const fecha = req.body?.fecha || new Date().toISOString().slice(0, 10)
  const n = run(`UPDATE calificaciones SET notificada_fecha = COALESCE(notificada_fecha, ?),
      notificado_por = COALESCE(notificado_por, 'Unidad de Personal — notificación de escalafón (art. 39)')
    WHERE periodo_id = ? AND puntaje IS NOT NULL`, [fecha, periodo.id]).changes
  auditar('Notifica escalafón', 'calificaciones', periodo.id, `${n} notificaciones registradas (art. 39)`)
  res.json({ ok: true, notificadas: n })
}))

/* ── Exportaciones para reportes ────────────────────────────────────────── */
r.get('/reportes/calificaciones.csv', env((req, res) => {
  const periodo = req.query.periodo ? get('SELECT * FROM periodos WHERE id = ?', [req.query.periodo]) : periodoVigente()
  const datos = all(`SELECT f.rut, f.nombres, f.apellido_paterno, f.apellido_materno, f.cargo, f.grado, f.planta,
      f.calidad_juridica, f.asociado_aneiich, f.rol_aneiich, u.nombre AS unidad, u.region,
      c.estado, c.puntaje, c.lista, c.precal_jefe_nombre, c.precal_fecha, c.cal_fecha_sesion, c.acta_numero,
      c.notificada_fecha, c.ejecutoriada_fecha, c.escala_numero, c.situacion_final
    FROM calificaciones c JOIN funcionarios f ON f.id = c.funcionario_id
    LEFT JOIN unidades u ON u.id = f.unidad_id
    WHERE c.periodo_id = ? ORDER BY f.grado, c.puntaje DESC`, [periodo?.id ?? null])
  const columnas = [
    { clave: 'rut', titulo: 'RUT' }, { clave: 'nombres', titulo: 'Nombres' },
    { clave: 'apellido_paterno', titulo: 'Apellido paterno' }, { clave: 'apellido_materno', titulo: 'Apellido materno' },
    { clave: 'cargo', titulo: 'Cargo' }, { clave: 'grado', titulo: 'Grado' }, { clave: 'planta', titulo: 'Estamento' },
    { clave: 'calidad_juridica', titulo: 'Calidad jurídica' },
    { clave: 'asociado_aneiich', titulo: 'ANEIICH', valor: (f) => (f.asociado_aneiich ? 'SI' : 'NO') },
    { clave: 'rol_aneiich', titulo: 'Rol ANEIICH' },
    { clave: 'unidad', titulo: 'Unidad' }, { clave: 'region', titulo: 'Región' },
    { clave: 'estado', titulo: 'Estado del proceso' },
    { clave: 'puntaje', titulo: 'Puntaje' }, { clave: 'lista', titulo: 'Lista' },
    { clave: 'precal_jefe_nombre', titulo: 'Jefe evaluador' },
    { clave: 'precal_fecha', titulo: 'Fecha precalificación' },
    { clave: 'cal_fecha_sesion', titulo: 'Fecha sesión junta' },
    { clave: 'acta_numero', titulo: 'Acta' },
    { clave: 'notificada_fecha', titulo: 'Fecha notificación' },
    { clave: 'ejecutoriada_fecha', titulo: 'Fecha ejecutoria' },
    { clave: 'escala_numero', titulo: 'Lugar en escalafón' },
    { clave: 'situacion_final', titulo: 'Situación final' },
  ]
  res.type('text/csv; charset=utf-8').send(aCSV(datos.map((d) => ({ ...d, lista: d.lista ? `N°${d.lista}` : '' })), columnas))
}))

r.get('/calificaciones/:id/votos.csv', env((req, res) => {
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [req.params.id])
  if (!cal) throw new Error('Ficha no encontrada')
  const votos = all(`SELECT v.subfactor_clave, v.votante_nombre, v.votante_rol, v.criterio, v.nota, v.argumento
    FROM votos_subfactor v WHERE v.calificacion_id = ? ORDER BY v.subfactor_clave`, [cal.id])
  res.type('text/csv; charset=utf-8').send(aCSV(votos, [
    { clave: 'subfactor_clave', titulo: 'Subfactor', valor: (v) => subfactorPorClave(v.subfactor_clave)?.nombre ?? v.subfactor_clave },
    { clave: 'votante_nombre', titulo: 'Integrante de la junta' },
    { clave: 'votante_rol', titulo: 'Rol' },
    { clave: 'criterio', titulo: 'Criterio del voto' },
    { clave: 'nota', titulo: 'Nota votada' },
    { clave: 'argumento', titulo: 'Argumento' },
  ]))
}))

r.delete('/calificaciones/:id', env((req, res) => {
  const cal = get('SELECT * FROM calificaciones WHERE id = ?', [req.params.id])
  if (!cal) throw new Error('Ficha no encontrada')
  eliminar('calificaciones', cal.id)
  auditar('Elimina ficha de calificación', 'calificaciones', cal.id, `Funcionario ${cal.funcionario_id}, período ${cal.periodo_id}`)
  res.json({ ok: true })
}))

export default r
