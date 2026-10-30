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
| Certificado de propiedad | PDF A4 horizontal con código único, firmas y QR; privado, solo lo descarga la cuenta titular |
| Foto principal | Primera foto del memorial, reordenable desde el panel |
| Hasta 10 fotos | Carga múltiple, miniaturas optimizadas, descripciones y control estricto del límite |
| Video de máx. 60 s | MP4/MOV hasta 120 MB; se inspecciona la duración real del contenedor y se rechaza si excede |
| Música MP3 al abrir | MP3 hasta 20 MB, reproducción automática con respaldo amable si el navegador la bloquea |
| Libro de visitas | Mensajes moderables (ocultar/eliminar), velas virtuales, paginación y protección anti-spam |

Extras: **tarjeta conmemorativa A5 imprimible** con retrato y QR, **presentación de recuerdos**
(slideshow del lightbox), reordenamiento de la galería, **búsqueda y filtros en el jardín público**,
**moderación global de mensajes**, **respaldo JSON** por memorial, diseño editorial responsive,
memoriales públicos o privados, sitemap/SEO, centro de ayuda, términos, privacidad
y comprobantes de compra.

## 🚀 Puesta en marcha

Requisitos: **Node.js 22.5+** (usa el módulo nativo `node:sqlite`).

```bash
npm install
npm start          # incluye --experimental-sqlite
# → http://localhost:3000
```

Para configurar correo, pagos y dominio, copia `.env.example` a `.env` y edítalo: la app
lee ese archivo sola al arrancar (lo que ya exista en el entorno tiene prioridad).

La base parte **vacía**: el sitio no siembra cuentas, memoriales ni compras de ejemplo. El primer
registro desde `/registro` crea la primera cuenta real. Si alguna vez cargaste el contenido de
ejemplo para desarrollo (`SEED_DEMO=true`), retíralo con:

```bash
npm run purge-demo
```

Para revisar el sitio con contenido realista en una instalación vacía —una vista previa temporal o
un entorno de prueba— hay cuatro memoriales de ejemplo listos (`npm run seed-ejemplos`). Deja la
cuenta `ccramireza@gmail.com` / `jardin2026` con un pack de 4 comprado, cuatro memoriales con foto,
galería, música y libro de visitas, y no duplica nada si la cuenta ya existe.

### Puesta en marcha en producción

```bash
cp .env.example .env      # completa SITE_URL, credenciales de pago y DATA_DIR
npm ci --omit=dev
npm start
```

También hay una imagen lista para Docker:

```bash
docker build -t jardin-memorial .
docker run -d --name jardin-memorial -p 3000:3000 \
  --env-file .env -v /srv/jardin-data:/app/data jardin-memorial
```

### Variables de entorno

Todas las variables están documentadas en `.env.example`. Las principales:

