# Instalar Jardín Memorial en un sitio WordPress

Guía completa para dejar la plataforma de memoriales funcionando **junto a un
WordPress existente**, con pagos reales (Mercado Pago o Flow), sin tocar el tema ni los plugins del
sitio principal.

---

## 1. Cómo queda armado

La app de memoriales es una aplicación **Node.js con Express**. WordPress no ejecuta
Node, así que la app corre como un servicio aparte y WordPress la muestra dentro de una
página mediante un **iframe** (con el plugin incluido). Cada uno vive en su propio
dominio:

```
                     Internet
                        │
                 ┌──────┴───────┐   HTTPS (Caddy o Nginx + certbot)
                 │              │
   www.tudominio.cl      memoriales.tudominio.cl
        │                          │
   ┌────┴─────┐              ┌─────┴─────┐
   │ WordPress│              │  App Node │  ← panel, memoriales,
   │  (PHP)   │              │  Express  │    checkout y pagos
   └──────────┘              └───────────┘
        │                          │
   MariaDB/MySQL              SQLite + uploads (data/)
```

| Pieza | Dónde vive | Para qué |
| --- | --- | --- |
| WordPress | `www.tudominio.cl` | Sitio institucional (historia, precios, contacto, blog) |
| App Node | `memoriales.tudominio.cl` | Registro, panel, memoriales, QR, certificados y pagos |
| Plugin | Dentro de WordPress | Inserta la app en una página y crea enlaces al panel |

### ¿Por qué un subdominio y no una carpeta?

- La app genera enlaces absolutos (`/m/<slug>`, `/panel/...`). Servirla bajo
  `www.tudominio.cl/memoriales/` obligaría a reescribir todas las rutas y a un proxy con
  `sub_filter`; es frágil y rompe el QR y los certificados.
- Con dos subdominios del **mismo dominio registrable** (`tudominio.cl`), el iframe es
  *same-site*: las cookies de sesión (`SameSite=Lax`) funcionan normalmente dentro del
  marco, sin necesidad de cookies de terceros.
- El certificado de propiedad y el QR siempre apuntan a `SITE_URL`. Si la app vive en
  `memoriales.tudominio.cl`, esos enlaces siguen siendo válidos desde cualquier lugar.

> **Importante:** `memoriales.tudominio.cl` debe ser un subdominio real del mismo dominio
> de WordPress, no un dominio distinto ni un `*.vercel.app`/`*.netlify.app`. Si son
> dominios distintos, el navegador trata el iframe como terceros y puede bloquear la
> sesión.

---

## 2. Requisitos

| Recurso | Mínimo recomendado |
| --- | --- |
| Servidor | VPS 2 vCPU · 2 GB RAM · 40 GB SSD (Ubuntu 22.04/24.04) |
| Node.js | **22.5 o superior** (la app usa `node:sqlite`) |
| Docker | Opcional, solo para la instalación con `docker compose` |
| Dominio | Acceso al DNS para crear dos registros `A`/`AAAA` |
| Correo | Una casilla para los certificados TLS (Let's Encrypt) y el contacto del sitio |
| Pagos | Cuenta de Mercado Pago con Access Token (ver [`mercadopago.md`](mercadopago.md)); Flow es opcional |

Si el WordPress ya está alojado en un hosting compartido (cPanel, Plesk, Hostinger, etc.)
**sin acceso a Node**, no se puede instalar la app en ese mismo hosting: hay dos caminos
válidos:

1. Mudar el sitio a un VPS con Docker (opción A) y conservar la base y los archivos de
   WordPress (se restauran con un plugin de migración).
2. Contratar un VPS pequeño solo para la app, apuntar
   `memoriales.tudominio.cl` a ese VPS y dejar WordPress donde está (opción B). El
   iframe funciona igual porque sigue siendo el mismo dominio registrable.

---

## 3. Opción A — Todo en un VPS con Docker (recomendada)

Este repositorio incluye un `docker-compose.yml` con WordPress, MariaDB, la app y Caddy
(HTTPS automático). Es la vía más rápida para una instalación nueva.

### 3.1 DNS

Crea dos registros en el proveedor del dominio:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| `A` | `www` | IP del VPS |
| `A` | `memoriales` | IP del VPS |

Espera la propagación (`dig www.tudominio.cl`, `dig memoriales.tudominio.cl`) antes de
pedir el certificado: Let's Encrypt valida el dominio por HTTP.

### 3.2 Preparar el servidor

```bash
# Ubuntu 24.04
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # cierra y vuelve a entrar
docker compose version
```

Abre los puertos **80** y **443** en el firewall del proveedor y del sistema:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3.3 Subir el proyecto

```bash
git clone https://github.com/KarurosuRam/sistema.git /opt/jardin-memorial
cd /opt/jardin-memorial/deploy/wordpress
cp .env.example .env
nano .env
```

Completa como mínimo:

```ini
WORDPRESS_DOMAIN=www.tudominio.cl
APP_DOMAIN=memoriales.tudominio.cl
ACME_EMAIL=hola@tudominio.cl

MYSQL_PASSWORD=una-clave-larga-y-unica
MYSQL_ROOT_PASSWORD=otra-clave-larga-y-unica

PAYMENTS_MODE=mercadopago
MP_ENV=production
MP_ACCESS_TOKEN=APP_USR-...
SEED_DEMO=false
```

> Guía de pagos: [`mercadopago.md`](mercadopago.md) (recomendada) o
> [`flow.md`](flow.md) si prefieres Flow.

### 3.4 Levantar los servicios

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app       # Ctrl+C para salir del log
```

Cuando termine:

- `https://www.tudominio.cl` → instalación de WordPress (elige idioma, título, usuario y
  contraseña). **No uses “admin” como usuario.**
