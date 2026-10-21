# 🌿 Jardín Memorial — www.jardinmemorial.cl

### Identidad visual

Paleta **moderna, luminosa y respetuosa**: crema cálida de base, **jade** como acento principal,
**coral** para la calidez, **marigold** para la celebración y **lilac** como contrapunto sereno.
Los cuatro temas de memorial (`jardín`, `amanecer`, `cielo`, `noche`) usan acentos luminosos
sobre fondo verde profundo. Todo el color vive en variables CSS en `public/css/base.css`, con
pares texto/fondo verificados para contraste AA.

Plataforma chilena para crear **memoriales digitales** de personas y mascotas. Cada memorial genera
automáticamente un **enlace único**, un **código QR** y un **certificado de propiedad** asociado a la
cuenta de su titular, además de alojar foto principal, galería de 10 fotos, un video de hasta 60
segundos, música MP3 y un libro de visitas con velas virtuales.

> Sitio: **www.jardinmemorial.cl** · Precios: **$6.990** un memorial · **$11.990** pack de 4.

---

## ✨ Qué incluye

| Requisito | Implementación |
| --- | --- |
| Cuenta de usuario con memoriales ilimitados | Registro con correo + contraseña (scrypt), sesiones HttpOnly y panel personal |
| Precio $6.990 / 4 por $11.990 | Planes `single` y `pack4` con créditos; el pack cuesta $2.998 por memorial (ahorro $15.970) |
| Enlace generado automáticamente | `https://www.jardinmemorial.cl/m/<slug>` creado al guardar, con opción de personalizar el slug |
| Código QR automático | PNG en alta resolución (`/m/<slug>/qr.png` y descarga desde el panel) + QR embebido |
| Certificado de propiedad | PDF A4 horizontal con código verificable, firmas, QR y página pública de verificación |
| Foto principal | Primera foto del memorial, reordenable desde el panel |
| Hasta 10 fotos | Carga múltiple, miniaturas optimizadas, descripciones y control estricto del límite |
| Video de máx. 60 s | MP4/MOV hasta 120 MB; se inspecciona la duración real del contenedor y se rechaza si excede |
| Música MP3 al abrir | MP3 hasta 20 MB, reproducción automática con respaldo amable si el navegador la bloquea |
| Libro de visitas | Mensajes moderables (ocultar/eliminar), velas virtuales, paginación y protección anti-spam |

Extras: **tarjeta conmemorativa A5 imprimible** con retrato y QR, **presentación de recuerdos**
(slideshow del lightbox), reordenamiento de la galería, **búsqueda y filtros en el jardín público**,
**moderación global de mensajes**, **respaldo JSON** por memorial, diseño editorial responsive,
memoriales públicos o privados, sitemap/SEO, página de demo, centro de ayuda, términos, privacidad
y comprobantes de compra.

## 🚀 Puesta en marcha

Requisitos: **Node.js 22.5+** (usa el módulo nativo `node:sqlite`).

```bash
npm install
npm start          # incluye --experimental-sqlite
# → http://localhost:3000
```

En el primer arranque, si la base está vacía, se crea automáticamente el **contenido de demostración**
(cuenta, 5 memoriales, galerías, mensajes y velas).

**Cuenta de demostración**

```
Correo:      demo@jardinmemorial.cl
Contraseña:  jardin2026
```

Para regenerar la demo:

```bash
npm run seed
```

Para empezar sin datos de ejemplo:

```bash
SEED_DEMO=false npm start
```

### Variables de entorno

Copia `.env.example` (todas son opcionales): `PORT`, `BASE_URL`, `DATA_DIR`, `PAYMENTS_MODE`
(`demo`/`live`), `SEED_DEMO`, `EMBED_ORIGINS`. Los datos viven en `./data` — base
`jardin.sqlite` (WAL) y `data/uploads/{img,audio,video}` — y están excluidos de Git.

