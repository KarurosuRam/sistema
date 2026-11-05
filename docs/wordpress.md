# Jardín Memorial como plugin de WordPress

Guía para instalar la plataforma de memoriales en un **WordPress sobre hosting
compartido**, sin Node, sin servidor propio y sin tocar el tema del sitio.

Desde la versión 2 el producto completo —memoriales, cuentas, pagos, panel de
administración y certificados— funciona **dentro de WordPress**: PHP + MySQL,
nada más. Las páginas se crean solas al activar el plugin y el sitio sigue
siendo el mismo WordPress de siempre.

---

## 1. Qué necesita el hosting

| Requisito | Detalle |
|---|---|
| WordPress | 6.2 o superior |
| PHP | 7.4 o superior (probado en 8.4) |
| Extensiones PHP | `mbstring`, `gd` o `imagick`, `zip`, `openssl` |
| Base de datos | MySQL 5.7+ / MariaDB 10.3+ |
| Permisos | escritura en `wp-content/uploads` (el plugin crea `jardin-memorial/`) |
| HTTPS | obligatorio para Mercado Pago |

No hace falta SSH, Composer, Node ni WP-CLI. Todo se hace desde el escritorio de
WordPress.

### Límites típicos del hosting compartido

El plugin acepta fotos de 15 MB, audio de 20 MB y video de 120 MB. Muchos
hostings vienen con límites más bajos (`upload_max_filesize`, `post_max_size` de
2 a 8 MB). Para subir videos hay que pedirle al proveedor un mínimo de:

```
upload_max_filesize = 128M
post_max_size       = 132M
max_execution_time  = 300
memory_limit        = 256M
```

Si no se puede cambiar, el sitio funciona igual para fotos y audio: al subir un
archivo demasiado grande WordPress avisa y no se guarda nada.

---

## 2. Instalación en cinco minutos

1. Empaquetar el plugin (o usar el ZIP ya generado):

   ```bash
   bash deploy/wordpress/build-plugin.sh
   # → dist/jardin-memorial-2.0.0.zip
   ```

2. En WordPress: **Plugins → Añadir nuevo → Subir plugin → Elegir archivo**,
   subir el ZIP y pulsar **Activar**.

3. Al activarse, el plugin:
   - crea seis tablas (`wp_jm_memorials`, `wp_jm_photos`, `wp_jm_guestbook`,
     `wp_jm_candles`, `wp_jm_purchases`, `wp_jm_rates`);
   - crea las ocho páginas del sitio y guarda sus IDs en la opción `jm_pages`;
   - registra las rutas `/m/<slug>` y `/certificado/<código>`.

4. Ir a **Ajustes → Enlaces permanentes** y pulsar **Guardar cambios** una vez.
   Es lo que refresca las reglas de rewrite; sin ese paso `/m/…` devuelve 404.

5. Revisar el menú lateral **Jardín Memorial → Ajustes**.

### Páginas que crea el plugin

| Página | Ruta | Shortcode |
|---|---|---|
| Memoriales | `/memoriales/` | `[jardin_memorial_listado]` |
| Mi jardín | `/mi-jardin/` | `[jardin_memorial_panel]` |
| Planes | `/planes/` | `[jardin_memorial_planes]` |
| Ingresar | `/ingresar/` | `[jardin_memorial_ingresar]` |
| Crear cuenta | `/crear-cuenta/` | `[jardin_memorial_registro]` |
| Recuperar contraseña | `/recuperar-clave/` | `[jardin_memorial_recuperar]` |
| Comprobante | `/comprobante/` | `[jardin_memorial_comprobante]` |
| Certificado | `/certificado/` | `[jardin_memorial_certificado]` |

Las páginas usan `get_header()` y `get_footer()`: heredan el encabezado y el pie
del tema activo. Todo el CSS está encapsulado en `.jm-page`, así que no altera
el resto del sitio. Si se borra una página, el plugin la vuelve a crear la
próxima vez que se active.

El menú de navegación es decisión del sitio: agregar ahí «Memoriales», «Planes»
e «Ingresar» desde **Apariencia → Menús**.

---

## 3. Configuración

### Jardín Memorial → Ajustes

| Campo | Para qué sirve |
|---|---|
| **Pasarela** | «Pasarela de prueba» recorre la compra sin dinero real; «Mercado Pago» cobra de verdad |
| **Ambiente** | Pruebas (`TEST-…`) o Producción (`APP_USR-…`) |
| **Access Token** | Se guarda **cifrado** (AES-256-GCM con `wp_salt('auth')`). Vacío = conservar el actual |
| **Secreto del webhook** | Opcional pero recomendado: valida la firma `x-signature` de Mercado Pago |
| **Correos administradores** | Además de los administradores de WordPress, quiénes ven pagos y reembolsos |

