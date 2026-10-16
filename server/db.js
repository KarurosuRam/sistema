/**
 * Capa de acceso a datos. Usa el módulo SQLite nativo de Node (node:sqlite),
 * de modo que el sistema no requiere dependencias nativas compiladas.
 */
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
export const RAIZ = path.resolve(__dirname, '..')
const DIR_DATOS = path.join(RAIZ, 'data')
const ARCHIVO_DB = process.env.DB_PATH || path.join(DIR_DATOS, 'calificaciones.db')

let db = null

export function getDb() {
  if (db) return db
  fs.mkdirSync(path.dirname(ARCHIVO_DB), { recursive: true })
  db = new DatabaseSync(ARCHIVO_DB)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  return db
}

/** Normaliza valores JS que SQLite no acepta directamente (boolean, undefined). */
export function val(v) {
  if (v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  return v
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params.map(val))
}
export function get(sql, params = []) {
  return getDb().prepare(sql).get(...params.map(val)) ?? null
}
export function all(sql, params = []) {
  return getDb().prepare(sql).all(...params.map(val)) ?? []
}

const cacheColumnas = new Map()
/** Columnas reales de una tabla (se usa para ignorar campos que no existen). */
export function columnas(tabla) {
  if (!cacheColumnas.has(tabla)) {
    cacheColumnas.set(tabla, new Set(all(`PRAGMA table_info(${tabla})`).map((c) => c.name)))
  }
  return cacheColumnas.get(tabla)
}

/** Inserta un objeto {columna: valor} y devuelve la fila creada. */
export function insertar(tabla, datos) {
  const permitidas = columnas(tabla)
  const cols = Object.keys(datos).filter((c) => datos[c] !== undefined && permitidas.has(c))
  const sql = `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  const r = run(sql, cols.map((c) => datos[c]))
  return obtener(tabla, Number(r.lastInsertRowid))
}

/** Actualiza un registro por id con un objeto {columna: valor}. */
export function actualizar(tabla, id, datos) {
  const permitidas = columnas(tabla)
  const cols = Object.keys(datos).filter((c) => datos[c] !== undefined && permitidas.has(c))
  if (!cols.length) return obtener(tabla, id)
  const sql = `UPDATE ${tabla} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
  run(sql, [...cols.map((c) => datos[c]), id])
  return obtener(tabla, id)
}

export function obtener(tabla, id) {
  if (id === null || id === undefined || id === '') return null
  return get(`SELECT * FROM ${tabla} WHERE id = ?`, [id])
}

export function eliminar(tabla, id) {
  return run(`DELETE FROM ${tabla} WHERE id = ?`, [id]).changes > 0
}

export function transaccion(fn) {
  const d = getDb()
  d.exec('BEGIN')
  try {
    const out = fn()
    d.exec('COMMIT')
    return out
  } catch (e) {
    try { d.exec('ROLLBACK') } catch { /* noop */ }
    throw e
  }
}

export const config = {
  leer(clave, porDefecto = null) {
    const r = get('SELECT valor FROM config WHERE clave = ?', [clave])
    return r ? r.valor : porDefecto
  },
  escribir(clave, valor) {
    run('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', [clave, valor])
    return valor
  },
  todas() {
    const out = {}
    for (const r of all('SELECT clave, valor FROM config')) out[r.clave] = r.valor
    return out
  },
}

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS unidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  sigla TEXT,
  tipo TEXT NOT NULL DEFAULT 'Unidad',
  region TEXT,
  padre_id INTEGER REFERENCES unidades(id) ON DELETE SET NULL,
  direccion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT
);