- `https://memoriales.tudominio.cl` → portada de Jardín Memorial.
- `https://memoriales.tudominio.cl/healthz` → `{"ok":true,...}`.
- `https://memoriales.tudominio.cl/pago/estado` → estado de la configuración de pagos.

Caddy obtiene los certificados solo. Si algo falla, `docker compose logs caddy` muestra
el motivo (casi siempre DNS sin propagar o puerto 80 cerrado).

### 3.5 Instalar el plugin de WordPress

```bash
cd /opt/jardin-memorial/deploy/wordpress
docker compose cp plugin/jardin-memorial wordpress:/var/www/html/wp-content/plugins/
docker compose exec wordpress chown -R www-data:www-data /var/www/html/wp-content/plugins/jardin-memorial
```

Luego, en el panel de WordPress: **Plugins → Plugins instalados → Jardín Memorial →
Activar**.

> Alternativa sin consola: genera el ZIP con `./build-plugin.sh` y súbelo en
> **Plugins → Añadir nuevo → Subir plugin**.

### 3.6 Conectar el plugin con la app

**Ajustes → Jardín Memorial**:

- **URL de la aplicación**: `https://memoriales.tudominio.cl` (sin barra final).
- **Alto por defecto**: `1200` (o `full` en el shortcode para pantalla completa).
- Guarda. El aviso de “falta indicar la URL” desaparece.

### 3.7 Crear la página de memoriales

1. **Páginas → Añadir nueva**: título «Memoriales».
2. Escribe el shortcode `[jardin_memorial]`.
3. En **Atributos de página → Plantilla**, elige
   **«Jardín Memorial (pantalla completa)»** (temas clásicos). En temas de bloques,
   usa el shortcode dentro de un bloque de ancho completo.
4. Publica y añade la página al menú (**Apariencia → Menús**).

La página muestra la app completa (portada, jardín, registro, panel y pagos) sin el
encabezado ni el pie del tema, y con el encabezado propio de la app como navegación.
Si prefieres que la página conserve el encabezado de WordPress, no uses la plantilla y
escribe `[jardin_memorial chrome="0"]`: el iframe se integra debajo del menú del sitio.

### 3.8 Enlaces útiles en el menú

```
[jardin_memorial_enlace texto="Crear un memorial" ruta="/registro"]
[jardin_memorial_enlace texto="Mi jardín" ruta="/panel"]
[jardin_memorial_enlace texto="Ingresar" ruta="/ingresar"]
```

Estos enlaces abren la app **fuera** del iframe (pantalla completa). Es lo recomendado
para el panel de administración, donde hay subida de fotos y videos.

---

## 4. Opción B — WordPress ya alojado + app en otro servidor

