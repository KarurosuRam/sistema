/**
 * Carga de datos de ejemplo (y utilidades para vaciar la base).
 *   node server/seed.js --reset   → vacía y carga datos de demostración
 *   node server/seed.js --wipe    → deja la base vacía, lista para importar datos reales
 */
import {
  getDb, migrar, insertar, run, all, get, config, transaccion, actualizar,
} from './db.js'
import {
  FACTORES, SUBFACTORES, informesDelPeriodo, plazosPeriodo, calcular, listaDePuntaje, redondear2,
} from './dominio.js'

/* ── utilidades ──────────────────────────────────────────────────────────── */
let semilla = 20250921
function rnd() {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}
const entre = (a, b) => Math.floor(rnd() * (b - a + 1)) + a
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)]
function dvRut(cuerpo) {
  let s = 0
  let m = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    s += Number(cuerpo[i]) * m
    m = m === 7 ? 2 : m + 1
  }
  const r = 11 - (s % 11)
  return r === 11 ? '0' : r === 10 ? 'K' : String(r)
}
function rutAleatorio() {
  const cuerpo = String(entre(7_000_000, 24_000_000))
  return `${cuerpo}-${dvRut(cuerpo)}`
}
function fechaAnio(anio, mesMin = 1, mesMax = 12) {
  const mes = entre(mesMin, mesMax)
  return `${anio}-${String(mes).padStart(2, '0')}-${String(entre(1, 28)).padStart(2, '0')}`
}

const NOMBRES_H = ['José', 'Luis', 'Carlos', 'Juan', 'Rodrigo', 'Maximiliano', 'Cristián', 'Patricio', 'Manuel', 'Andrés', 'Felipe', 'Iván', 'Héctor', 'Gonzalo', 'Marcelo', 'Álvaro', 'Ricardo', 'Sergio', 'Víctor', 'Eduardo']
const NOMBRES_M = ['María', 'Alejandra', 'Carolina', 'Valentina', 'Paulina', 'Andrea', 'Claudia', 'Verónica', 'Katherine', 'Daniela', 'Javiera', 'Marcela', 'Soledad', 'Lorena', 'Camila', 'Francisca', 'Paz', 'Ignacia', 'Roxana', 'Bárbara']
const APELLIDOS = ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres', 'Araya', 'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Ramírez', 'Reyes', 'Gutiérrez', 'Castro', 'Vergara', 'Núñez', 'Jara', 'Cáceres', 'Bravo']

const CARGOS = {
  Directivos: ['Director Regional', 'Subdirector de Recursos Humanos', 'Jefe de Departamento', 'Subdirector de Fiscalización', 'Jefe de Unidad de Personal'],
  Profesionales: ['Asesor Jurídico', 'Analista de Sistemas', 'Ingeniero en Informática', 'Contador Auditor', 'Analista de Recursos Humanos'],
  Fiscalizadores: ['Fiscalizador Tributario', 'Fiscalizador', 'Supervisor Fiscalizador'],
  Técnicos: ['Técnico en Administración', 'Técnico Jurídico', 'Técnico en Informática', 'Técnico en Contabilidad'],
  Administrativos: ['Administrativo', 'Oficinista', 'Secretaria', 'Asistente Administrativo'],
  Auxiliares: ['Auxiliar de Servicios', 'Conserje', 'Chofer', 'Estafeta'],
}

/* ── definición de la dotación ───────────────────────────────────────────── */
const UNIDADES = [
  { nombre: 'Dirección Nacional', sigla: 'DN', tipo: 'Nivel Central', region: 'Metropolitana de Santiago' },
  { nombre: 'Subdirección de Recursos Humanos', sigla: 'SRRH', tipo: 'Subdirección', region: 'Metropolitana de Santiago', padre: 'Dirección Nacional' },
  { nombre: 'Subdirección de Fiscalización', sigla: 'SF', tipo: 'Subdirección', region: 'Metropolitana de Santiago', padre: 'Dirección Nacional' },
  { nombre: 'Subdirección Jurídica', sigla: 'SJ', tipo: 'Subdirección', region: 'Metropolitana de Santiago', padre: 'Dirección Nacional' },
  { nombre: 'Subdirección de Tecnología de la Información', sigla: 'STI', tipo: 'Subdirección', region: 'Metropolitana de Santiago', padre: 'Dirección Nacional' },
  { nombre: 'Dirección Regional Metropolitana Santiago Centro', sigla: 'DRMSC', tipo: 'Dirección Regional', region: 'Metropolitana de Santiago' },
  { nombre: 'Dirección Regional Metropolitana Sur', sigla: 'DRMS', tipo: 'Dirección Regional', region: 'Metropolitana de Santiago' },
  { nombre: 'Dirección Regional Valparaíso', sigla: 'DRV', tipo: 'Dirección Regional', region: 'Valparaíso' },
  { nombre: 'Dirección Regional Biobío', sigla: 'DRB', tipo: 'Dirección Regional', region: 'Biobío' },
  { nombre: 'Dirección Regional Antofagasta', sigla: 'DRA', tipo: 'Dirección Regional', region: 'Antofagasta' },
  { nombre: 'Dirección Regional La Araucanía', sigla: 'DRLA', tipo: 'Dirección Regional', region: 'La Araucanía' },
]