| Variable | Para qué |
| --- | --- |
| `SITE_URL` | URL pública HTTPS de la app; se usa en pagos, QR y certificados |
| `PAYMENTS_MODE` | `mercadopago` (recomendado), `flow` o `demo` (simulado) |
| `MP_ACCESS_TOKEN` | Access Token de Mercado Pago (`TEST-…` o `APP_USR-…`) |
| `MP_ENV` | `sandbox` o `production` |
| `MP_WEBHOOK_SECRET` | Secreto de firma del webhook (opcional) |
| `FLOW_ENV` | `sandbox` o `production` (alternativa Flow) |
| `FLOW_API_KEY` / `FLOW_SECRET_KEY` | Credenciales del comercio en Flow |
| `DATA_DIR` | Carpeta de la base SQLite y los uploads (por omisión `./data`) |
| `SEED_DEMO` | Siembra contenido de ejemplo solo en desarrollo (`true`); por omisión no siembra nada |
| `EMBED_ORIGINS` | Dominios autorizados a mostrar la app en iframe |
| `COOKIE_DOMAIN` | Cookie compartida entre subdominios (opcional) |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` | Servidor SMTP para el enlace de recuperación de contraseña |
| `MAIL_USER` / `MAIL_PASS` / `MAIL_FROM` | Credenciales y remitente del correo saliente |
| `MAIL_TRANSPORT` | `json` imprime los correos en consola (solo desarrollo) |
| `ADMIN_EMAILS` | Correo(s) con acceso a `/panel/admin/pagos` y `/panel/admin/correo` |
| `PORT` | Puerto interno (3000) |

La app lee `.env` automáticamente al arrancar (`npm start`, `npm run seed`, etc.); si una
variable ya existe en el entorno —Docker, systemd o la shell— esa tiene prioridad.
Sin credenciales de pago funciona en **modo demostración**; con un Access Token de
Mercado Pago (o las llaves de Flow) cobra de verdad. Los datos viven en `DATA_DIR` — base
`jardin.sqlite` (WAL) y `data/uploads/{img,audio,video}` — y están excluidos de Git.

`EMBED_ORIGINS` autoriza orígenes externos a mostrar el sitio en un iframe (por ejemplo, el
dominio de WordPress o una vista previa alojada en otro dominio). En desarrollo se habilitan
automáticamente los hosts de previsualización (`*.e2b.app`, `*.arena.ai`): esos hosts se tratan
como HTTPS aunque el proxy no envíe `X-Forwarded-Proto` —así los enlaces, QR y `canonical` no
salen como `http://`— y las cookies pasan a `SameSite=None; Secure` para que la sesión funcione
dentro del marco. Con `NODE_ENV=production` y sin `EMBED_ORIGINS` la política vuelve a ser
estricta (`SAMEORIGIN` + `frame-ancestors 'self'`).

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

> **Sobre el enlace en entornos de preview:** si el sitio corre en un sandbox de E2B con tráfico
> restringido, su URL `*.e2b.app` exige la cabecera `e2b-traffic-access-token`. Ningún navegador
> puede enviarla al abrir un enlace, así que el sitio solo se ve a través del panel de vista previa
> de la plataforma (que inyecta el token). Al desplegar en un dominio propio esta restricción
> desaparece.

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
  mercadopago.js / flow.js  clientes de Mercado Pago y Flow
  payments.js             órdenes, verificación y acreditación idempotente
  embed-session.js        sesión por enlace para iframes sin cookies
  icons.js                set de iconos y logotipo
  routes/                 public · auth · panel · payments · memorial