CREATE TABLE IF NOT EXISTS funcionarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rut TEXT NOT NULL UNIQUE,
  nombres TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT,
  email TEXT,
  telefono TEXT,
  sexo TEXT,
  fecha_nacimiento TEXT,
  unidad_id INTEGER REFERENCES unidades(id) ON DELETE SET NULL,
  cargo TEXT,
  grado INTEGER,
  planta TEXT NOT NULL DEFAULT 'Administrativos',
  calidad_juridica TEXT NOT NULL DEFAULT 'Planta',
  jornada TEXT,
  fecha_ingreso_servicio TEXT,
  fecha_ingreso_grado TEXT,
  fecha_ingreso_administracion TEXT,
  anios_servicio REAL,
  jefe_id INTEGER REFERENCES funcionarios(id) ON DELETE SET NULL,
  es_jefe_evaluador INTEGER NOT NULL DEFAULT 0,
  -- Identificación ANEIICH
  asociado_aneiich INTEGER NOT NULL DEFAULT 0,
  rol_aneiich TEXT,
  fecha_afiliacion TEXT,
  observacion_aneiich TEXT,
  -- Situación estatutaria / calificabilidad (art. 5 y 7 DTO 1825)
  es_jefe_superior INTEGER NOT NULL DEFAULT 0,
  es_subrogante INTEGER NOT NULL DEFAULT 0,
  integrante_junta INTEGER NOT NULL DEFAULT 0,
  es_delegado_personal INTEGER NOT NULL DEFAULT 0,
  es_dirigente_asociacion INTEGER NOT NULL DEFAULT 0,
  solicita_ser_calificado INTEGER NOT NULL DEFAULT 0,
  meses_desempeno_periodo REAL,
  no_calificable INTEGER NOT NULL DEFAULT 0,
  causal_no_calificable TEXT,
  fecha_termino TEXT,
  estado TEXT NOT NULL DEFAULT 'Vigente',
  observaciones TEXT,
  creado_en TEXT,
  actualizado_en TEXT
);
CREATE INDEX IF NOT EXISTS idx_func_unidad ON funcionarios(unidad_id);
CREATE INDEX IF NOT EXISTS idx_func_jefe ON funcionarios(jefe_id);
CREATE INDEX IF NOT EXISTS idx_func_aneiich ON funcionarios(asociado_aneiich);

CREATE TABLE IF NOT EXISTS periodos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anio INTEGER NOT NULL UNIQUE,
  fecha_inicio TEXT NOT NULL,
  fecha_termino TEXT NOT NULL,
  fecha_constitucion_junta TEXT,
  fecha_limite_calificaciones TEXT,
  fecha_limite_escalafon TEXT,
  estado TEXT NOT NULL DEFAULT 'En proceso',
  vigente INTEGER NOT NULL DEFAULT 0,
  observaciones TEXT,
  creado_en TEXT
);

CREATE TABLE IF NOT EXISTS juntas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_id INTEGER NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'Central',
  region TEXT,
  unidad_id INTEGER REFERENCES unidades(id) ON DELETE SET NULL,
  fecha_constitucion TEXT,
  presidente_funcionario_id INTEGER REFERENCES funcionarios(id) ON DELETE SET NULL,
  secretario_funcionario_id INTEGER REFERENCES funcionarios(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'Constituida',
  observaciones TEXT,
  creado_en TEXT
);

CREATE TABLE IF NOT EXISTS junta_integrantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  junta_id INTEGER NOT NULL REFERENCES juntas(id) ON DELETE CASCADE,
  funcionario_id INTEGER REFERENCES funcionarios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  cargo TEXT,
  rol TEXT NOT NULL DEFAULT 'Integrante',
  derecho_a_voto INTEGER NOT NULL DEFAULT 1,
  orden INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  periodo_id INTEGER NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  junta_id INTEGER REFERENCES juntas(id) ON DELETE SET NULL,
  planta_aplicada TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Borrador',
  nota_final REAL,
  puntaje REAL,
  lista INTEGER,
  precal_efectuada INTEGER NOT NULL DEFAULT 0,
  precal_jefe_id INTEGER REFERENCES funcionarios(id) ON DELETE SET NULL,
  precal_jefe_nombre TEXT,
  precal_jefe_cargo TEXT,
  precal_jefe_desde TEXT,
  precal_jefe_hasta TEXT,
  precal_jefe_otro_nombre TEXT,
  precal_fecha TEXT,
  precal_notificada_fecha TEXT,
  precal_observaciones TEXT,
  precal_obs_funcionario TEXT,
  precal_obs_fecha TEXT,
  precal_json TEXT,
  cal_fecha_sesion TEXT,
  cal_fecha_junta TEXT,
  acta_numero TEXT,
  cal_json TEXT,
  cal_observaciones TEXT,
  notificada_fecha TEXT,
  notificado_por TEXT,
  ejecutoriada_fecha TEXT,
  escala_numero INTEGER,
  situacion_final TEXT,
  creado_en TEXT,
  actualizado_en TEXT,
  UNIQUE(funcionario_id, periodo_id)
);
CREATE INDEX IF NOT EXISTS idx_cal_periodo ON calificaciones(periodo_id);
CREATE INDEX IF NOT EXISTS idx_cal_func ON calificaciones(funcionario_id);