// Perfiles de jefatura: [unidad, cargo, grado, planta, cantidad de dependientes]
const JEFATURAS = [
  ['Subdirección de Recursos Humanos', 'Subdirector de Recursos Humanos', 4, 'Directivos', 7],
  ['Subdirección de Fiscalización', 'Subdirector de Fiscalización', 4, 'Directivos', 10],
  ['Subdirección Jurídica', 'Fiscal Jurídico Jefe', 5, 'Directivos', 4],
  ['Subdirección de Tecnología de la Información', 'Jefe de Departamento de Informática', 6, 'Directivos', 5],
  ['Dirección Regional Metropolitana Santiago Centro', 'Director Regional', 5, 'Directivos', 12],
  ['Dirección Regional Metropolitana Sur', 'Director Regional', 5, 'Directivos', 8],
  ['Dirección Regional Valparaíso', 'Director Regional', 6, 'Directivos', 8],
  ['Dirección Regional Biobío', 'Director Regional', 6, 'Directivos', 7],
  ['Dirección Regional Antofagasta', 'Director Regional', 7, 'Directivos', 6],
  ['Dirección Regional La Araucanía', 'Director Regional', 7, 'Directivos', 6],
  ['Dirección Nacional', 'Jefe de Unidad de Personal', 8, 'Directivos', 4],
]

const ESTAMENTOS_DOTACION = [
  ['Fiscalizadores', 44, [9, 14]],
  ['Profesionales', 22, [8, 13]],
  ['Técnicos', 14, [12, 17]],
  ['Administrativos', 14, [14, 20]],
  ['Auxiliares', 6, [18, 24]],
]

function textoArgumento(nota, subfactor) {
  const nucleo = subfactor.replace(/^(a|b)\)\s*/, '')
  const bajo = nucleo.charAt(0).toLowerCase() + nucleo.slice(1)
  if (nota >= 9) return `Se destaca de manera sobresaliente en ${bajo}, superando los requerimientos del cargo durante todo el período. // Consta en la hoja de vida el reconocimiento del jefe directo.`
  if (nota >= 7) return `En ${bajo} su desempeño satisface completamente lo exigido para el cargo; cumple los plazos comprometidos. // Sin observaciones en el período.`
  if (nota >= 5) return `Respecto de ${bajo}, satisface en general los requerimientos, aunque se registran atrasos puntuales que fueron conversados con el funcionario. // Se sugiere reforzar el aspecto.`
  if (nota >= 3) return `En ${bajo} se observan incumplimientos reiterados que no alcanzan los requerimientos del cargo. // Se consigna lo conversado en reunión de retroalimentación.`
  return `No cumple con los requerimientos del cargo en ${bajo}. // Registra anotaciones de demérito vigentes en la hoja de vida.`
}