views/                    layout general + layout propio del memorial
public/css|js|img|audio|fonts
scripts/                  seed-demo.js, purge-demo.js y generate_music.py
docs/                     mercadopago.md, flow.md y wordpress.md
deploy/                   wordpress/ (compose, plugin), systemd/, nginx/
Dockerfile                imagen de producción (Node 22 + node:sqlite)
```

## 🔐 Seguridad y privacidad

- Contraseñas con **scrypt** + salt; comparación en tiempo constante.
- Sesiones con token aleatorio en cookie `HttpOnly`, `SameSite=Lax` y expiración de 30 días
  (`SameSite=None; Secure; Partitioned` cuando la app se muestra incrustada).
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

## 🧾 Pagos

La pasarela recomendada es **Mercado Pago Checkout Pro**: alta online, sin contrato ni
abono mensual, panel en español y credenciales de prueba inmediatas. Flow queda disponible
como alternativa si ya tienes comercio ahí.

Sin credenciales, la compra pasa por una **pasarela de prueba** dentro de la app
(`/pago/demo/…`): muestra el paso de pago, no pide tarjeta y permite aprobar o cancelar la
compra para ver el recorrido completo. No cobra dinero real.

Con credenciales, el comprador paga en el sitio de la pasarela y los cupos se acreditan
**solo** cuando la API confirma el pago:

1. La app crea la orden (Mercado Pago: `POST /checkout/preferences`; Flow:
   `POST /payment/create`) con la referencia `JM-…`, el monto del plan en CLP, el correo
   del titular y las URLs de vuelta y notificación.
2. La pasarela confirma por webhook (Mercado Pago: `POST /pago/mp/webhook` con firma
   `x-signature`; Flow: `POST /pago/confirmacion` con token) y la app **consulta el pago
   real** antes de acreditar.
3. El navegador vuelve por `/pago/mp/retorno` o `/pago/retorno`, que vuelve a consultar el
   estado y lleva al comprobante. Si el pago aún no llegó, queda **Pendiente** con el botón
   **Verificar pago**.

Se acredita una sola vez aunque la pasarela reintente; un monto o una referencia que no
coincidan no suman cupos. Mercado Pago no expone datos de tarjeta a la app.

```bash
PAYMENTS_MODE=mercadopago
MP_ENV=production
MP_ACCESS_TOKEN=APP_USR-...
SITE_URL=https://memoriales.tudominio.cl
```

Con `ADMIN_EMAILS=tu@correo.cl` aparece en el panel la página
**`/panel/admin/pagos`**: pasarela activa, ambiente, credenciales enmascaradas, URLs de
webhook y retorno listas para copiar, ventas del período y un botón **Probar credenciales**
que consulta la cuenta real de Mercado Pago sin crear cobros. Ahí mismo se pueden **pegar
las credenciales** (se guardan cifradas en la base y se aplican sin reiniciar); el token se
valida contra la API antes de aceptarlo. Las variables del entorno tienen prioridad.

Desde la misma página se resuelven las dos tareas del día a día: **Verificar** una compra
pendiente (consulta el pago real en Mercado Pago y acredita si está aprobado) y
**Reembolsar** una compra pagada (`POST /v1/payments/{id}/refunds`; solo si Mercado Pago
acepta, la app marca la compra como reembolsada y descuenta los cupos que seguían sin usar,
sin borrar los memoriales creados). Si devuelves el dinero desde el panel de Mercado Pago,
el webhook aplica el mismo cierre. Detalle en [`docs/mercadopago.md`](docs/mercadopago.md).

Guía paso a paso, credenciales y tarjetas de prueba:
**[`docs/mercadopago.md`](docs/mercadopago.md)**. Alternativa con Webpay/MACH:
**[`docs/flow.md`](docs/flow.md)**.

Para recorrer la aplicación como un cliente real, sin tocar los datos del sitio, existe un
**entorno de prueba** con base propia: `scripts/entorno-prueba.sh` (ver
[`docs/entorno-prueba.md`](docs/entorno-prueba.md)).

> **La vista previa de este proyecto no tiene salida a internet hacia Mercado Pago ni
> Flow**, así que ahí los cobros siempre serán simulados y «Probar credenciales» dirá que
> no puede conectarse. Para cobrar de verdad hay que publicar la app en un servidor con
> internet (ver [`docs/wordpress.md`](docs/wordpress.md)).

### ¿No cobra y sigue en demostración?

La app arranca en modo demostración cuando no encuentra credenciales. Revisa:

1. `curl https://tu-dominio/pago/estado` → `modo` debe ser `mercadopago` (o `flow`), no `demo`.
   El campo `aviso` dice qué falta.
2. `MP_ACCESS_TOKEN` (empieza con `TEST-` en pruebas, `APP_USR-` en producción) y
   `SITE_URL` en **HTTPS**.
3. Si usas `.env`, que esté en la carpeta del proyecto (la app lo lee sola) y que el
   proceso lo vea: `npm start` desde esa carpeta, o `docker compose up -d --force-recreate`
   después de cambiar variables.
4. En producción, `MP_ENV=production` y el webhook `https://tu-dominio/pago/mp/webhook`
   registrado en Mercado Pago.

## 🧩 Instalación en WordPress

La app puede publicarse dentro de un WordPress existente: corre en un subdominio propio
(`memoriales.tudominio.cl`) y se inserta en una página con un iframe del mismo dominio
registrable, de modo que la sesión sigue funcionando.

Incluido en el repositorio:

- `deploy/wordpress/docker-compose.yml` — WordPress + MariaDB + app + Caddy con HTTPS automático.
- `deploy/wordpress/plugin/jardin-memorial/` y `jardin-memorial.zip` — plugin con los shortcodes
  `[jardin_memorial]` y `[jardin_memorial_enlace]`, ajustes y plantilla de página a pantalla completa.
