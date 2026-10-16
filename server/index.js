/**
 * Servidor del Sistema de Calificaciones (DTO 1825/1998).
 * API REST + servicio de la aplicación compilada (carpeta public/).
 */
import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { migrar, config, get, all, RAIZ } from './db.js'
import rutasMeta from './rutas/meta.js'
import rutasFuncionarios from './rutas/funcionarios.js'
import rutasCalificaciones from './rutas/calificaciones.js'
import rutasJuntas from './rutas/juntas.js'
import rutasDashboard from './rutas/dashboard.js'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const app = express()
const PUERTO = Number(process.env.API_PORT || 3000)

migrar()

app.use(express.json({ limit: '12mb' }))
app.disable('x-powered-by')

/* ── Sesión (clave única de acceso) ────────────────────────────────────────
 * El token se deriva de la clave de acceso con HMAC, de modo que la sesión
 * sobrevive a los reinicios del servidor y no se guarda ninguna clave en claro.
 * Si la clave cambia, todos los tokens anteriores dejan de ser válidos.
 */
const COOKIE = 'sc_sesion'
// secreto persistente en la base de datos: las sesiones sobreviven a los reinicios
const SECRETO = config.leer('secreto_sesion') || config.escribir('secreto_sesion', crypto.randomBytes(32).toString('hex'))

function tokenValido(token) {
  if (!token || typeof token !== 'string') return false
  const esperada = config.leer('clave_acceso', 'sii2025')
  const partes = token.split('.')
  if (partes.length !== 3) return false
  const [sello, emitido, firma] = partes
  const calculada = crypto.createHmac('sha256', SECRETO).update(`${sello}.${emitido}`).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(calculada, 'hex'), Buffer.from(firma.padEnd(64, '0').slice(0, 64), 'hex'))) return false
  const vigente = Number(emitido) + 12 * 3600 * 1000
  if (!Number.isFinite(vigente) || Date.now() > vigente) return false
  // el sello ata el token a la clave vigente: al cambiarla, se cierran las sesiones
  const selloEsperado = crypto.createHmac('sha256', SECRETO).update(String(esperada)).digest('hex').slice(0, 16)
  return sello === selloEsperado
}

function emitirToken() {
  const esperada = config.leer('clave_acceso', 'sii2025')
  const sello = crypto.createHmac('sha256', SECRETO).update(String(esperada)).digest('hex').slice(0, 16)
  const emitido = String(Date.now())
  const firma = crypto.createHmac('sha256', SECRETO).update(`${sello}.${emitido}`).digest('hex')
  return `${sello}.${emitido}.${firma}`
}

function leerCookies(req) {
  const out = {}
  for (const parte of (req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=')
    if (i > 0) out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim())
  }
  return out
}

function autenticado(req) {
  return tokenValido(leerCookies(req)[COOKIE])
}

app.get('/api/salud', (req, res) => {
  res.json({
    ok: true,
    institucion: config.leer('institucion'),
    version: '1.0.0',
    funcionarios: get('SELECT COUNT(*) AS n FROM funcionarios')?.n ?? 0,
    requiere_clave: true,
  })
})

app.get('/api/sesion', (req, res) => {
  res.json({
    autenticado: autenticado(req),
    institucion: config.leer('institucion'),
    sigla: config.leer('sigla_institucion'),
    asociacion: config.leer('asociacion_nombre'),
  })
})

app.post('/api/sesion', (req, res) => {
  const clave = String(req.body?.clave ?? '')
  const esperada = config.leer('clave_acceso', 'sii2025')
  if (clave.trim() !== esperada) return res.status(401).json({ error: 'Clave de acceso incorrecta.' })
  res.setHeader('Set-Cookie', `${COOKIE}=${emitirToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`)
  res.json({ ok: true })
})

app.post('/api/sesion/salir', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`)
  res.json({ ok: true })
})

const PUBLICAS = new Set(['/api/salud', '/api/sesion'])
app.use('/api', (req, res, next) => {
  const ruta = req.baseUrl + req.path
  if (PUBLICAS.has(ruta)) return next()
  if (!autenticado(req)) return res.status(401).json({ error: 'Sesión no iniciada. Ingrese la clave de acceso.' })
  next()
})

/* ── Rutas de la API ─────────────────────────────────────────────────────── */
app.use('/api', rutasMeta)
app.use('/api', rutasFuncionarios)
app.use('/api', rutasCalificaciones)
app.use('/api', rutasJuntas)
app.use('/api', rutasDashboard)

app.use('/api', (req, res) => res.status(404).json({ error: `Recurso no encontrado: ${req.method} ${req.baseUrl}${req.path}` }))

/* ── Aplicación compilada (producción) ───────────────────────────────────── */
const DIR_PUBLICO = path.join(RAIZ, 'public')
if (fs.existsSync(path.join(DIR_PUBLICO, 'index.html'))) {
  app.use(express.static(DIR_PUBLICO))
  app.get('*', (req, res) => res.sendFile(path.join(DIR_PUBLICO, 'index.html')))
} else {
  app.get('/', (req, res) => {
    res.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8">
      <title>Sistema de Calificaciones</title>
      <body style="font-family:system-ui;padding:2rem;max-width:60ch;margin:auto">
      <h1>Sistema de Calificaciones</h1>
      <p>La API está operativa en <code>/api/salud</code>.</p>
      <p>La interfaz se sirve en desarrollo con <code>npm run dev</code> (Vite, puerto 5173) y en producción con
      <code>npm run build &amp;&amp; npm start</code>.</p></body></html>`)
  })
}

/* ── Manejo de errores ───────────────────────────────────────────────────── */
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const mensaje = String(err?.message ?? '')
  // Los errores de integridad se explican en lenguaje del proceso para no mostrar SQL al usuario
  if (/FOREIGN KEY constraint failed/i.test(mensaje)) {
    console.error('[error]', err)
    return res.status(400).json({
      error: 'Los datos indicados no existen en el sistema (por ejemplo, el funcionario, el período o la junta). Revise la selección e intente nuevamente.',
    })
  }
  if (/(UNIQUE|CHECK) constraint failed/i.test(mensaje)) {
    console.error('[error]', err)
    return res.status(400).json({ error: 'El registro ya existe o no cumple las validaciones: ' + mensaje })
  }
  console.error('[error]', err)
  res.status(500).json({ error: mensaje || 'Error interno del servidor' })
})

app.listen(PUERTO, '0.0.0.0', () => {
  const n = get('SELECT COUNT(*) AS n FROM funcionarios')?.n ?? 0
  console.log(`API de calificaciones escuchando en http://0.0.0.0:${PUERTO} — ${n} funcionarios en la base`)
  if (n === 0) console.log('Base vacía: cargue datos con "npm run seed" o desde la pantalla de Ajustes.')
})
