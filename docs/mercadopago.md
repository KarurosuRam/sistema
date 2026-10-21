# Cobrar con Mercado Pago

Esta es la pasarela **recomendada** para Jardín Memorial: se abre en minutos, no tiene
contrato ni abono mensual, se administra desde un panel en español y acepta tarjetas de
crédito, débito, cuotas y saldo de Mercado Pago. Flow sigue disponible como alternativa
(ver [`flow.md`](flow.md)).

La app usa **Checkout Pro**: el comprador paga en el sitio seguro de Mercado Pago y
vuelve solo. Jardín Memorial **nunca ve ni guarda datos de tarjeta**.

> ¿La app sigue diciendo “demostración”? Casi siempre es porque el `.env` no se estaba
> leyendo o la variable no llegó al proceso. Desde esta versión la app **lee `.env` sola**
> al arrancar (las variables del entorno tienen prioridad) y `/pago/estado` dice
> exactamente qué falta.

```
Comprador              App (Node)                     Mercado Pago
   │  elige plan           │                              │
   ├──────────────────────►│ POST /checkout/preferences   │
   │                       ├─────────────────────────────►│
   │                       │      { id, init_point }      │
   │                       │◄─────────────────────────────┤
   │◄── 302 a mercadopago ─┤                              │
   │  paga con tarjeta / cuotas / saldo ─────────────────►│
   │                       │ POST /pago/mp/webhook        │
   │                       │◄─────────────────────────────┤
   │                       │ GET /v1/payments/{id}        │
   │                       ├─────────────────────────────►│
   │                       │      status = approved       │
   │                       │◄─────────────────────────────┤
   │                       │ acredita cupos (una vez)     │
   │◄── /pago/mp/retorno ──┤                              │
   │  comprobante          │                              │
```

---

## 1. Crear la cuenta

1. Entra a <https://www.mercadopago.cl> y crea una cuenta (con tu RUT, como persona
   natural o empresa).
2. Completa la verificación de identidad y agrega la cuenta bancaria donde quieres
   recibir el dinero (**Tu perfil → Datos bancarios**).
3. No necesitas contratos ni trámites presenciales: el alta es en línea.

> Para **probar** no hace falta tener la cuenta verificada ni datos bancarios: las
> credenciales de prueba funcionan igual y no mueven dinero real.

## 2. Crear la aplicación y obtener el Access Token

1. Abre <https://www.mercadopago.cl/developers/panel/app> con tu cuenta.
2. Pulsa **Crear aplicación**.
   - Nombre: `Jardín Memorial`
   - Producto: **Pagos online** → **Checkout Pro**
   - Modelo de integración: **No, soy un sitio de e-commerce** (o la opción equivalente)
3. Entra a la aplicación → **Credenciales** (o **Credenciales de prueba**).
4. Copia el **Access Token**:

   | Ambiente | Aspecto del token | Qué hace |
   | --- | --- | --- |
   | Pruebas | empieza con `TEST-` | Simula pagos, no cobra |
   | Producción | empieza con `APP_USR-` | Cobra de verdad |

   La **Public Key** no se usa en esta integración (el checkout lo aloja Mercado Pago).

5. Activa las credenciales de producción cuando vayas a cobrar de verdad
   (**Credenciales de producción** → completar datos del negocio). Mercado Pago puede
   pedirte documentación la primera vez; es un trámite dentro del mismo panel.

## 3. Configurar la app

En el archivo `.env` de la instalación (la app lo lee sola al arrancar; las variables
del entorno, como las de Docker o systemd, tienen prioridad):

```ini
PAYMENTS_MODE=mercadopago
MP_ACCESS_TOKEN=TEST-0000000000000000-000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MP_ENV=sandbox
SITE_URL=https://memoriales.tudominio.cl
```

- `MP_ENV=sandbox` mientras pruebas; `MP_ENV=production` cuando uses el token real.
- `SITE_URL` debe ser **HTTPS y pública**: con ella se construyen la vuelta del
  comprador y el webhook. Mercado Pago rechaza URLs `http://`.
- No hace falta configurar la Public Key ni el SDK: la app habla directo con la API.

Reinicia la app y revisa el diagnóstico:

```bash
curl -s https://TU-DOMINIO/pago/estado
```

Debe responder, entre otras cosas:

```json
{
  "modo": "mercadopago",
  "pasarela": "Mercado Pago",
  "cobrosReales": true,
  "mercadopago": {
    "ambiente": "sandbox",
    "configurado": true,
    "urlWebhook": "https://TU-DOMINIO/pago/mp/webhook",
    "urlRetorno": "https://TU-DOMINIO/pago/mp/retorno"
  }
}
```