Se conserva el WordPress actual y solo se monta la app Node en un VPS (o en el mismo
servidor, sin Docker). El subdominio `memoriales.tudominio.cl` apunta al nuevo servidor.

### 4.1 DNS

| Tipo | Nombre | Valor |
| --- | --- | --- |
| `A` | `memoriales` | IP del servidor de la app |

`www` se queda como está.

### 4.2 Instalar la app

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo useradd --system --create-home --shell /usr/sbin/nologin jm
sudo mkdir -p /opt/jardin-memorial && sudo chown jm:jm /opt/jardin-memorial
```

Copia el proyecto a `/opt/jardin-memorial` (git o `scp`), luego:

```bash
cd /opt/jardin-memorial
sudo -u jm npm ci --omit=dev
sudo mkdir -p /var/lib/jardin-memorial/{uploads,tmp}
sudo chown -R jm:jm /var/lib/jardin-memorial
sudo -u jm cp .env.example .env
sudo -u jm nano .env
```

La app lee ese `.env` automáticamente al arrancar (las variables del entorno tienen
prioridad, así que también puedes pasarlas por systemd o Docker). `.env` para este caso:

```ini
NODE_ENV=production
PORT=3000
SITE_URL=https://memoriales.tudominio.cl
EMBED_ORIGINS=https://www.tudominio.cl
DATA_DIR=/var/lib/jardin-memorial

PAYMENTS_MODE=mercadopago
MP_ENV=production
MP_ACCESS_TOKEN=APP_USR-...

SEED_DEMO=false
```

> `DATA_DIR` guarda `jardin.sqlite` y `uploads/`: es lo que hay que respaldar y lo que
> debe sobrevivir a cada despliegue. Nunca lo pongas dentro de la carpeta del código.

### 4.3 Servicio systemd

Copia `deploy/systemd/jardin-memorial.service` y ajústalo:

```bash
sudo cp deploy/systemd/jardin-memorial.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jardin-memorial
sudo systemctl status jardin-memorial
curl -s http://127.0.0.1:3000/healthz
```

### 4.4 Nginx y HTTPS

```bash
sudo cp deploy/nginx/jardin-memorial.conf /etc/nginx/sites-available/jardin-memorial
sudo ln -s /etc/nginx/sites-available/jardin-memorial /etc/nginx/sites-enabled/
sudo nano /etc/nginx/sites-available/jardin-memorial     # cambia server_name
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d memoriales.tudominio.cl
```

Certbot reescribe el bloque con el certificado y la redirección de HTTP a HTTPS.
Comprueba `https://memoriales.tudominio.cl/healthz`.

### 4.5 WordPress

Instala el plugin generado con `./build-plugin.sh` (**Plugins → Añadir nuevo → Subir
plugin**), configúralo con `https://memoriales.tudominio.cl` y crea la página con
`[jardin_memorial]`, igual que en los pasos 3.6 a 3.8.

En el WordPress actual hay que tener en cuenta:

- Si usa un plugin de **caché** (WP Rocket, LiteSpeed, W3TC), excluye la página del
  memorial y no cachees el iframe. La app ya envía `Cache-Control` adecuado.
- Si usa un plugin de **seguridad** que reescribe CSP (Wordfence, etc.), la cabecera de
  la app `frame-ancestors https://www.tudominio.cl` debe poder pasar; el iframe lo
  controla la app, no WordPress.
- Si el tema agrega `X-Frame-Options: SAMEORIGIN` a sus páginas, no afecta al iframe
  (el iframe carga la app, no al revés).
- Si usas **Elementor**, inserta el shortcode en un widget de “Shortcode” y pon la
  sección a ancho completo, sin márgenes.

---

## 5. Variables de entorno

Archivo de referencia: [`.env.example`](../.env.example). La app lee `.env` sola al
arrancar; en Docker las variables las inyecta `docker-compose.yml`.

Las credenciales de pago también se pueden pegar desde **Mi jardín → Pagos →
Conectar tu cuenta** (requiere `ADMIN_EMAILS`): se guardan cifradas en la base y se
aplican sin reiniciar. Las variables del entorno siempre tienen prioridad sobre ese
formulario, así que en Docker conviene seguir usando `docker-compose.yml`.