El aviso rojo de la cabecera del panel desaparece cuando hay token de pago y
correo saliente configurado.

### Correo saliente

El plugin usa `wp_mail()`. En hosting compartido normalmente funciona con el
correo del propio dominio; si no llega nada (recuperación de contraseña, avisos
de compra), instalar un plugin SMTP (por ejemplo *WP Mail SMTP*) y probar desde
**Jardín Memorial → Correo → Enviar correo de prueba**.

### Enlaces y códigos

- Memorial público: `https://tu-dominio.cl/m/<slug>`
- Certificado privado del titular: `/certificado/?codigo=JM-2026-00001`
- El **QR** se dibuja en el navegador con `assets/js/vendor/qrcode.min.js`
  (MIT, incluido). No llama a ningún servicio externo.

### Roles

- Quien se registra desde el formulario queda como **suscriptor**; puede crear
  memoriales y administrar solo los suyos.
- **Administrador** de WordPress ve el panel de pagos y puede reembolsar; además
  los correos de «Correos administradores» tienen los mismos permisos dentro del
  plugin.
- Un memorial **privado** devuelve 404 a terceros; el titular y los
  administradores lo ven.

---

## 4. Cobros con Mercado Pago

1. En el panel de Mercado Pago, crear una aplicación y copiar el **Access Token**.
2. Pegarlo en **Ajustes** con el ambiente correspondiente y guardar.
3. La URL de notificación se arma sola: `https://tu-dominio.cl/wp-json/jardin-memorial/v1/mp`
   (ruta REST `jardin-memorial/v1/mp`). No hay que configurarla a mano.
4. Probar con una compra de $6.990 en modo Pruebas usando las tarjetas de test de
   Mercado Pago y comprobar que:
   - el comprobante pasa a **pagado**;
   - se acredita 1 cupo (o 4 en el pack);
   - la fila aparece en **Jardín Memorial → Pagos**.

El webhook verifica la firma `x-signature` cuando hay secreto configurado,
ignora las notificaciones que no son de pago y responde 200 siempre que la firma
sea válida (Mercado Pago reintenta si recibe un error).

**Reembolsos:** en **Pagos**, botón «Reembolsar». Llama a la API de Mercado
Pago, marca la compra como reembolsada y devuelve los cupos que siguieran sin
usar.

---

## 5. Migrar los datos de la app Node

La app anterior guarda todo en SQLite. El exportador produce un ZIP que el
plugin importa desde el escritorio de WordPress.

```bash
npm run export-wordpress
# → dist/jardin-memorial-migracion-AAAAMMDD.zip
```

El ZIP contiene `datos.json` y la carpeta `uploads/` con las fotos, la música y
los videos de los memoriales (los archivos ya presentes en disco; los que
faltan se informan por consola). Con `--sin-medios` se exportan solo los datos.

En WordPress: **Jardín Memorial → Migración → subir el ZIP → Importar**.

Qué hace el importador:

| Dato | Resultado |
|---|---|
| Cuentas | Se crean como suscriptores con el mismo correo y sus cupos |
| Memoriales | Mismo slug, mismo código de certificado, mismos textos y tema |
| Fotos | Se copian a `uploads/jardin-memorial/importado/` y se registran en la biblioteca |
| Música y video | Igual que las fotos, con su tipo MIME |
| Libro de visitas y velas | Se copian con su fecha original |
| Compras | Se registran como `importado`, en estado pagado, para que el historial calce |

Qué **no** se puede migrar, y por qué:

- **Contraseñas.** La app usaba `scrypt`; WordPress usa otra función. Cada cuenta
  nueva se crea con una clave aleatoria y el titular entra con
  **Recuperar contraseña**. Si se marca «enviar correos» al importar, el plugin
  manda el enlace directamente.
- **Sesiones abiertas.** Cada persona vuelve a entrar.
- **Credenciales de pago y ajustes.** Se configuran de nuevo en **Ajustes**.
- **Visitas (views).** Se conservan en el JSON pero no se importan, para no
  inflar contadores con datos de prueba.

El importador es idempotente por correo y por referencia de compra: si se sube
el mismo ZIP dos veces, no duplica cuentas ni compras. Los cupos nunca se bajan,
solo se suben.

Antes de importar sobre un sitio con contenido, hacer respaldo (ver abajo).

---

## 6. Respaldos

Con un plugin de respaldo del hosting (o el del proveedor) alcanza con incluir:

- la **base de datos** completa (las tablas `wp_jm_*` viven ahí);
- la carpeta `wp-content/uploads/jardin-memorial/` (originales y miniaturas);
- `wp-config.php`.

Frecuencia sugerida: diaria automática + una copia manual antes de cada
migración o actualización del plugin.

---

## 7. Verificación después de instalar