`EMBED_ORIGINS` autoriza orígenes externos a mostrar el sitio en un iframe (por ejemplo, una
vista previa alojada en otro dominio). En desarrollo se habilitan automáticamente los hosts de
previsualización (`*.e2b.app`, `*.arena.ai`): esos hosts se tratan como HTTPS aunque el proxy no
envíe `X-Forwarded-Proto` —así los enlaces, QR y `canonical` no salen como `http://`— y las
cookies pasan a `SameSite=None; Secure` para que la sesión funcione dentro del marco. Con `NODE_ENV=production` y sin `EMBED_ORIGINS` la
política vuelve a ser estricta (`SAMEORIGIN` + `frame-ancestors 'self'`).

### Diagnóstico de la vista previa

`DEBUG_REQUESTS=1 npm start` registra host, protocolo reenviado y referer de cada petición. Sirve
para confirmar por qué dominio entra el navegador cuando se depura un proxy o una vista previa.

### Ingreso en la vista previa (sesión sin cookies)

Algunos navegadores bloquean por completo las cookies de terceros dentro del iframe de la
vista previa. Para que ingresar, administrar y crear memoriales funcione igual, el sitio tiene
un respaldo: la sesión viaja como `?s=<token>` en los enlaces y formularios internos, y el
servidor la reconoce aunque no reciba cookies.

- Solo se activa en modo embebido (`EMBED_ORIGINS`) y cuando la petición no trae cookies.
- Los enlaces externos y los archivos estáticos nunca reciben el token.
- Las páginas con token se sirven con `Cache-Control: no-store`, `Referrer-Policy: same-origin`
  y `X-Robots-Tag: noindex`.
- En los POST sin cookie CSRF se acepta el token del formulario solo si la petición no declara
  un origen ajeno; la sesión se valida siempre contra la base de datos.
- El CSP de la vista previa incluye los orígenes embebidos en `frame-ancestors` y en
  `form-action`, para que los formularios funcionen incluso dentro de un iframe con sandbox.
- En producción sin `EMBED_ORIGINS` esta ruta no existe: todo sigue con cookies y CSRF de
  doble envío.

### Enlace fijo de prueba

En modo demostración existe **`/probar`**: muestra la URL pública de la instalación con su código
QR y permite entrar al panel de demo con un clic (`/probar?entrar=1`). Es la forma más rápida de
probar la plataforma en el computador o en el teléfono sin escribir credenciales. La ruta se
desactiva sola con `PAYMENTS_MODE=live` (o con `DEMO_ACCESS=off`) y responde 404 en producción.

Además, mientras no haya sesión, todas las páginas muestran una franja de **modo demostración** con
acceso directo al panel.

> **Sobre el enlace en entornos de preview:** si el sitio corre en un sandbox de E2B con tráfico
> restringido, su URL `*.e2b.app` exige la cabecera `e2b-traffic-access-token`. Ningún navegador
> puede enviarla al abrir un enlace, así que el sitio solo se ve a través del panel de vista previa
> de la plataforma (que inyecta el token). Al desplegar en un dominio propio esta restricción
> desaparece y `/probar` funciona como cualquier URL pública.

## 🧭 Recorrido del producto

1. **Registro** → cuenta gratis con 0 créditos.
2. **Compra** → `/panel/planes` → checkout → comprobante. En modo demo el pago se simula y los
   créditos se acreditan al instante (idempotente por referencia).
3. **Creación** → `/panel/nuevo` con vista previa en vivo; descuenta 1 crédito y genera slug, QR y
   certificado. Si algo falla, el crédito se devuelve.
4. **Administración** → `/panel/memoriales/:id`: detalles, fotos (principal, orden y descripciones),
   video, música, libro de visitas, compartir/QR, tarjeta conmemorativa, certificado y eliminación
   con confirmación por nombre.
5. **Memorial público** → `/m/:slug`: portada con retrato, historia, galería con lightbox y
   presentación, video, libro de visitas paginado, velas y QR.
6. **Jardín público** → `/memoriales`: búsqueda por nombre, relación o frase y filtros por personas o
   mascotas.
7. **Certificado privado** → `/certificado/JM-AAAA-XXXXX`: solo lo abre la cuenta titular;
   a cualquier otra persona se le responde 404.

## 🗂 Estructura