CREATE TABLE IF NOT EXISTS votos_subfactor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calificacion_id INTEGER NOT NULL REFERENCES calificaciones(id) ON DELETE CASCADE,
  subfactor_clave TEXT NOT NULL,
  integrante_id INTEGER REFERENCES junta_integrantes(id) ON DELETE CASCADE,
  votante_nombre TEXT NOT NULL,
  votante_rol TEXT,
  criterio TEXT NOT NULL DEFAULT 'Fija nota',
  nota INTEGER,
  argumento TEXT,
  creado_en TEXT,
  UNIQUE(calificacion_id, subfactor_clave, integrante_id)
);
CREATE INDEX IF NOT EXISTS idx_votos_cal ON votos_subfactor(calificacion_id);

CREATE TABLE IF NOT EXISTS apelaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calificacion_id INTEGER NOT NULL REFERENCES calificaciones(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'Apelación',
  fecha TEXT NOT NULL,
  plazo_dias INTEGER DEFAULT 5,
  extemporanea INTEGER NOT NULL DEFAULT 0,
  fundamentos TEXT,
  autoridad TEXT,
  puntaje_junta REAL,
  puntaje_resuelto REAL,
  resolucion TEXT,
  fundamento_resolucion TEXT,
  fecha_resolucion TEXT,
  notificada_fecha TEXT,
  creado_en TEXT
);

CREATE TABLE IF NOT EXISTS hoja_vida (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  periodo_id INTEGER REFERENCES periodos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  fecha TEXT NOT NULL,
  categoria TEXT,
  descripcion TEXT NOT NULL,
  emitida_por_id INTEGER REFERENCES funcionarios(id) ON DELETE SET NULL,
  emitida_por_nombre TEXT,
  notificada_fecha TEXT,
  solicitud_fecha TEXT,
  solicitud_texto TEXT,
  orden_anotacion_fecha TEXT,
  resolucion TEXT NOT NULL DEFAULT 'Pendiente',
  resolucion_fundamento TEXT,
  resolucion_fecha TEXT,
  solicito_efecto TEXT,
  copia_asociacion INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT
);
CREATE INDEX IF NOT EXISTS idx_hv_func ON hoja_vida(funcionario_id);

CREATE TABLE IF NOT EXISTS informes_desempeno (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  periodo_id INTEGER NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  fecha_desde TEXT,
  fecha_hasta TEXT,
  jefe_id INTEGER REFERENCES funcionarios(id) ON DELETE SET NULL,
  jefe_nombre TEXT,
  fecha_emision TEXT,
  resumen TEXT,
  observaciones_jefe TEXT,
  notificado_fecha TEXT,
  observaciones_funcionario TEXT,
  obs_funcionario_fecha TEXT,
  creado_en TEXT,
  UNIQUE(funcionario_id, periodo_id, numero)
);

CREATE TABLE IF NOT EXISTS actas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  junta_id INTEGER REFERENCES juntas(id) ON DELETE CASCADE,
  periodo_id INTEGER REFERENCES periodos(id) ON DELETE SET NULL,
  numero TEXT,
  fecha TEXT,
  tipo TEXT NOT NULL DEFAULT 'Calificación',
  asistentes TEXT,
  acuerdos TEXT,
  contenido TEXT,
  aprobada INTEGER NOT NULL DEFAULT 0,
  fecha_aprobacion TEXT,
  creado_en TEXT
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT,
  accion TEXT,
  entidad TEXT,
  entidad_id INTEGER,
  detalle TEXT,
  usuario TEXT
);
`

export function migrar() {
  getDb().exec(ESQUEMA)
  sembrarConfigInicial()
}

function sembrarConfigInicial() {
  const porDefecto = {
    institucion: 'Servicio de Impuestos Internos',
    sigla_institucion: 'SII',
    asociacion_nombre: 'ANEIICH',
    asociacion_detalle: 'Asociación Nacional de Funcionarios de Impuestos Internos de Chile',
    unidad_personal: 'Subdirección de Recursos Humanos',
    jefe_superior_nombre: 'Director Nacional',
    clave_acceso: 'sii2025',
    periodo_actual: '',
  }
  for (const [k, v] of Object.entries(porDefecto)) {
    if (config.leer(k) === null) config.escribir(k, v)
  }
}

export function auditar(accion, entidad, entidadId, detalle, usuario = 'Sistema') {
  run('INSERT INTO auditoria (fecha, accion, entidad, entidad_id, detalle, usuario) VALUES (?, ?, ?, ?, ?, ?)', [
    new Date().toISOString(), accion, entidad, entidadId, typeof detalle === 'string' ? detalle : JSON.stringify(detalle), usuario,
  ])
}
