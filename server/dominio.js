/**
 * Reglas de negocio del Reglamento de Calificaciones del Personal afecto al
 * Estatuto Administrativo — DTO 1825 de 1998 (Ministerio del Interior).
 * Fuente normativa: artículos 14, 15, 16, 17, 30 y 37.
 */

/* ── Art. 16: factores y subfactores ─────────────────────────────────────── */
export const FACTORES = [
  {
    clave: 'rendimiento',
    numero: 1,
    nombre: 'Rendimiento',
    descripcion: 'Mide el trabajo ejecutado durante el período, en relación a las tareas encomendadas.',
    subfactores: [
      {
        clave: 'rend_a',
        letra: 'a)',
        nombre: 'Cumplimiento de la labor realizada',
        descripcion: 'Mide la realización de los trabajos asignados y la rapidez y oportunidad en su ejecución.',
      },
      {
        clave: 'rend_b',
        letra: 'b)',
        nombre: 'Calidad de la labor realizada',
        descripcion: 'Evalúa las características de la labor cumplida y la ausencia de errores en el trabajo y la habilidad en su ejecución.',
      },
    ],
  },
  {
    clave: 'condiciones',
    numero: 2,
    nombre: 'Condiciones Personales',
    descripcion: 'Evalúa la actitud del funcionario en su vinculación con los demás.',
    subfactores: [
      {
        clave: 'pers_a',
        letra: 'a)',
        nombre: 'Interés por el trabajo que realiza',
        descripcion:
          'Mide el deseo del funcionario de perfeccionarse en el cumplimiento de sus obligaciones, de proponer la realización de actividades y de soluciones ante los problemas que se presenten y de proponer objetivos o procedimientos nuevos para la mejor realización del trabajo asignado.',
      },
      {
        clave: 'pers_b',
        letra: 'b)',
        nombre: 'Capacidad para realizar trabajos en equipo',
        descripcion:
          'Mide la facilidad de integración del funcionario en equipos de trabajo, así como la colaboración eficaz que éste presta cuando se requiere que trabaje con grupos de personas.',
      },
    ],
  },
  {
    clave: 'comportamiento',
    numero: 3,
    nombre: 'Comportamiento Funcionario',
    descripcion: 'Evalúa la conducta del funcionario en el cumplimiento de sus obligaciones.',
    subfactores: [
      {
        clave: 'comp_a',
        letra: 'a)',
        nombre: 'Cumplimiento de normas e instrucciones',
        descripcion: 'Mide el respeto a los reglamentos e instrucciones de la institución y a los demás deberes estatutarios.',
      },
      {
        clave: 'comp_b',
        letra: 'b)',
        nombre: 'Asistencia y puntualidad',
        descripcion: 'Mide la presencia o ausencia del funcionario en el lugar de trabajo y la exactitud en el cumplimiento de la jornada laboral.',
      },
    ],
  },
]

export const SUBFACTORES = FACTORES.flatMap((f) =>
  f.subfactores.map((s) => ({ ...s, factor: f.clave, factorNombre: f.nombre, factorNumero: f.numero }))
)

export function subfactorPorClave(clave) {
  return SUBFACTORES.find((s) => s.clave === clave) ?? null
}

/* ── Art. 14: escala de notas y conceptos ────────────────────────────────── */
export const CONCEPTOS = [
  { min: 9, max: 10, nombre: 'Óptimo', glosa: 'Generalmente su desempeño excede los requerimientos que exige el desarrollo del cargo.', color: 'emerald' },
  { min: 7, max: 8, nombre: 'Bueno', glosa: 'Su desempeño satisface completamente los requerimientos exigidos para el desarrollo del cargo.', color: 'sky' },
  { min: 5, max: 6, nombre: 'Satisfactorio', glosa: 'Su desempeño generalmente satisface los requerimientos que exige el desarrollo del cargo.', color: 'amber' },
  { min: 3, max: 4, nombre: 'Insuficiente', glosa: 'Su desempeño es inferior a los requerimientos que exige el desarrollo del cargo.', color: 'orange' },
  { min: 1, max: 2, nombre: 'Deficiente', glosa: 'No cumple con los requerimientos que exige el desarrollo del cargo.', color: 'rose' },
]

export function conceptoDeNota(nota) {
  if (nota === null || nota === undefined || isNaN(nota)) return null
  return CONCEPTOS.find((c) => nota >= c.min && nota <= c.max) ?? null
}