Si ves `"modo": "demo"`, la app no encontró el token: revisa que `MP_ACCESS_TOKEN` esté
en el entorno del proceso (no solo en el archivo) y que no queden espacios.

## 4. Probar con pagos simulados

1. En el panel de desarrolladores entra a **Tus integraciones → Cuentas de prueba** y
   crea una **cuenta de prueba de comprador** (con un correo inventado, por ejemplo
   `comprador@testuser.com`).
2. Con la app en `MP_ENV=sandbox`, entra a **Comprar memoriales**, elige un plan y paga.
   En el checkout de Mercado Pago inicia sesión con esa cuenta de prueba (o paga como
   invitado).
3. Usa una tarjeta de prueba de Chile:

   | Tarjeta | Número | CVV | Vence |
   | --- | --- | --- | --- |
   | Mastercard crédito | `5416 7526 0258 2580` | `123` | `11/30` |
   | Visa débito | `4168 8188 4444 7115` | `123` | `11/30` |
   | American Express crédito | `3757 781744 61804` | `1234` | `11/30` |

4. El **nombre del titular** define el resultado:

   | Nombre | Resultado |
   | --- | --- |
   | `APRO` | Pago aprobado |
   | `OTHE` | Rechazado por error general |
   | `CONT` | Pendiente |
   | `FUND` | Fondos insuficientes |
   | `SECU` | CVV inválido |

   Para `APRO` usa documento **otro 123456789**.

5. Comprueba en la app: comprobante **Pagado**, medio **Mercado Pago**, N.º de pago y
   cupos sumados **una sola vez**. Con `CONT`, el comprobante queda **Pendiente** y se
   actualiza al aprobarse (o con **Verificar pago**).

## 5. Webhook y firma (recomendado)

La app envía en cada preferencia su propia `notification_url`
(`https://TU-DOMINIO/pago/mp/webhook`), así que **las notificaciones funcionan sin
configurar nada más**. Para mayor seguridad puedes además activar la firma:

1. En <https://www.mercadopago.cl/developers/panel/app> → tu aplicación →
   **Webhooks → Configurar notificación**.
2. URL de producción: `https://TU-DOMINIO/pago/mp/webhook`
   (y la misma en modo prueba si quieres probar notificaciones).
3. Eventos: **Pagos**.
4. Guarda y copia la **clave secreta** que aparece.
5. En `.env`: `MP_WEBHOOK_SECRET=...` y reinicia.

Con el secreto configurado, la app valida el encabezado `x-signature` de cada
notificación y responde `401` a las que no corresponden. **Aun sin secreto**, la app
siempre consulta el pago real a la API antes de acreditar, así que una notificación
falsa no puede regalar memoriales.

La app responde `200` a Mercado Pago en cuanto procesa el aviso. Si la API no responde,
devuelve `500` para que la pasarela reintente (lo hace durante varios días).

## 6. Pasar a cobros reales

- [ ] Cuenta verificada y datos bancarios cargados.
- [ ] Credenciales de **producción** (`APP_USR-...`) en `MP_ACCESS_TOKEN`.
- [ ] `MP_ENV=production`.
- [ ] `PAYMENTS_MODE=mercadopago`.
- [ ] `SITE_URL` con el dominio definitivo y certificado válido.
- [ ] `SEED_DEMO=false`, `DEMO_ACCESS=off` y `npm run purge-demo` si la base tenía la demo.
- [ ] Compra real de prueba (puedes comprar $6.990 y luego devolverte el dinero desde el
      panel de Mercado Pago): confirma que el cupo aparece una sola vez.
- [ ] Revisa `https://TU-DOMINIO/pago/estado`: `"ambiente": "production"` y
      `"cobrosReales": true`.

## 7. Administración diaria

### Configurar desde el panel (sin tocar el servidor)

Si no tienes acceso a la carpeta del proyecto, entra con una cuenta incluida en
`ADMIN_EMAILS`, abre **Mi jardín → Pagos** y usa **Conectar tu cuenta**:

1. Elige **Mercado Pago** como pasarela.
2. Elige el ambiente (**Pruebas** mientras validas).
3. Pega el **Access Token** y el **secreto del webhook** y guarda.

El token se prueba contra la API antes de guardarse: si es inválido, la app no lo
acepta y muestra el error. Se almacena cifrado (AES-256-GCM) en la base, con una clave
local en `DATA_DIR/.settings-key`, y se aplica **sin reiniciar**. Puedes borrarlo con
**Borrar guardadas** cuando quieras volver al modo anterior.