| Variable | Para qué | Ejemplo |
| --- | --- | --- |
| `SITE_URL` | URL pública de la app. Se usa en pagos, QR y certificados | `https://memoriales.tudominio.cl` |
| `EMBED_ORIGINS` | Dominios de WordPress autorizados a mostrar la app en iframe | `https://www.tudominio.cl` |
| `EMBED_CHROME` | `1` oculta siempre el encabezado/pie propios de la app; normalmente `0` | `0` |
| `PAYMENTS_MODE` | `mercadopago`, `flow` o `demo` (simulado) | `mercadopago` |
| `MP_ACCESS_TOKEN` | Access Token de Mercado Pago (pruebas o producción) | `TEST-…` / `APP_USR-…` |
| `MP_ENV` | `sandbox` o `production` | `production` |
| `MP_WEBHOOK_SECRET` | Secreto de firma del webhook (opcional) | — |
| `FLOW_ENV` | `sandbox` o `production` (solo si usas Flow) | `production` |
| `FLOW_API_KEY` / `FLOW_SECRET_KEY` | Credenciales del comercio Flow | — |
| `DATA_DIR` | Carpeta de la base y los archivos subidos | `/var/lib/jardin-memorial` |
| `SEED_DEMO` | Sembrar contenido de ejemplo en una base vacía | `false` |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` | SMTP para el enlace de recuperación de contraseña | `smtp.tuproveedor.cl` / `587` / `false` |
| `MAIL_USER` / `MAIL_PASS` | Usuario y clave (o clave de aplicación) del SMTP | `no-responder@tudominio.cl` |
| `MAIL_FROM` | Remitente que ve la persona | `Jardín Memorial <no-responder@tudominio.cl>` |
| `ADMIN_EMAILS` | Correo(s) con acceso a `/panel/admin/pagos` y `/panel/admin/correo` | `dueno@tudominio.cl` |
| `COOKIE_DOMAIN` | Dominio de la cookie de sesión, para compartirla entre subdominios | `.tudominio.cl` |
| `PORT` | Puerto interno de la app | `3000` |

`EMBED_ORIGINS` acepta varios valores separados por coma. Si se deja vacío en producción,
la app responde `X-Frame-Options: SAMEORIGIN` y el iframe de WordPress **no cargará**:
es el error más común de esta instalación.

`COOKIE_DOMAIN` solo hace falta si la app va a responder en más de un subdominio (por
ejemplo, `www` y `memoriales`) y quieres que la sesión sea la misma en ambos. Con la
instalación habitual —WordPress en `www` y la app solo en `memoriales`— no se necesita.

---

## 6. Cómo funciona la integración (para quien mantenga el sitio)

1. WordPress renderiza `[jardin_memorial]` → un `<iframe src="https://memoriales.tudominio.cl/?embed=1&chrome=1">`.
2. `?embed=1` guarda la cookie `jm_embed=1` y aplica los ajustes de estilo para ir dentro de
   un marco. La app **conserva su encabezado y pie**, que en la plantilla a pantalla completa
   son la única navegación del visitante (inicio, precios, memoriales, ingresar).
3. La app responde con `Content-Security-Policy: frame-ancestors 'self' https://www.tudominio.cl`
   y **sin** `X-Frame-Options`, para permitir solo a ese dominio.
4. Los formularios de la app son POST internos al subdominio. Al declarar `EMBED_ORIGINS`, la
   app emite sus cookies como `SameSite=None; Secure; Partitioned` para que funcionen dentro
   del marco; como WordPress y la app comparten el dominio registrable, la sesión es la misma
   tanto dentro del iframe como al abrir la app en una pestaña.
5. El pago sale de la app hacia `mercadopago.cl` (o `flow.cl`) en la ventana superior, no
   dentro del iframe: es la única redirección externa inevitable y necesaria para pagar.
6. Al volver de la pasarela, el comprador aterriza en el comprobante dentro del mismo
   dominio de la app.

### Ajustes finos

- **Alto del iframe**: `[jardin_memorial alto="900"]` o `[jardin_memorial alto="full"]`
  (100 % de la ventana).
- **Ruta inicial**: `[jardin_memorial ruta="/memoriales"]` o `ruta="/planes"`.
- **Sin encabezado ni pie de la app**: `[jardin_memorial chrome="0"]`. Úsalo si prefieres
  insertar el shortcode en una página normal del tema (con el encabezado de WordPress a la
  vista) en lugar de la plantilla a pantalla completa.