/* ── Art. 17: coeficientes por estamento ─────────────────────────────────── */
export const COEFICIENTES = {
  Directivos: { rendimiento: 4.5, condiciones: 3.5, comportamiento: 2.0, glosa: 'A. Directivos' },
  Profesionales: { rendimiento: 4.0, condiciones: 3.5, comportamiento: 2.5, glosa: 'B. Profesionales y Técnicos' },
  Técnicos: { rendimiento: 4.0, condiciones: 3.5, comportamiento: 2.5, glosa: 'B. Profesionales y Técnicos' },
  Fiscalizadores: {
    rendimiento: 4.0,
    condiciones: 3.5,
    comportamiento: 2.5,
    glosa: 'B. Profesionales y Técnicos (personal con funciones fiscalizadoras, art. 156 letra e) ley N°18.834)',
  },
  Administrativos: { rendimiento: 4.0, condiciones: 3.0, comportamiento: 3.0, glosa: 'C. Administrativos' },
  Auxiliares: { rendimiento: 4.0, condiciones: 3.0, comportamiento: 3.0, glosa: 'D. Auxiliares' },
}

export const ESTAMENTOS = Object.keys(COEFICIENTES)

export function coeficientesDe(estamento) {
  return COEFICIENTES[estamento] ?? COEFICIENTES.Administrativos
}

/* ── Art. 15: listas de calificación ─────────────────────────────────────── */
export const LISTAS = {
  1: { numero: 1, nombre: 'Distinción', desde: 81.0, hasta: 100, color: 'emerald' },
  2: { numero: 2, nombre: 'Buena', desde: 46.0, hasta: 80.99, color: 'sky' },
  3: { numero: 3, nombre: 'Condicional', desde: 30.0, hasta: 45.99, color: 'amber' },
  4: { numero: 4, nombre: 'Eliminación', desde: 10.0, hasta: 29.99, color: 'rose' },
}

export function listaDePuntaje(puntaje) {
  if (puntaje === null || puntaje === undefined || isNaN(puntaje)) return null
  if (puntaje >= 81) return 1
  if (puntaje >= 46) return 2
  if (puntaje >= 30) return 3
  if (puntaje >= 10) return 4
  return 4
}

/* ── Cálculo (art. 14) ───────────────────────────────────────────────────── */
/** Redondea a 2 decimales subiendo al decimal siguiente cuando el 3° decimal >= 5. */
export function redondear2(n) {
  if (n === null || n === undefined || isNaN(n)) return null
  return Math.round(n * 100 + 1e-9) / 100
}

/**
 * Calcula nota de factor, puntaje y lista a partir de las notas de subfactores.
 * @param {string} estamento  Directivos | Profesionales | Técnicos | Fiscalizadores | Administrativos | Auxiliares
 * @param {Record<string, number>} notasSubfactor  { rend_a: 7, rend_b: 8, ... }
 */
export function calcular(estamento, notasSubfactor = {}) {
  const coef = coeficientesDe(estamento)
  const factores = {}
  let puntaje = 0
  for (const f of FACTORES) {
    const notas = f.subfactores.map((s) => notasSubfactor[s.clave]).filter((n) => typeof n === 'number' && !isNaN(n))
    const promedio = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null
    const nota = redondear2(promedio)
    const c = coef[f.clave] ?? 0
    const puntos = nota === null ? null : redondear2(nota * c)
    if (puntos !== null) puntaje += puntos
    factores[f.clave] = { nota, coeficiente: c, puntos, conceptos: notas.map((n) => conceptoDeNota(n)?.nombre) }
  }
  const total = redondear2(puntaje)
  const lista = total === null ? null : listaDePuntaje(total)
  return { factores, puntaje: total, lista, coeficientes: coef }
}

/**
 * Agrega la votación de los integrantes de la junta para un subfactor.
 * Art. 30: los acuerdos se adoptan por mayoría de votos; en caso de empate decide el presidente.
 */