```
server.js                 arranque, seed inicial y cierre ordenado
src/
  app.js                  Express, CSP/headers, estáticos, sitemap, errores
  config.js               marca, precios, límites, temas
  db.js                   node:sqlite (WAL) + esquema y helpers
  store.js                consultas y transacciones de negocio
  auth.js                 sesiones, flash, guards y carga de memoriales
  security.js             scrypt, CSRF doble envío, rate limiting
  media.js                sharp (fotos), duración MP3, validación MP4/MOV
  qr.js / certificate.js  QR y certificado PDF (PDFKit + tipografías de marca)
  poster.js               tarjeta conmemorativa A5 con retrato y QR
  icons.js                set de iconos y logotipo
  routes/                 public · auth · panel · memorial
views/                    layout general + layout propio del memorial
public/css|js|img|audio|fonts
scripts/                  seed-demo.js y generate_music.py (melodía ambiente)
```

## 🔐 Seguridad y privacidad

- Contraseñas con **scrypt** + salt; comparación en tiempo constante.
- Sesiones con token aleatorio en cookie `HttpOnly`, `SameSite=Lax` y expiración de 30 días.
- **CSRF de doble envío** en todos los POST (también en multipart, validado después de Multer).
  En la vista previa embebida sin cookies se acepta el token del formulario con validación de
  origen (ver «Ingreso en la vista previa»).
