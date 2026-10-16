/** Utilidades de CSV (delimitador configurable, comillas dobles escapadas). */

export function parseCSV(texto, delimitador) {
  const t = String(texto ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!t) return []
  const delim = delimitador || detectarDelimitador(t)
  const filas = []
  let fila = []
  let campo = ''
  let entreComillas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (entreComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++ } else entreComillas = false
      } else campo += c
    } else if (c === '"') entreComillas = true
    else if (c === delim) { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else campo += c
  }
  fila.push(campo)
  filas.push(fila)
  const encabezados = filas.shift().map((h) => h.trim())
  return filas
    .filter((f) => f.some((v) => String(v).trim() !== ''))
    .map((f) => Object.fromEntries(encabezados.map((h, i) => [h, (f[i] ?? '').trim()])))
}

function detectarDelimitador(texto) {
  const primera = texto.split('\n')[0]
  const punto = (primera.match(/;/g) || []).length
  const coma = (primera.match(/,/g) || []).length
  return punto >= coma ? ';' : ','
}

export function aCSV(filas, columnas) {
  const cols = columnas ?? (filas[0] ? Object.keys(filas[0]).map((c) => ({ clave: c, titulo: c })) : [])
  const escapar = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas = [cols.map((c) => escapar(c.titulo)).join(';')]
  for (const f of filas) lineas.push(cols.map((c) => escapar(typeof c.valor === 'function' ? c.valor(f) : f[c.clave])).join(';'))
  return '\uFEFF' + lineas.join('\n')
}

/** Normaliza un RUT chileno a la forma 12345678-9. */
export function normalizarRut(rut) {
  const limpio = String(rut ?? '').replace(/[.\s]/g, '').toUpperCase()
  if (!limpio) return ''
  const partes = limpio.split('-')
  if (partes.length === 2) return `${partes[0]}-${partes[1]}`
  if (limpio.length > 1) return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`
  return limpio
}

export function validarRut(rut) {
  const r = normalizarRut(rut)
  const m = r.match(/^(\d{7,8})-([\dK])$/)
  if (!m) return false
  const cuerpo = m[1]
  let s = 0
  let mult = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    s += Number(cuerpo[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const resto = 11 - (s % 11)
  const dv = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === m[2]
}