export function agregarVotos(votos = [], integrantes = []) {
  const conVoto = votos.filter((v) => typeof v.nota === 'number')
  const total = conVoto.length
  if (!total) return { nota: null, criterio: 'Sin votos registrados', detalle: 'No hay votos de la junta para este subfactor.' }

  const conteo = new Map()
  for (const v of conVoto) conteo.set(v.nota, (conteo.get(v.nota) ?? 0) + 1)
  const orden = [...conteo.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const maxVotos = orden[0][1]
  const ganadoras = orden.filter(([, c]) => c === maxVotos).map(([n]) => n)
  const presidente = integrantes.find((i) => i.rol === 'Presidente')
  const votoPres = presidente
    ? conVoto.find((v) => v.integrante_id === presidente.id || (v.votante_nombre && v.votante_nombre === presidente.nombre))
    : null

  // Mayoría: más de la mitad de los votos emitidos
  if (maxVotos * 2 > total) {
    const nota = ganadoras[0]
    return {
      nota,
      criterio: 'Mayoría de votos',
      detalle: `${maxVotos} de ${total} votos asignan nota ${nota} (art. 30).`,
    }
  }

  // Empate o votación dispersa: dirime el voto del presidente cuando está entre las notas más votadas
  if (votoPres && ganadoras.includes(votoPres.nota)) {
    return {
      nota: votoPres.nota,
      criterio: 'Empate resuelto por el presidente',
      detalle: `Sin mayoría: las notas ${ganadoras.join(' y ')} concentran ${maxVotos} de ${total} votos; dirime el voto del presidente (${presidente.nombre}) con nota ${votoPres.nota} (art. 30).`,
    }
  }

  const nota = Math.max(...ganadoras)
  return {
    nota,
    criterio: 'Sin mayoría; se consigna la nota mayor',
    detalle: `Ninguna nota reúne mayoría de votos (${maxVotos} de ${total} votos como máximo); se consigna la nota mayor entre las más votadas: ${nota}, para constancia en el acta (art. 30).`,
  }
}

/** Nota de un subfactor: prioriza el acuerdo de la junta y, en su ausencia, la precalificación. */
export function notaSubfactor(votos, integrantes, precalificacion) {
  const agregado = agregarVotos(votos, integrantes)
  if (agregado.nota !== null) return agregado
  if (typeof precalificacion === 'number') {
    return { nota: precalificacion, criterio: 'Precalificación (sin votos)', detalle: 'Se mantiene la nota de la precalificación del jefe directo (art. 27).' }
  }
  return agregado
}

/* ── Art. 5 y 7: quiénes son calificados ─────────────────────────────────── */
export const MESES_MINIMOS_DESEMPENO = 6

export const CAUSALES_NO_CALIFICABLE = {
  jefe_superior: 'Jefe Superior de la institución (art. 5)',
  subrogante: 'Subrogante legal del Jefe Superior (art. 5)',
  junta_central: 'Integrante de la Junta Calificadora Central (art. 5)',
  delegado: 'Delegado del personal (art. 5)',
  dirigente: 'Dirigente de asociación de funcionarios (art. 5)',
  meses_insuficientes: 'Desempeñó funciones por un lapso inferior a seis meses en el período (art. 5)',
  sin_calidad: 'No está afecto al Estatuto Administrativo (honorarios / a contrata no asimilado)',
  termino: 'Cesó en funciones durante o antes del período de calificación',
  manual: 'Excluido manualmente por la unidad de personal',
}

function mesesEntre(desde, hasta) {
  if (!desde || !hasta) return null
  const d1 = new Date(desde)
  const d2 = new Date(hasta)
  if (isNaN(d1) || isNaN(d2) || d2 < d1) return 0
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + (d2.getDate() >= d1.getDate() ? 0 : -1) + 0.5
}

/** Determina si el funcionario debe ser calificado en el período y por qué causal no lo sería. */
export function evaluarCalificabilidad(func, periodo) {
  if (!func) return { calificable: false, causal: 'Funcionario no encontrado' }
  if (func.no_calificable) {
    return { calificable: false, causal: func.causal_no_calificable || CAUSALES_NO_CALIFICABLE.manual }
  }
  const calidad = (func.calidad_juridica || 'Planta').toLowerCase()
  if (calidad.includes('honorario')) return { calificable: false, causal: CAUSALES_NO_CALIFICABLE.sin_calidad }
  if (func.es_jefe_superior) return { calificable: false, causal: CAUSALES_NO_CALIFICABLE.jefe_superior }
  if (func.es_subrogante) return { calificable: false, causal: CAUSALES_NO_CALIFICABLE.subrogante }
  if (func.integrante_junta) return { calificable: false, causal: CAUSALES_NO_CALIFICABLE.junta_central }
  if (func.es_delegado_personal) return { calificable: false, causal: CAUSALES_NO_CALIFICABLE.delegado }
  if (func.es_dirigente_asociacion && !func.solicita_ser_calificado) {
    return { calificable: false, causal: CAUSALES_NO_CALIFICABLE.dirigente }
  }
  if (func.fecha_termino && periodo && func.fecha_termino < periodo.fecha_inicio) {
    return { calificable: false, causal: CAUSALES_NO_CALIFICABLE.termino }
  }
  let meses = func.meses_desempeno_periodo
  if (meses === null || meses === undefined) {
    const desde = func.fecha_ingreso_servicio && periodo && func.fecha_ingreso_servicio > periodo.fecha_inicio ? func.fecha_ingreso_servicio : periodo?.fecha_inicio
    const hasta = func.fecha_termino && periodo && func.fecha_termino < periodo.fecha_termino ? func.fecha_termino : periodo?.fecha_termino
    meses = mesesEntre(desde, hasta)
  }
  if (periodo && meses !== null && meses < MESES_MINIMOS_DESEMPENO) {
    return { calificable: false, causal: `${CAUSALES_NO_CALIFICABLE.meses_insuficientes} — ${meses} meses acreditados` }
  }
  return { calificable: true, causal: null, meses }
}

/* ── Art. 37: efectos de la calificación ─────────────────────────────────── */
export function situacionPorLista(lista, listasAnteriores = []) {
  if (lista === 4) return 'Lista N°4: el funcionario debe retirarse del servicio dentro de los 15 días hábiles siguientes al término de la calificación (art. 37).'
  if (lista === 3) {
    const consecutivas = listasAnteriores.slice(0, 1).filter((l) => l === 3).length
    return consecutivas
      ? 'Dos períodos consecutivos en Lista N°3: corresponde el retiro del servicio (art. 37).'
      : 'Lista N°3 Condicional: si se repite en el período siguiente, corresponde el retiro del servicio (art. 37).'
  }
  if (lista === 1) return 'Lista N°1 de Distinción: antecedente para ascenso y estímulos (art. 1).'
  return 'Lista N°2 Buena: sin efectos de eliminación.'
}

/* ── Estados del proceso (arts. 18 a 41) ─────────────────────────────────── */
export const ESTADOS_CALIFICACION = [
  { clave: 'Borrador', descripcion: 'Ficha creada, sin precalificación.' },
  { clave: 'Informes de desempeño', descripcion: 'En elaboración los informes semestrales del art. 19.' },
  { clave: 'Precalificado', descripcion: 'El jefe directo efectuó la precalificación y la notificó (art. 20).' },
  { clave: 'En junta', descripcion: 'La Junta Calificadora está conociendo los antecedentes y votando por subfactor (arts. 27 y 30).' },
  { clave: 'Calificado', descripcion: 'Acuerdo de la junta adoptado, pendiente de notificación (art. 31).' },
  { clave: 'Apelación', descripcion: 'El funcionario interpuso apelación (art. 32); conoce el Subsecretario o el Jefe Superior.' },
  { clave: 'Ejecutoriado', descripcion: 'Resolución ejecutoriada: venció el plazo sin apelación o fue resuelta (arts. 33 y 37).' },
]

export const ESTADOS_ORDEN = ESTADOS_CALIFICACION.map((e) => e.clave)

/** Plazo legal habilita el cálculo de fechas límite a partir del período. */
export function plazosPeriodo(anio) {
  return {
    fecha_inicio: `${anio - 1}-09-01`,
    fecha_termino: `${anio}-08-31`,
    fecha_constitucion_junta: `${anio}-09-21`,
    fecha_limite_calificaciones: `${anio}-10-15`,
    fecha_limite_escalafon: `${anio}-12-31`,
  }
}

/** Informes de desempeño del art. 19 (dos informes por período). */
export function informesDelPeriodo(anio) {
  return [
    { numero: 1, desde: `${anio - 1}-09-01`, hasta: `${anio}-01-31`, glosa: '1° informe: 1 de septiembre al 31 de enero' },
    { numero: 2, desde: `${anio}-02-01`, hasta: `${anio}-06-30`, glosa: '2° informe: 1 de febrero al 30 de junio' },
  ]
}

export const CATEGORIAS_MERITO = [
  'Adquisición de título o calidad especial',
  'Aprobación de curso de capacitación',
  'Desempeño de labores en jornada prolongada',
  'Cometido que excede el trabajo habitual',
  'Ejecución de tareas de otros funcionarios',
  'Destacada calidad de los trabajos',
  'Proposición de innovaciones',
  'Otra anotación de mérito',
]

export const CATEGORIAS_DEMERITO = [
  'Incumplimiento manifiesto de obligaciones',
  'Infracción a instrucciones u órdenes de servicio',
  'No acatamiento de prohibiciones (ley N°18.834)',
  'Atrasos en la entrega de trabajos',
  'Otra anotación de demérito',
]