- **Sin modo embebido**: `[jardin_memorial embebido="0"]` carga la app tal cual, con su
  encabezado y pie.
- **Enlace directo**: `[jardin_memorial_enlace texto="Ingresar" ruta="/ingresar"]`.

### Audio y video dentro del iframe

Los navegadores bloquean el autoplay con sonido hasta que la persona interactúa con la
página. El plugin declara `allow="autoplay; fullscreen"` en el iframe y la app muestra un
botón de reproducción cuando el navegador lo exige; es el comportamiento esperado, no un
error de instalación.

---

### Comprobar credenciales desde el panel

Con `ADMIN_EMAILS=dueno@tudominio.cl`, entra a la app, abre **Mi jardín → Pagos** (o
`https://memoriales.tudominio.cl/panel/admin/pagos`). Ahí ves la pasarela activa, el
ambiente, las URLs que hay que registrar y el botón **Probar credenciales**, que consulta
la cuenta de Mercado Pago sin crear cobros. Es la forma más rápida de confirmar que
`.env` quedó bien cargado antes de avisarle a los clientes.

### Configurar el correo (recuperación de contraseña)

Sin SMTP la app funciona igual, pero nadie puede recuperar su clave solo. Dos caminos:

1. **Desde el servidor:** define `MAIL_*` en `.env` y reinicia. Es lo recomendado en
   producción, porque la clave no queda en la base.
2. **Desde el panel:** con una cuenta de `ADMIN_EMAILS`, abre **Mi jardín → Correo**,
   pega los datos del SMTP y usa **Probar conexión y enviar**. La clave se guarda cifrada
   (AES-256-GCM) en `DATA_DIR` y se aplica sin reiniciar. Lo que esté en el entorno tiene
   prioridad sobre lo guardado.

Mientras no haya correo, en esa misma página aparecen los **pedidos de recuperación** y el
botón **Crear enlace** para entregar el enlace a mano (por teléfono o WhatsApp). Cada enlace
sirve una sola vez, vence en 60 minutos y al usarlo cierra todas las sesiones de la cuenta.

## 7. Pasar a producción y cobrar de verdad

1. Credenciales **de producción** de la pasarela: Mercado Pago
   (`MP_ENV=production`, token `APP_USR-…`; ver [`mercadopago.md`](mercadopago.md)) o
   Flow (`FLOW_ENV=production`; ver [`flow.md`](flow.md)).
2. `PAYMENTS_MODE=mercadopago` (o `flow`) y `SITE_URL` con el dominio definitivo.
3. `SEED_DEMO` sin definir (o `false`).
4. Si la base ya venía con contenido de ejemplo (`demo@jardinmemorial.cl`):

   ```bash
   npm run purge-demo       # o: docker compose exec app node --experimental-sqlite scripts/purge-demo.js
   ```

5. Crea una cuenta real, compra un memorial y revisa el comprobante. Luego crea el
   memorial y escanea el QR con el teléfono.
6. Revisa `https://memoriales.tudominio.cl/pago/estado`: debe decir
   `"modo":"flow"`, `"ambiente":"production"`, `"configurado":true`.

---

## 8. Respaldos, actualizaciones y operación

### Respaldo

```bash
# Docker
docker compose exec app tar czf - -C /app data > respaldo-app-$(date +%F).tar.gz
docker compose exec db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" wordpress' > respaldo-wp-$(date +%F).sql

# Instalación manual
sudo tar czf /var/backups/jardin-$(date +%F).tar.gz -C /var/lib jardin-memorial
```

Guarda los respaldos **fuera** del servidor (S3, Backblaze, otro disco) y prueba una
restauración antes de confiar en ellos.

### Actualizar la app

```bash
cd /opt/jardin-memorial
git pull
# Docker
docker compose -f deploy/wordpress/docker-compose.yml up -d --build
# Manual
sudo systemctl restart jardin-memorial
```

El esquema de SQLite se actualiza solo al arrancar (`src/db.js`). Aun así, haz copia de
`data/` antes de cada actualización.

### Registros

```bash
docker compose logs -f app          # o: journalctl -u jardin-memorial -f
```

Los eventos de pago se registran con el prefijo `[flow]`.