/* ── carga principal ─────────────────────────────────────────────────────── */
export function cargarDemo() {
  migrar()
  transaccion(() => {
    const unidadIds = {}
    for (const u of UNIDADES) {
      const fila = insertar('unidades', {
        nombre: u.nombre, sigla: u.sigla, tipo: u.tipo, region: u.region,
        padre_id: u.padre ? unidadIds[u.padre] : null, activo: 1, creado_en: new Date().toISOString(),
      })
      unidadIds[u.nombre] = fila.id
    }

    // Períodos (art. 3): 1 de septiembre al 31 de agosto del año siguiente
    const periodos = {}
    for (const anio of [2023, 2024, 2025, 2026]) {
      const p = plazosPeriodo(anio)
      periodos[anio] = insertar('periodos', {
        anio, ...p,
        estado: anio === 2026 ? 'En proceso' : 'Cerrado',
        vigente: anio === 2026 ? 1 : 0,
        observaciones: anio === 2026
          ? 'Proceso en curso: precalificación y calificación deben quedar terminadas antes del 15 de octubre; la junta se constituye el 21 de septiembre (arts. 20 y 28).'
          : 'Proceso terminado y escalafón notificado en diciembre (art. 39).',
        creado_en: new Date().toISOString(),
      })
    }

    // El Jefe Superior no es calificado (art. 5)
    const director = insertar('funcionarios', {
      rut: '8.111.222-3', nombres: 'Ricardo', apellido_paterno: 'Fuenzalida', apellido_materno: 'Urrutia',
      email: 'director.nacional@sii.cl', unidad_id: unidadIds['Dirección Nacional'], cargo: 'Director Nacional',
      grado: 1, planta: 'Directivos', calidad_juridica: 'Planta', jornada: '44 horas semanales',
      fecha_ingreso_servicio: '1993-03-01', fecha_ingreso_grado: '2019-04-01', fecha_ingreso_administracion: '1993-03-01',
      es_jefe_evaluador: 1, es_jefe_superior: 1, no_calificable: 1,
      causal_no_calificable: 'Jefe Superior de la institución (art. 5)',
      asociado_aneiich: 0, estado: 'Vigente', creado_en: new Date().toISOString(),
    })

    const jefes = []
    let indiceNombre = 0
    for (const [unidad, cargo, grado, planta, dependientes] of JEFATURAS) {
      const esMujer = rnd() > 0.6
      const nombres = esMujer ? elegir(NOMBRES_M) : elegir(NOMBRES_H)
      const jefe = insertar('funcionarios', {
        rut: rutAleatorio(),
        nombres: `${nombres} ${elegir(NOMBRES_H)}`,
        apellido_paterno: APELLIDOS[indiceNombre % APELLIDOS.length],
        apellido_materno: APELLIDOS[(indiceNombre + 7) % APELLIDOS.length],

        email: `jefatura${indiceNombre + 1}@sii.cl`,
        telefono: `+56 2 2${entre(1000000, 9999999)}`,
        sexo: esMujer ? 'F' : 'M',
        fecha_nacimiento: fechaAnio(entre(1964, 1980)),
        unidad_id: unidadIds[unidad], cargo, grado, planta,
        calidad_juridica: 'Planta', jornada: '44 horas semanales',
        fecha_ingreso_servicio: fechaAnio(entre(1990, 2006)),
        fecha_ingreso_grado: fechaAnio(entre(2016, 2022)),
        fecha_ingreso_administracion: fechaAnio(entre(1988, 2004)),
        es_jefe_evaluador: 1,
        jefe_id: director.id,
        asociado_aneiich: rnd() > 0.55 ? 1 : 0,
        rol_aneiich: null,
        estado: 'Vigente', creado_en: new Date().toISOString(),
      })
      jefes.push({ ...jefe, dependientes })
      indiceNombre++
    }

    // Funcionarios de la dotación, asignados a cada jefatura
    const dotacion = []
    indiceNombre = 30
    for (const [planta, cantidad, [gradoMin, gradoMax]] of ESTAMENTOS_DOTACION) {
      let asignados = 0
      for (let i = 0; i < cantidad; i++) {
        const jefe = jefes[asignados % jefes.length]
        asignados++
        const esMujer = rnd() > 0.5
        const nombres = esMujer ? elegir(NOMBRES_M) : elegir(NOMBRES_H)
        const ingreso = fechaAnio(entre(2002, 2023), 1, 12)
        const f = insertar('funcionarios', {
          rut: rutAleatorio(),
          nombres: `${nombres} ${esMujer ? elegir(NOMBRES_M) : elegir(NOMBRES_H)}`,
          apellido_paterno: APELLIDOS[indiceNombre % APELLIDOS.length],
          apellido_materno: APELLIDOS[(indiceNombre + 11) % APELLIDOS.length],

          email: `funcionario${indiceNombre}@sii.cl`,
          telefono: `+56 9 ${entre(10000000, 99999999)}`,
          sexo: esMujer ? 'F' : 'M',
          fecha_nacimiento: fechaAnio(entre(1968, 1995)),
          unidad_id: jefe.unidad_id,
          cargo: elegir(CARGOS[planta]),
          grado: entre(gradoMin, gradoMax),
          planta,
          calidad_juridica: rnd() > 0.82 ? 'Contrata' : 'Planta',
          jornada: elegir(['44 horas semanales', '44 horas semanales', '28 horas semanales', 'Jornada completa']),
          fecha_ingreso_servicio: ingreso,
          fecha_ingreso_grado: fechaAnio(entre(2018, 2024)),
          fecha_ingreso_administracion: fechaAnio(entre(2000, 2020)),
          jefe_id: jefe.id,
          es_jefe_evaluador: 0,
          asociado_aneiich: rnd() > 0.5 ? 1 : 0,
          estado: 'Vigente',
          creado_en: new Date().toISOString(),
        })
        dotacion.push(f)
        indiceNombre++
      }
    }

    // Primer año de servicio reciente (art. 5: menos de 6 meses no se califica)
    const recienIngresados = dotacion.filter((f, i) => i % 17 === 3).slice(0, 3)
    for (const f of recienIngresados) {
      actualizar('funcionarios', f.id, {
        fecha_ingreso_servicio: '2026-06-02',
        causal_no_calificable: null,
        observaciones: 'Ingresó al servicio en junio de 2026: no alcanza los seis meses de desempeño efectivo en el período (art. 5).',
      })
    }

    // Casos especiales ANEIICH y de representación (arts. 5 y 24)
    const dirigente = dotacion[4]
    actualizar('funcionarios', dirigente.id, {
      asociado_aneiich: 1, rol_aneiich: 'Dirigente Nacional',
      es_dirigente_asociacion: 1, solicita_ser_calificado: 0,
      fecha_afiliacion: '2009-05-14',
      observacion_aneiich: 'Integrante del directorio nacional ANEIICH; no es calificado salvo solicitud expresa (art. 5).',
    })
    const dirigenteRegional = dotacion[19]
    actualizar('funcionarios', dirigenteRegional.id, {
      asociado_aneiich: 1, rol_aneiich: 'Dirigente Regional',
      es_dirigente_asociacion: 1, solicita_ser_calificado: 1,
      fecha_afiliacion: '2015-08-20',
      observacion_aneiich: 'Dirigente regional ANEIICH que solicitó expresamente ser calificado (art. 5).',
    })
    const delegado = dotacion[33]
    actualizar('funcionarios', delegado.id, {
      asociado_aneiich: 1, rol_aneiich: 'Delegado ante la Junta',
      es_delegado_personal: 1, integrante_junta: 0,
      fecha_afiliacion: '2011-01-10',
      observacion_aneiich: 'Delegado del personal ante la Junta Calificadora (arts. 5 y 24).',
    })
    for (const f of dotacion.filter((x) => x.grado <= 9 && rnd() > 0.6).slice(0, 6)) {
      actualizar('funcionarios', f.id, { rol_aneiich: 'Socio' })
    }
    const asociados = all('SELECT id FROM funcionarios WHERE asociado_aneiich = 1')
    for (const a of asociados) {
      if (!get('SELECT id FROM funcionarios WHERE id = ? AND rol_aneiich IS NOT NULL', [a.id])) {
        actualizar('funcionarios', a.id, { rol_aneiich: 'Socio', fecha_afiliacion: fechaAnio(entre(2010, 2024)) })
      }
    }

    // Juntas Calificadoras (arts. 22 a 26)
    const juntas = {}
    for (const anio of [2023, 2024, 2025, 2026]) {
      const integrantesBase = jefes.slice(0, 5)
      const representante = dotacion.find((f) => rnd() > 0.5) ?? dotacion[8]
      const junta = insertar('juntas', {
        periodo_id: periodos[anio].id, tipo: 'Central', region: 'Metropolitana de Santiago',
        unidad_id: unidadIds['Dirección Nacional'],
        fecha_constitucion: `${anio}-09-21`,
        presidente_funcionario_id: integrantesBase[0].id,
        secretario_funcionario_id: integrantesBase[1].id,
        estado: anio === 2026 ? 'En sesión' : 'Terminada',
        observaciones: 'Constituida el 21 de septiembre conforme al art. 28. Acuerdos fundados y votaciones confidenciales (arts. 29 y 30).',
        creado_en: new Date().toISOString(),
      })
      const miembros = integrantesBase.map((j, i) => insertar('junta_integrantes', {
        junta_id: junta.id, funcionario_id: j.id, nombre: `${j.nombres} ${j.apellido_paterno} ${j.apellido_materno}`,
        cargo: j.cargo, rol: i === 0 ? 'Presidente' : 'Integrante', derecho_a_voto: 1, orden: i + 1,
      }))
      insertar('junta_integrantes', {
        junta_id: junta.id, funcionario_id: representante.id,
        nombre: `${representante.nombres} ${representante.apellido_paterno} ${representante.apellido_materno}`,
        cargo: representante.cargo, rol: 'Representante del personal', derecho_a_voto: 1, orden: 6,
      })
      const deleg = dotacion.find((f) => f.es_delegado_personal)
      if (deleg) {
        insertar('junta_integrantes', {
          junta_id: junta.id, funcionario_id: deleg.id,
          nombre: `${deleg.nombres} ${deleg.apellido_paterno} ${deleg.apellido_materno}`,
          cargo: deleg.cargo, rol: 'Delegado ANEIICH', derecho_a_voto: 0, orden: 7,
        })
      }
      juntas[anio] = { ...junta, integrantes: miembros }
      insertar('actas', {
        junta_id: junta.id, periodo_id: periodos[anio].id, numero: `${anio}-01`, fecha: `${anio}-09-21`,
        tipo: 'Constitución',
        asistentes: miembros.map((m) => m.nombre).join(', '),
        acuerdos: 'Se constituye la Junta Calificadora Central, se designa presidente y secretario, y se fija el calendario de sesiones.',
        contenido: `En Santiago, a 21 de septiembre de ${anio}, se constituye la Junta Calificadora Central del período ${anio - 1}-${anio}, conforme al artículo 28 del DTO 1825/1998.`,
        aprobada: 1, fecha_aprobacion: `${anio}-09-28`, creado_en: new Date().toISOString(),
      })
    }

    // Excluidos del proceso (art. 5): integrantes de la junta
    for (const j of jefes.slice(0, 5)) {
      actualizar('funcionarios', j.id, {
        integrante_junta: 1,
        no_calificable: 0,
        observacion_aneiich: null,
        observaciones: 'Integra la Junta Calificadora Central; no es calificado en el período (art. 5), conserva su última calificación.',
      })
    }

    const todos = all('SELECT * FROM funcionarios')

    // Perfil de desempeño por funcionario (estable entre períodos, con variación anual)
    const tramos = [
      { peso: 0.16, base: 8.7 },   // sobresaliente → Lista N°1
      { peso: 0.50, base: 7.4 },   // bueno
      { peso: 0.22, base: 6.1 },   // satisfactorio
      { peso: 0.09, base: 4.3 },   // insuficiente → Lista N°3
      { peso: 0.03, base: 2.5 },   // deficiente → Lista N°4
    ]
    const perfilDesempeno = new Map()
    for (const f of todos) {
      let r = rnd()
      let tramo = tramos[tramos.length - 1]
      for (const t of tramos) {
        if (r < t.peso) { tramo = t; break }
        r -= t.peso
      }
      perfilDesempeno.set(f.id, tramo.base + (rnd() * 0.9 - 0.45))
    }
    const notaDe = (funcId, jitter = 1.3) =>
      Math.max(1, Math.min(10, Math.round((perfilDesempeno.get(funcId) ?? 7) + (rnd() * 2 * jitter - jitter))))

    // Calificaciones por período (arts. 14 a 31)
    for (const anio of [2023, 2024, 2025, 2026]) {
      const periodo = periodos[anio]
      for (const f of todos) {
        const esNoCalificable = f.no_calificable === 1 || f.es_jefe_superior === 1 || f.integrante_junta === 1
          || f.es_delegado_personal === 1 || (f.es_dirigente_asociacion === 1 && f.solicita_ser_calificado === 0)
          || (f.fecha_ingreso_servicio && f.fecha_ingreso_servicio > `${anio}-02-28`)
        const jefe = todos.find((x) => x.id === f.jefe_id)
        const precalNotas = Object.fromEntries(SUBFACTORES.map((s) => [s.clave, notaDe(f.id)]))
        // La junta puede ajustar en +1/-1 alguno de los subfactores respecto de la precalificación
        const notasJunta = Object.fromEntries(
          SUBFACTORES.map((s) => [s.clave, Math.max(1, Math.min(10, precalNotas[s.clave] + (rnd() > 0.72 ? (rnd() > 0.5 ? 1 : -1) : 0)))])
        )
        const calcJunta = calcular(f.planta, notasJunta)

        // Períodos cerrados: proceso terminado y ejecutoriado (con apelaciones ya resueltas en algunos casos).
        // Período en curso: fichas en distintos grados de avance del proceso.
        let estadoBase
        if (anio === 2026) {
          const r = rnd()
          estadoBase = r > 0.58 ? 'Calificado' : r > 0.36 ? 'En junta' : r > 0.18 ? 'Precalificado'
            : r > 0.11 ? 'Informes de desempeño' : r > 0.05 ? 'Apelación' : 'Borrador'
        } else {
          estadoBase = rnd() > 0.88 ? 'Apelación' : 'Ejecutoriado'
        }
        const apelacionAntigua = anio < 2026 && estadoBase === 'Apelación'
        const estado = esNoCalificable ? 'Borrador' : (apelacionAntigua ? 'Ejecutoriado' : estadoBase)
        const conAcuerdo = !esNoCalificable && ['Calificado', 'Apelación', 'Ejecutoriado'].includes(estadoBase)

        const precalJson = Object.fromEntries(
          FACTORES.map((fac) => [fac.clave, {
            argumento: fac.subfactores.map((s) => textoArgumento(precalNotas[s.clave], s.nombre)).join(' '),
          }])
        )

        const cal = insertar('calificaciones', {
          funcionario_id: f.id,
          periodo_id: periodo.id,
          junta_id: conAcuerdo && juntas[anio] ? juntas[anio].id : null,
          planta_aplicada: f.planta,
          estado,
          precal_efectuada: esNoCalificable ? 0 : 1,
          precal_jefe_id: jefe?.id ?? null,
          precal_jefe_nombre: jefe ? `${jefe.nombres} ${jefe.apellido_paterno} ${jefe.apellido_materno}` : 'Jefatura Directa',
          precal_jefe_cargo: jefe?.cargo ?? 'Jefe Directo',
          precal_jefe_desde: periodo.fecha_inicio,
          precal_jefe_hasta: periodo.fecha_termino,
          precal_fecha: esNoCalificable ? null : `${anio}-09-${String(entre(2, 12)).padStart(2, '0')}`,
          precal_notificada_fecha: esNoCalificable ? null : `${anio}-09-${String(entre(13, 20)).padStart(2, '0')}`,
          precal_json: JSON.stringify({ factores: precalJson, subfactores: precalNotas }),
          precal_observaciones: esNoCalificable
            ? null
            : 'Precalificación fundada en los dos informes de desempeño del art. 19 y en las anotaciones de la hoja de vida del período.',
          precal_obs_funcionario: !esNoCalificable && rnd() > 0.7
            ? 'El funcionario formula observaciones relativas a la ponderación del subfactor de asistencia y puntualidad (art. 20).'
            : null,
          cal_fecha_sesion: conAcuerdo ? `${anio}-10-${String(entre(1, 14)).padStart(2, '0')}` : null,
          acta_numero: conAcuerdo ? `${anio}-${String(entre(2, 9)).padStart(2, '0')}` : null,
          cal_json: conAcuerdo
            ? JSON.stringify({
              factores: calcJunta.factores,
              subfactores: notasJunta,
              acuerdo: 'La Junta acoge la precalificación del jefe directo, con las precisiones votadas en cada subfactor (arts. 27 y 29).',
              resultado: { puntaje: calcJunta.puntaje, lista: calcJunta.lista },
            })
            : null,
          puntaje: conAcuerdo ? calcJunta.puntaje : null,
          lista: conAcuerdo ? calcJunta.lista : null,
          notificada_fecha: estado === 'Ejecutoriado' ? `${anio}-10-${String(entre(16, 20)).padStart(2, '0')}` : null,
          notificado_por: estado === 'Ejecutoriado' ? 'Secretario de la Junta Calificadora' : null,
          ejecutoriada_fecha: estado === 'Ejecutoriado' ? `${anio}-11-${String(entre(2, 28)).padStart(2, '0')}` : null,
          cal_observaciones: conAcuerdo
            ? 'Acuerdo fundado de la Junta Calificadora adoptado por mayoría de votos (arts. 29 y 30).'
            : null,
          creado_en: new Date().toISOString(),
        })

        if (esNoCalificable) continue

        // Apelaciones (art. 32)
        if (estadoBase === 'Apelación') {
          const calsAnteriores = all(`SELECT c.puntaje FROM calificaciones c JOIN periodos p ON p.id = c.periodo_id
                                      WHERE c.funcionario_id = ? AND p.anio < ? AND c.puntaje IS NOT NULL
                                      ORDER BY p.anio DESC LIMIT 1`, [f.id, anio])
          const puntajeJunta = calcJunta.puntaje
          const puntajeResuelto = Math.min(100, redondear2(puntajeJunta + (rnd() > 0.5 ? entre(1, 4) : 0)))
          insertar('apelaciones', {
            calificacion_id: cal.id,
            tipo: 'Apelación',
            fecha: `${anio}-10-${String(entre(16, 24)).padStart(2, '0')}`,
            plazo_dias: 5,
            extemporanea: 0,
            fundamentos: elegir([
              'El funcionario apela de la resolución de la Junta Calificadora por estimar que no se ponderó debidamente una anotación de mérito de la hoja de vida (art. 32).',
              'Se apela por considerar que la nota del subfactor de asistencia y puntualidad no se condice con los antecedentes del período.',
              'Se interpone apelación solicitando se eleven las notas de los subfactores del factor Rendimiento, acompañando antecedentes.',
            ]),
            autoridad: elegir(['Director Nacional', 'Subsecretario de Hacienda']),
            puntaje_junta: puntajeJunta,
            puntaje_resuelto: puntajeResuelto,
            resolucion: anio < 2026 ? (rnd() > 0.4 ? 'Se eleva el puntaje' : 'Se mantiene el puntaje') : 'Pendiente de resolución',
            fundamento_resolucion: anio < 2026
              ? 'Resuelto con vista de la hoja de vida, la precalificación, la calificación y los antecedentes acompañados por el funcionario (art. 33).'
              : 'Recurso en tramitación ante la autoridad correspondiente; debe resolverse fundadamente dentro del plazo de 15 días (art. 33).',
            fecha_resolucion: anio < 2026 ? `${anio}-11-${String(entre(1, 20)).padStart(2, '0')}` : null,
            notificada_fecha: anio < 2026 ? `${anio}-11-${String(entre(21, 28)).padStart(2, '0')}` : null,
            creado_en: new Date().toISOString(),
          })
          if (anio < 2026 && rnd() > 0.5 && calsAnteriores.length) {
            actualizar('calificaciones', cal.id, {
              puntaje: puntajeResuelto,
              lista: listaDePuntaje(puntajeResuelto),
              cal_observaciones: 'Calificación de la Junta modificada al alza por el fallo de la apelación (art. 33): el puntaje puede mantenerse o elevarse, nunca rebajarse.',
            })
          }
        }

        // Votación de la junta por subfactor (arts. 29 y 30)
        if (conAcuerdo && juntas[anio]) {
          const integrantes = juntas[anio].integrantes
          for (const s of SUBFACTORES) {
            const notaAcordada = notasJunta[s.clave]
            for (const m of integrantes) {
              const disidente = rnd() > 0.82
              const nota = disidente ? Math.max(1, Math.min(10, notaAcordada + (rnd() > 0.5 ? 1 : -1))) : notaAcordada
              insertar('votos_subfactor', {
                calificacion_id: cal.id,
                subfactor_clave: s.clave,
                integrante_id: m.id,
                votante_nombre: m.nombre,
                votante_rol: m.rol,
                criterio: nota === notaAcordada ? 'Conforme con la precalificación' : 'Fija nota distinta',
                nota,
                argumento: nota === notaAcordada
                  ? `Se comparte la apreciación del jefe directo respecto de "${s.nombre}".`
                  : `Se propone nota ${nota} en "${s.nombre}" por los antecedentes revisados en la hoja de vida del período.`,
                creado_en: new Date().toISOString(),
              })
            }
          }
        }

        // Situación final de los períodos cerrados (art. 37)
        if (estado === 'Ejecutoriado') {
          const lista = calcJunta.lista
          const situacion = lista === 4
            ? 'Lista N°4: debe retirarse del servicio dentro de los 15 días hábiles siguientes (art. 37).'
            : lista === 3
              ? 'Lista N°3 Condicional: si repite en el período siguiente corresponde el retiro (art. 37).'
              : lista === 1
                ? 'Lista N°1 de Distinción: antecedente para ascenso y estímulos (art. 1).'
                : 'Lista N°2 Buena: sin efectos de eliminación.'
          actualizar('calificaciones', cal.id, { situacion_final: situacion })
        }
      }
    }

    // Escalafón de mérito (art. 38): ubicación por grado y puntaje para 2024
    const calsUltimo = all(`SELECT c.* FROM calificaciones c JOIN periodos p ON p.id = c.periodo_id
                          WHERE p.anio = 2024 AND c.puntaje IS NOT NULL ORDER BY c.puntaje DESC`)
    const porGrado = new Map()
    for (const c of calsUltimo) {
      const f = get('SELECT grado FROM funcionarios WHERE id = ?', [c.funcionario_id])
      const g = f?.grado ?? 99
      if (!porGrado.has(g)) porGrado.set(g, [])
      porGrado.get(g).push(c)
    }
    for (const lista of porGrado.values()) {
      lista.sort((a, b) => b.puntaje - a.puntaje)
      lista.forEach((c, i) => actualizar('calificaciones', c.id, { escala_numero: i + 1 }))
    }

    // Hoja de vida del período en curso (arts. 8 a 11)
    const categoriasMerito = ['Aprobación de curso de capacitación', 'Desempeño de labores en jornada prolongada', 'Proposición de innovaciones', 'Cometido que excede el trabajo habitual']
    const categoriasDemerito = ['Atrasos en la entrega de trabajos', 'Infracción a instrucciones u órdenes de servicio']
    for (const f of todos.slice(0, 40)) {
      if (rnd() > 0.45) {
        insertar('hoja_vida', {
          funcionario_id: f.id, periodo_id: periodos[2026].id, tipo: 'Mérito',
          fecha: `2026-0${entre(3, 8)}-${String(entre(1, 28)).padStart(2, '0')}`,
          categoria: elegir(categoriasMerito),
          descripcion: elegir([
            'Aprobó el curso de capacitación en normativa tributaria con distinción, dentro del programa anual de capacitación.',
            'Realizó un cometido en la Dirección Regional de Valparaíso por dos semanas, apoyando el cierre de procesos masivos.',
            'Propuso una mejora al procedimiento de notificaciones que redujo los tiempos de respuesta del área.',
            'Prestó apoyo extraordinario en jornada prolongada durante el proceso de declaración de renta.',
          ]),
          emitida_por_id: f.jefe_id, emitida_por_nombre: 'Jefe Directo',
          notificada_fecha: `2026-0${entre(3, 8)}-${String(entre(1, 28)).padStart(2, '0')}`,
          resolucion: 'Mantiene anotación', creado_en: new Date().toISOString(),
        })
      }
      if (rnd() > 0.82) {
        insertar('hoja_vida', {
          funcionario_id: f.id, periodo_id: periodos[2026].id, tipo: 'Demérito',
          fecha: `2026-0${entre(2, 8)}-${String(entre(1, 28)).padStart(2, '0')}`,
          categoria: elegir(categoriasDemerito),
          descripcion: elegir([
            'Entrega fuera de plazo del informe trimestral comprometido, pese a requerimiento previo por escrito.',
            'No acató la instrucción de servicio N°14 sobre registro de atención de público en el sistema institucional.',
          ]),
          emitida_por_id: f.jefe_id, emitida_por_nombre: 'Jefe Directo',
          notificada_fecha: `2026-0${entre(2, 8)}-${String(entre(1, 28)).padStart(2, '0')}`,
          solicitud_fecha: rnd() > 0.5 ? `2026-0${entre(3, 8)}-${String(entre(1, 28)).padStart(2, '0')}` : null,
          solicitud_texto: 'El funcionario solicita dejar sin efecto la anotación o, en subsidio, consignar circunstancias atenuantes (art. 9).',
          resolucion: elegir(['Mantiene anotación', 'Sin efecto', 'Con atenuantes', 'Pendiente']),
          resolucion_fundamento: 'Resuelto por el jefe directo dentro del plazo legal, con copia a la unidad de personal.',
          resolucion_fecha: `2026-0${entre(4, 9)}-${String(entre(1, 28)).padStart(2, '0')}`,
          copia_asociacion: rnd() > 0.5 ? 1 : 0,
          creado_en: new Date().toISOString(),
        })
      }
    }

    // Informes de desempeño del período en curso (art. 19)
    for (const f of todos.slice(0, 55)) {
      const jefe = todos.find((x) => x.id === f.jefe_id)
      for (const inf of informesDelPeriodo(2026)) {
        insertar('informes_desempeno', {
          funcionario_id: f.id, periodo_id: periodos[2026].id, numero: inf.numero,
          fecha_desde: inf.desde, fecha_hasta: inf.hasta,
          jefe_id: jefe?.id ?? null,
          jefe_nombre: jefe ? `${jefe.nombres} ${jefe.apellido_paterno} ${jefe.apellido_materno}` : 'Jefatura Directa',
          fecha_emision: inf.hasta,
          resumen: inf.numero === 1
            ? 'Informe semestral: desempeño conforme a lo esperado, con cumplimiento de metas del área.'
            : 'Informe semestral: se mantiene el desempeño, con énfasis en la calidad de los trabajos entregados.',
          observaciones_jefe: 'Se sugiere continuar con el plan de capacitación del área.',
          notificado_fecha: inf.hasta,
          observaciones_funcionario: rnd() > 0.75 ? 'El funcionario hace presente que las metas del período consideraron cambios de procedimiento internos.' : null,
          obs_funcionario_fecha: rnd() > 0.75 ? inf.hasta : null,
          creado_en: new Date().toISOString(),
        })
      }
    }

    config.escribir('periodo_actual', String(periodos[2026].id))
  })
  return { ok: true }
}

export function vaciar() {
  const d = getDb()
  migrar()
  const tablas = ['votos_subfactor', 'apelaciones', 'hoja_vida', 'informes_desempeno', 'actas', 'calificaciones',
    'junta_integrantes', 'juntas', 'periodos', 'funcionarios', 'unidades', 'auditoria']
  d.exec('PRAGMA foreign_keys = OFF;')
  for (const t of tablas) d.exec(`DELETE FROM ${t}; DELETE FROM sqlite_sequence WHERE name = '${t}';`)
  d.exec('PRAGMA foreign_keys = ON;')
  return { ok: true }
}

const arg = process.argv[2]
if (import.meta.url === `file://${process.argv[1]}`) {
  if (arg === '--wipe') {
    vaciar()
    console.log('Base de datos vacía. Puede cargar sus datos reales desde la interfaz (Importar).')
  } else if (arg === '--reset') {
    vaciar()
    cargarDemo()
    console.log('Base de datos reiniciada con datos de demostración.')
    const r = get('SELECT COUNT(*) AS n FROM funcionarios')
    console.log(`Funcionarios cargados: ${r.n}`)
  } else {
    cargarDemo()
    console.log('Datos de demostración cargados.')
  }
}