- `deploy/systemd/` y `deploy/nginx/` — servicio y proxy inverso para una instalación sin Docker.
- `Dockerfile` — imagen de la app para producción.

Guía paso a paso (DNS, requisitos, las dos formas de instalación, plugin, respaldos, verificación y
problemas frecuentes): **[`docs/wordpress.md`](docs/wordpress.md)**.

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
- Pedir recuperación con un correo que no existe: la respuesta debe ser igual que con uno
  registrado y no debe aparecer ningún enlace.
- Abrir el enlace de recuperación, cambiar la clave e ingresar; volver a abrir el mismo
  enlace debe responder 410. Con SMTP sin configurar el enlace aparece en pantalla (desarrollo)
  o en `/panel/admin/correo` (producción).
- En `/panel/admin/pagos`: **Verificar** una compra pendiente y **Reembolsar** una pagada
  con Mercado Pago real; repetir el reembolso no debe devolver el dinero dos veces.

## 🎨 Créditos

- Tipografías: pilas del sistema (**Georgia / Iowan Old Style / Palatino** para títulos y
  **system-ui / Segoe UI / Roboto** para texto). No se descargan fuentes: la página carga
  más rápido y se lee nítida en cualquier dispositivo y tamaño de pantalla.
- Melodía ambiente generada con síntesis propia (`scripts/generate_music.py`, 128 kbps).
- Fotografía de portada generada para este proyecto.

## 🔑 Ingreso y creación de cuenta

- No se abren pestañas nuevas: los enlaces internos (memorial, certificado, compartir) se
  resuelven en la misma pantalla. Los enlaces externos (WhatsApp, Instagram) también se abren
  en la misma pestaña.
- Al ingresar (o crear una cuenta) se vuelve a la **página principal**, no al panel:
  la portada muestra una barra con el nombre, los memoriales disponibles, «Mi jardín»
  y «Cerrar sesión». El panel queda a un clic.
- Si ya hay una sesión abierta, `/ingresar` y `/registro` no rebotan al panel: vuelven
  a la portada con un aviso que invita a cerrar sesión primero.
- Los formularios con error llevan el foco al aviso de validación.
- El campo trampa se llama `jm_hp` (antes `website`) para que el autocompletado del
  navegador no lo rellene y bloquee el registro por error.
- Los límites de intentos se cuentan por IP **y** navegador, y se reinician al acertar,
  así una vista previa compartida no bloquea a quien intenta registrarse.

### Recuperar una contraseña

Solo para cuentas ya registradas: la persona escribe su correo en `/recuperar` y recibe un
enlace de un solo uso para elegir una clave nueva en `/restablecer/<token>`.

- La respuesta de `/recuperar` es **idéntica** exista o no la cuenta, así el formulario no
  sirve para averiguar quién está registrado.
- El token son 32 bytes aleatorios; en la base solo se guarda su hash SHA-256. Vale
  **60 minutos**, se invalida al usarlo y anula cualquier enlace anterior de la misma cuenta.
- Al cambiar la clave se cierran **todas las sesiones abiertas** de esa cuenta, incluida la
  del dispositivo que hizo el cambio; después se ingresa con la clave nueva.
- Un enlace vencido o ya usado responde `410` con un aviso y un botón para pedir otro.
- El envío tiene límite propio (8 solicitudes por 30 minutos e IP).

**Sin SMTP configurado** la app no falla: registra en el log el enlace generado y, en
desarrollo, lo muestra en pantalla. Para enviar correo de verdad define `MAIL_*`
(ver `.env.example`). Si quien administra no tiene acceso al servidor de correo, entra en
**`/panel/admin/correo`** con una cuenta de `ADMIN_EMAILS`: ahí ve los pedidos pendientes,
genera un enlace nuevo (los guardados son solo hash y no se pueden releer) y prueba la
conexión SMTP con un correo de prueba. La contraseña del SMTP se guarda cifrada
(AES-256-GCM) igual que los tokens de pago.

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
