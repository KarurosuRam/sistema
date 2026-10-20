# 🌿 Jardín Memorial — www.jardinmemorial.cl

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
| Libro de visitas | Mensajes moderables (ocultar/eliminar), velas virtuales y protección anti-spam |

Extras: diseño editorial responsive, memoriales públicos o privados, sitemap/SEO, página de
demo, centro de ayuda, términos, privacidad y comprobantes de compra.

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
(`demo`/`live`), `SEED_DEMO`. Los datos viven en `./data` — base `jardin.sqlite` (WAL) y
`data/uploads/{img,audio,video}` — y están excluidos de Git.

## 🧭 Recorrido del producto

1. **Registro** → cuenta gratis con 0 créditos.
2. **Compra** → `/panel/planes` → checkout → comprobante. En modo demo el pago se simula y los
   créditos se acreditan al instante (idempotente por referencia).
3. **Creación** → `/panel/nuevo` con vista previa en vivo; descuenta 1 crédito y genera slug, QR y
   certificado. Si algo falla, el crédito se devuelve.
4. **Administración** → `/panel/memoriales/:id`: detalles, fotos, video, música, libro de visitas,
   compartir/QR, certificado y eliminación con confirmación por nombre.
5. **Memorial público** → `/m/:slug`: portada con retrato, historia, galería con lightbox, video,
   libro de visitas, velas, QR y acceso al certificado.
6. **Verificación** → `/certificado` y `/certificado/JM-AAAA-XXXXX`.

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
- Descargar el certificado PDF y verificarlo en `/certificado`.

## 🎨 Créditos

- Tipografías: **Cormorant Garamond** y **Jost** (SIL Open Font License, empaquetadas localmente).
- Melodía ambiente generada con síntesis propia (`scripts/generate_music.py`, 128 kbps).
- Fotografía de demostración generada para este proyecto.

Hecho con cuidado en Chile 🍃