1. `/memoriales/` abre sin 404 y muestra los memoriales públicos.
2. `/crear-cuenta/` crea una cuenta; el correo de bienvenida no es necesario,
   pero **Recuperar contraseña** debe enviar el enlace.
3. Comprar en modo prueba, aprobar el pago demo y ver el comprobante en
   `/comprobante/?ref=JM-…`.
4. Crear un memorial: aparece en `/m/<slug>`, con QR y certificado.
5. Subir 3 fotos, una música y (si el hosting lo permite) un video de 40 s.
6. Abrir el memorial en una ventana privada y dejar un mensaje en el libro de
   visitas. Encender una vela.
7. Poner el memorial en privado: la ventana privada recibe 404; el titular lo ve.
8. **Jardín Memorial → Pagos** lista la compra; **Correo** envía una prueba.

---

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `/m/algo` da 404 | Guardar **Ajustes → Enlaces permanentes** una vez. Si el hosting no permite rewrite, usar el enlace con `?jm_memorial=slug` |
| El QR sale vacío | El navegador bloqueó `qrcode.min.js`: revisar que el archivo esté en `assets/js/vendor/` |
| «No se pudo subir el archivo» | Límite de PHP. Bajar el peso del archivo o subir `upload_max_filesize` / `post_max_size` |
| La compra queda **pendiente** | El webhook no llegó. Abrir el comprobante y usar «Verificar pago», o revisar el token y que el sitio esté en HTTPS |
| No llegan correos | Configurar SMTP y usar **Correo → Enviar prueba** |
| «El monto pagado no coincide» | El pago se hizo con otro plan: la compra queda `invalido` para revisión manual |
| El certificado no abre | Es privado: solo el titular con sesión iniciada, usando su código |
| Fotos giradas o miniaturas faltantes | Falta la extensión `gd` en PHP; pedirla al hosting |

---

## 9. Actualizar el plugin

1. Respaldar base y uploads.
2. Subir el nuevo ZIP en **Plugins → Añadir nuevo → Subir plugin** y elegir
   «Reemplazar el actual».
3. Si cambió la versión de la base, el plugin la actualiza solo al entrar
   (`JM_DB::maybe_upgrade()`); las tablas se agregan, no se recrean.

---

## 10. Desinstalar

Desinstalar desde **Plugins** borra solo las opciones y avisos del plugin.
**Los memoriales, las fotos y los mensajes se conservan** a propósito: son
recuerdos de personas reales.

Para borrar todo definitivamente, agregar en `wp-config.php`:

```php
define('JM_BORRAR_DATOS', true);
```

y recién entonces desinstalar. Eso elimina las tablas `wp_jm_*`, los cupos de
cada cuenta y la carpeta `uploads/jardin-memorial/`.

---

## 11. Estructura del plugin

```
jardin-memorial/
├── jardin-memorial.php        arranque, constantes, activación
├── uninstall.php              limpieza (conserva datos salvo JM_BORRAR_DATOS)
├── includes/
│   ├── class-jm-db.php        tablas y versión de esquema
│   ├── class-jm-repo.php      consultas de memoriales, fotos, mensajes, compras
│   ├── class-jm-util.php      slugs, fechas, CLP, flash, cifrado
│   ├── class-jm-accounts.php  registro, login, límites, cupos
│   ├── class-jm-media.php     subidas y miniaturas
│   ├── class-jm-payments.php  planes, preferencia MP, webhook, reembolsos
│   ├── class-jm-migrate.php   importador del ZIP de la app Node
│   ├── class-jm-actions.php   formularios (admin-post.php + nonce)
│   ├── class-jm-frontend.php  rutas, plantillas, shortcodes, estilos
│   └── class-jm-admin.php     menú de pagos, correo, migración y ajustes
├── templates/
│   ├── memorial.php  listado.php  planes.php  panel.php
│   ├── auth-*.php  comprobante.php  pago-demo.php  certificado.php
│   └── parts/memorial-form.php
└── assets/
    ├── css/jm.css
    └── js/app.js, js/vendor/qrcode.min.js
```

---

## 12. Seguridad

- Todos los formularios pasan por `admin-post.php` con `wp_nonce_field`; nada
  cambia datos por GET.
- Consultas con `$wpdb->prepare` y escapado de salida con `esc_html`,
  `esc_attr`, `esc_url`.
- Subidas validadas por tipo MIME real (`wp_check_filetype_and_ext`), tamaño y
  dimensiones mínimas (300 × 300 px en fotos).
- Credenciales de pago cifradas en la base con AES-256-GCM y `wp_salt('auth')`.
- Login limitado a 10 intentos cada 15 minutos por IP; recuperación de
  contraseña con token de 43 caracteres, 60 minutos de vida y límite de 8
  solicitudes cada 30 minutos.
- Contraseña con `wp_hash_password`, sesión de WordPress (sin cookies propias).