### Cambiar de pasarela o pasar a demo (solo pruebas)

`PAYMENTS_MODE=demo` y reinicia. Nunca dejes el modo demo en un sitio público: los
memoriales se acreditarían sin cobrar. La pasarela de prueba (`/pago/demo/…`) sirve
para recorrer el circuito completo sin tarjeta.

---

## 9. Verificación final

- [ ] `https://www.tudominio.cl` carga WordPress con HTTPS válido.
- [ ] `https://memoriales.tudominio.cl` carga la portada de Jardín Memorial.
- [ ] `/healthz` responde `ok`.
- [ ] `curl -I https://memoriales.tudominio.cl` muestra
      `content-security-policy: … frame-ancestors 'self' https://www.tudominio.cl` y
      **no** muestra `x-frame-options`.
- [ ] La página «Memoriales» de WordPress muestra la app sin barras de desplazamiento
      dobles ni encabezado repetido.
- [ ] Registro → compra (sandbox) → memorial creado → QR y certificado descargables.
- [ ] El certificado PDF y el QR apuntan a `https://memoriales.tudominio.cl/m/...`.
- [ ] Cerrar sesión y volver a entrar desde el menú de WordPress.
- [ ] `/pago/estado` informa el ambiente correcto.

---

## 10. Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| El iframe sale en blanco o “rechazó la conexión” | Falta el dominio de WordPress en `EMBED_ORIGINS`; la app envía `X-Frame-Options: SAMEORIGIN`. Corrige y reinicia |
| No aparece el enlace **Pagos** en el panel | Falta `ADMIN_EMAILS` con el correo de la cuenta; reinicia la app después de agregarlo |
| La pasarela sigue “en demostración” | Revisa `/panel/admin/pagos` o `/pago/estado`: el aviso dice qué variable falta |
| Se ven dos encabezados (el del tema y el de la app) | Usa la plantilla a pantalla completa o `[jardin_memorial chrome="0"]` |
| No hay forma de navegar dentro de la app | La página usa `chrome="0"` o `EMBED_CHROME=1`: el encabezado de la app está oculto. Vuelve a `chrome="1"` o agrega los enlaces con `[jardin_memorial_enlace]` |
| “Contenido mixto” / iframe bloqueado | La app se está cargando por `http://`; usa `https://` en la URL del plugin |
| Error 502 en `memoriales.` | La app no está corriendo (`systemctl status`, `docker compose logs app`) |
| No obtiene certificado TLS | DNS sin propagar o puerto 80 cerrado; revisa `docker compose logs caddy` |
| La sesión se pierde al navegar | La app y WordPress están en dominios distintos, o el navegador bloquea cookies de terceros; usa subdominios del mismo dominio |
| “La pasarela de pagos está en configuración” | Faltan credenciales de la pasarela o el modo es `demo` |
| Pago aprobado pero cupos sin acreditar | La notificación no llegó: revisa `/pago/mp/webhook` (Mercado Pago) o `/pago/confirmacion` (Flow), el log y usa **Verificar pago** en el comprobante |
| El video no sube | El proxy limita el tamaño: sube `client_max_body_size` a `200m` (Nginx) o `request_body` (Caddy). El límite de la app es 120 MB |
| WordPress no muestra la plantilla de pantalla completa | Es un tema de bloques: usa el shortcode en un contenedor de ancho completo o un patrón de página sin encabezado |
| Los enlaces del menú abren la app dentro del iframe | Usa `[jardin_memorial_enlace]` en lugar de un enlace normal a la página |

---

## 11. Archivos que incluye esta integración

```
deploy/
  wordpress/
    docker-compose.yml          WordPress + MariaDB + app + Caddy
    Caddyfile                   HTTPS automático y proxy a cada servicio
    .env.example                Variables del compose
    build-plugin.sh             Genera jardin-memorial.zip
    plugin/jardin-memorial/     Plugin de WordPress (shortcodes y plantilla)
  systemd/jardin-memorial.service   Servicio para la opción B
  nginx/jardin-memorial.conf        Proxy inverso para la opción B
Dockerfile                      Imagen de la app
.env.example                    Variables de la app
docs/mercadopago.md             Cobrar con Mercado Pago (recomendado)
docs/flow.md                    Alternativa: pagos con Flow
```
