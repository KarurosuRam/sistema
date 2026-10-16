/** Cliente HTTP mínimo para la API del sistema. */

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje)
    this.estado = estado
  }
}

let alPerderSesion = null
export function alExpirarSesion(fn) {
  alPerderSesion = fn
}

async function pedir(metodo, ruta, cuerpo) {
  const opciones = { method: metodo, credentials: 'same-origin', headers: {} }
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json'
    opciones.body = JSON.stringify(cuerpo)
  }
  const resp = await fetch(ruta, opciones)
  if (resp.status === 401 && !ruta.includes('/api/sesion')) {
    alPerderSesion?.()
    throw new ErrorApi('La sesión expiró. Vuelva a ingresar la clave de acceso.', 401)
  }
  const tipo = resp.headers.get('content-type') || ''
  const datos = tipo.includes('application/json') ? await resp.json().catch(() => null) : await resp.text()
  if (!resp.ok) throw new ErrorApi(datos?.error || `Error ${resp.status}`, resp.status)
  return datos
}

export const api = {
  get: (ruta) => pedir('GET', ruta),
  post: (ruta, cuerpo) => pedir('POST', ruta, cuerpo ?? {}),
  put: (ruta, cuerpo) => pedir('PUT', ruta, cuerpo ?? {}),
  del: (ruta) => pedir('DELETE', ruta),
}

/** Descarga un archivo del servidor respetando la sesión activa. */
export async function descargar(ruta, nombre) {
  const resp = await fetch(ruta, { credentials: 'same-origin' })
  if (!resp.ok) throw new ErrorApi('No fue posible generar el archivo solicitado.', resp.status)
  const blob = await resp.blob()
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(enlace.href)
}

export const consulta = (objeto) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(objeto ?? {})) {
    if (v !== undefined && v !== null && v !== '') p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}