> Lo que definas en el entorno (`MP_ACCESS_TOKEN`, `MP_ENV`, `PAYMENTS_MODE`) siempre
> tiene prioridad sobre lo guardado en el panel. En ese caso los campos aparecen
> deshabilitados con la nota «Definido en el servidor».

### Panel de la app: `/panel/admin/pagos`

Con `ADMIN_EMAILS=tu@correo.cl` en el entorno, tu cuenta ve en el panel el enlace
**Pagos**. Esa página muestra, sin exponer las claves completas:

- pasarela activa, ambiente (`sandbox` / `production`) y si los cobros son reales;
- el Access Token enmascarado y si es de prueba (`TEST-`) o de producción (`APP_USR-`);
- si `MP_WEBHOOK_SECRET` está definido;
- las URLs de **webhook** y **retorno** con botón para copiar;
- ventas pagadas, memoriales vendidos y pagos pendientes;
- **Probar credenciales**: consulta `GET /users/me` con el token configurado y responde
  con la cuenta y el tipo de token. No crea cobros ni modifica datos.

Si la página dice *Configuración incompleta*, el aviso indica exactamente qué variable
falta. Después de editar `.env` hay que reiniciar la app para que tome los cambios.
Sin `ADMIN_EMAILS` la ruta responde 404 para todos.

### Gestión en Mercado Pago

Todo se gestiona en <https://www.mercadopago.cl> (web) o en la app de Mercado Pago:

| Tarea | Dónde |
| --- | --- |
| Ver ventas del día y liquidaciones | **Tu negocio → Ventas** / **Cobros** |
| Reembolsar un pago | Abre el pago → **Reembolsar** |
| Ver disputas o contracargos | **Tu negocio → Reclamos** |
| Cambiar la cuenta bancaria | **Tu perfil → Datos bancarios** |
| Descargar reportes para contabilidad | **Reportes** |

Cada compra de la app tiene una referencia `JM-…` que también se envía a Mercado Pago
como `external_reference`; puedes buscarla en el panel para conciliar. En la app, el
titular ve el mismo número en **Historial de compras → Ver**.

**Reembolsos:** se hacen desde Mercado Pago. La app no borra memoriales ni descuenta
cupos automáticamente al reembolsar; si necesitas revertir cupos, hazlo a mano en la
base (`purchases` / `users.credits`) después de acordarlo con el cliente.

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| «No pudimos conectarnos con api.mercadopago.com» | El servidor no tiene salida a internet o un firewall bloquea HTTPS. En la vista previa del proyecto esto es normal: los cobros reales se prueban en el servidor publicado |
| “La pasarela de pagos está en configuración” o modo demo | Falta `MP_ACCESS_TOKEN` o `PAYMENTS_MODE` no es `mercadopago` |
| Error `invalid_back_urls` al pagar | `SITE_URL` no es HTTPS público |
| `401` / `invalid access token` | Token vencido, de otro ambiente o con espacios |
| Pago aprobado en Mercado Pago pero la app sigue **Pendiente** | El webhook no llegó: revisa que `/pago/mp/webhook` sea público (sin contraseña ni mantenimiento), que `SITE_URL` sea el dominio real y usa **Verificar pago** |
| El comprador vuelve a una página que no existe | `SITE_URL` no coincide con el dominio público |
| La firma del webhook falla | `MP_WEBHOOK_SECRET` no corresponde a esa aplicación, o el `data.id` viene como orden y no como pago (la app ignora esos eventos) |
| Cobra en pruebas pero no en producción | Sigue con token `TEST-` y `MP_ENV=sandbox` |

Los registros del servidor muestran cada evento con el prefijo `[mp]`:

```bash
docker compose logs -f app        # o: journalctl -u jardin-memorial -f
```

## 9. Mercado Pago o Flow

| | Mercado Pago (recomendado) | Flow |
| --- | --- | --- |
| Alta | Online, inmediata | Comercio aprobado por Flow |
| Credenciales de prueba | Al instante, en el panel | Cuenta sandbox aparte |
| Costo fijo | Sin abono mensual | Sin abono mensual |
| Medios | Tarjetas, cuotas, saldo MP | Tarjetas, Webpay, MACH y otros |
| Administración | Panel web + app móvil, reembolsos y reportes | Panel web |
| Integración en la app | `MP_ACCESS_TOKEN` | `FLOW_API_KEY` + `FLOW_SECRET_KEY` |

Puedes cambiar de pasarela sin tocar el código: ajusta `PAYMENTS_MODE` y las
credenciales. Las compras antiguas conservan su medio y su comprobante.