- **Rate limiting** por IP en ingreso, registro, compras, firmas y velas.
- Cabeceras CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options` y `Permissions-Policy`.
- Autorización estricta: un memorial solo lo administra su titular (403 en caso contrario) y los
  memoriales privados devuelven 404 a terceros.
- Validación de archivos por MIME + contenido real: imágenes reprocesadas con `sharp` (nunca se
  sirve el original), MP3 verificado por frames, video por contenedor ISO-BMFF y duración real.
- Escapado EJS en todas las salidas y nombres de archivo aleatorios (sin rutas del usuario).
- Honeypot anti-bots y moderación del libro de visitas.

## ⚙️ Límites configurables (`src/config.js`)

| Límite | Valor |
| --- | --- |
| Fotos por memorial | 10 |
| Tamaño por imagen | 15 MB |
| Video | 60 s · 120 MB · MP4/MOV |
| Música | 20 MB · MP3 |
| Mensaje del libro | 1.200 caracteres |

## 🧾 Pagos en producción

`PAYMENTS_MODE=demo` simula la compra para poder probar el flujo completo. Para cobrar de verdad:

1. Define `PAYMENTS_MODE=live` y conecta una pasarela chilena (Webpay Plus / Mercado Pago) en
   `src/routes/panel.js` (`POST /panel/comprar/:plan`), creando la transacción y acreditando los
   créditos **solo** en el webhook de confirmación.
2. Configura `BASE_URL` con el dominio real y sirve el sitio bajo HTTPS (obligatorio para cookies
   `Secure`, portapapeles y autoplay de audio).
3. Respalda periódicamente `data/` (SQLite + uploads) y mantén el proceso detrás de un proxy con
   límite de tamaño de subida coherente con los límites de la app.

## 🧪 Pruebas manuales sugeridas

- Registro, ingreso y cierre de sesión; contraseña incorrecta y correo duplicado.
- Compra individual y pack; verificar créditos y comprobante.
- Crear memorial con y sin foto; comprobar slug, QR y certificado.
- Subir 8 fotos con 4 existentes (acepta 6 y avisa), intentar una foto más (bloquea).
- Subir video de 42 s (acepta) y de 75 s (rechaza con mensaje claro).
- Firmar el libro de visitas, encender velas y superar el límite de intentos.
- Cambiar el memorial a privado: terceros reciben 404, el titular lo ve.
- Buscar en `/memoriales` por nombre y filtrar por mascotas; probar un término sin resultados.
- Moderar un mensaje desde `/panel/mensajes` y desde el editor del memorial.
- Descargar el certificado PDF desde el panel; abrir `/certificado/JM-AAAA-XXXXX` con la cuenta titular y confirmar que un tercero recibe 404.
- Descargar la tarjeta conmemorativa y escanear su QR con el celular.
- Reordenar fotos y reproducir la presentación de recuerdos desde el lightbox.
- Con más de 30 mensajes, usar “Ver más mensajes” y confirmar que el contador avanza.

## 🎨 Créditos

- Tipografías: pilas del sistema (**Georgia / Iowan Old Style / Palatino** para títulos y
  **system-ui / Segoe UI / Roboto** para texto). No se descargan fuentes: la página carga
  más rápido y se lee nítida en cualquier dispositivo y tamaño de pantalla.
- Melodía ambiente generada con síntesis propia (`scripts/generate_music.py`, 128 kbps).
- Fotografía de demostración generada para este proyecto.

## 🎮 Demo interactiva (`/demo`)

La demo no depende de una cuenta ni de cookies, porque el sitio se muestra dentro de una
vista previa embebida donde el navegador puede bloquearlas. Todo ocurre en la misma pantalla:

- elegir cualquiera de los memoriales de ejemplo;
- encender una vela y dejar un mensaje en el libro de visitas;
- cambiar el tema, la visibilidad y el estado del libro de visitas;
- crear un memorial de prueba, que nace privado como en el panel real, y quitarlo
  cuando ya lo probaste (hasta 8 memoriales en la cuenta de ejemplo).

Los formularios de la demo envían a `/demo/*` y vuelven a `/demo`, sin abrir pestañas ni
depender de la sesión. Los enlaces que salen de la demo (inicio, memorial completo, registro)
se resuelven en la misma pantalla, sin abrir pestañas. Los POST comprueban el origen y están
limitados por IP y navegador. Cuando el sitio pasa a producción (`DEMO_ACCESS=off`) todo `/demo` redirige a `/memoriales`.

La portada abre esta demo en un visor dentro de la misma página: los botones «Visitar un
ejemplo», «Recorrer un memorial» y «Ver un memorial de ejemplo» cargan `/demo` en el visor,
que se cierra con la ✕, con Escape o tocando fuera.

## 🔑 Ingreso, demo y creación de cuenta

- No se abren pestañas nuevas: los enlaces internos (memorial, certificado, compartir) se
  resuelven en la misma pantalla. Los enlaces externos (WhatsApp, Instagram) también se abren
  en la misma pestaña.
- Al ingresar (o crear una cuenta) se vuelve a la **página principal**, no al panel:
  la portada muestra una barra con el nombre, los memoriales disponibles, «Mi jardín»
  y «Cerrar sesión». El panel queda a un clic.
- La demo (`/probar?entrar=1`) hace lo mismo: deja la sesión de ejemplo activa en la
  portada y muestra la cinta «Cuenta de demostración».
- Si ya hay una sesión abierta, `/ingresar` y `/registro` no rebotan al panel: vuelven
  a la portada con un aviso que invita a cerrar sesión primero.
- Los formularios con error llevan el foco al aviso de validación.
- El campo trampa se llama `jm_hp` (antes `website`) para que el autocompletado del
  navegador no lo rellene y bloquee el registro por error.
- Los límites de intentos se cuentan por IP **y** navegador, y se reinician al acertar,
  así una vista previa compartida no bloquea a quien intenta registrarse.

## 🧩 Diseño, accesibilidad y caché

- **Diseño fluido**: `body { overflow-x: clip }`, contenedores con `padding` adaptable
  (`clamp()` + `env(safe-area-inset-*)`), imágenes `max-width: 100%` y tipografía con
  `clamp()`. Los paneles y tablas se reordenan a una columna en pantallas pequeñas y
  las tablas anchas viven dentro de `.table-scroll` para no desbordar.
- **Contraste**: el texto principal es negro (`--ink #0a0a0a`) sobre fondos crema.
  Solo los botones rellenos y el héroe fotográfico del memorial conservan texto claro,
  porque su fondo es oscuro y así se mantiene la legibilidad AA.
- **Objetivos táctiles** de 44 px y campos de 16 px como mínimo (evita el zoom automático
  de iOS al enfocar un formulario).
- **Caché**: `src/assets.js` calcula una huella de `public/css` y `public/js`; la vista la
  expone como `?v=...`, así el navegador descarta el CSS antiguo en cada despliegue.
- **Vista previa embebida**: en hosts de `EMBED_ORIGINS` las cookies se emiten con
  `SameSite=None; Secure; Partitioned` (CHIPS). Si el navegador bloquea incluso esas cookies,
  `src/embed-session.js` mantiene la sesión por enlace (`?s=`) sin abrir pestañas.

Hecho con cuidado en Chile 🍃
