# Pagos con Flow (alternativa)

> La pasarela **recomendada** es Mercado Pago por su alta inmediata y su panel más
> simple de administrar: ver [`mercadopago.md`](mercadopago.md). Flow queda disponible
> para quienes ya tienen un comercio aprobado allí; se activa con
> `PAYMENTS_MODE=flow` y las llaves de abajo.

La app cobra con la **API de Flow** (`https://www.flow.cl/api`). No hay formulario de
tarjeta propio: la app crea la orden, el comprador paga en el sitio de Flow y los
créditos se acreditan **solo** cuando Flow confirma el pago.

```
Comprador            App (Node)                     Flow
   │  elige plan         │                             │
   ├────────────────────►│ POST /payment/create        │
   │                     ├────────────────────────────►│
   │                     │  { url, token, flowOrder }  │
   │                     │◄────────────────────────────┤
   │◄── 302 a flow.cl/?token=… ────────────────────────┤
   │  paga con tarjeta / webpay / mach ───────────────►│
   │                     │ POST /pago/confirmacion     │
   │                     │◄────────────────────────────┤  (servidor a servidor)
   │                     │ GET /payment/getStatus      │
   │                     ├────────────────────────────►│
   │                     │  status=2 (pagada)          │
   │                     │◄────────────────────────────┤
   │                     │ acredita cupos (1 vez)      │
   │◄── 302 /pago/retorno?token=… ─────────────────────┤
   │  comprobante        │                             │
```

## 1. Crear el comercio y obtener credenciales

| Ambiente | Panel de credenciales | URL de pago |
| --- | --- | --- |
| Pruebas | <https://sandbox.flow.cl/app/web/misDatos.php> | `sandbox.flow.cl` |
| Producción | <https://www.flow.cl/app/web/misDatos.php> | `www.flow.cl` |

En el panel de Flow, sección **Mis datos**, están la **API Key** y la **Secret Key**.
Las credenciales de sandbox y de producción son distintas: una llave de prueba no
cobra en producción y viceversa.

## 2. Configurar la app

```bash
PAYMENTS_MODE=flow
FLOW_ENV=production          # sandbox mientras se prueba
FLOW_API_KEY=tu-api-key
FLOW_SECRET_KEY=tu-secret-key
SITE_URL=https://memoriales.tudominio.cl
```

- `PAYMENTS_MODE=flow` es obligatorio para usar Flow: si no hay llaves, la app queda en
  **modo demostración** y lo advierte en el panel y en `/pago/estado`.
- `PAYMENTS_MODE=demo` fuerza el modo simulado (útil para una vista previa), aunque
  existan llaves.
- `SITE_URL` debe ser una URL **HTTPS pública**: con ella se construyen las dos
  direcciones que Flow necesita. Si no es HTTPS, la app rechaza iniciar el pago con un
  mensaje claro en el comprobante.
- Las URL que se registran en Flow son:

  | Uso | Dirección |
  | --- | --- |
  | Notificación servidor a servidor | `https://TU-DOMINIO/pago/confirmacion` |
  | Vuelta del navegador | `https://TU-DOMINIO/pago/retorno` |

  Se envían en cada orden (`urlConfirmation` y `urlReturn`), así que no hace falta
  escribirlas a mano en el panel de Flow; sí conviene comprobar que sean accesibles
  desde internet y que **no** estén detrás de una página de acceso, mantenimiento o
  firewall con desafío.

## 3. Qué hace la app con cada pago

1. **Crear la orden** (`POST /payment/create`): `commerceOrder` = referencia interna
   (`JM-XXXXXXX-XXXX`), `amount` según el plan ($6.990 o $11.990), `currency=CLP`,
   `email` del titular, `urlConfirmation`, `urlReturn`, `paymentMethod=9` (todos los
   medios habilitados en el comercio). La compra queda **pendiente**.
2. **Redirigir** al comprador a `url?token=…`.
3. **Confirmación** (`POST /pago/confirmacion`): Flow envía `token`; la app consulta
   `GET /payment/getStatus` con su `apiKey` y la firma HMAC. Con `status=2` acredita
   los cupos. Responde `200 OK` siempre que el token sea válido (Flow reintenta si no).
4. **Retorno** (`GET /pago/retorno?token=…`): vuelve a consultar el estado y lleva al
   comprobante. El navegador puede volver antes que la notificación; en ese caso el
   comprobante muestra **Pendiente** y el botón **Verificar pago**.

La acreditación es **idempotente**: se marca la compra como pagada y se suman los
cupos en una sola transacción, así que un reintento de Flow, un doble clic o una
recarga del navegador no duplican memoriales.

### Estados de Flow

| `status` | Significado | Qué hace la app |
| --- | --- | --- |
| `1` | Pendiente | Mantiene la compra pendiente |
| `2` | Pagada | Acredita cupos (una vez) y marca la fecha de pago |
| `3` | Rechazada | Marca la compra como rechazada; no acredita |
| `4` | Anulada | Marca la compra como anulada; no acredita |

Además del estado, la app comprueba que **el monto informado por Flow coincida** con el
de la orden y que la referencia exista. Si algo no cuadra, deja la compra pendiente,
registra el motivo en el log y muestra “El pago no coincide con la orden registrada”
en el comprobante. Nunca acredita a ciegas por el solo hecho de recibir una notificación.

## 4. Probar con sandbox

1. `FLOW_ENV=sandbox` con las llaves de <https://sandbox.flow.cl>.
2. Entra a la app, elige un plan y paga con una tarjeta de prueba de Flow
   (por ejemplo `4051 8856 0044 6623`, cualquier fecha futura y CVV `123`).
3. Revisa en el comprobante: **Pagado**, medio **Flow**, orden `flowOrder`, fecha de pago
   y cupos sumados una sola vez.
4. Revisa los logs: `[flow] Orden …` y, si algo falla, el motivo exacto.

Tarjetas y códigos de error de prueba están en la documentación de Flow
(<https://www.flow.cl/docs/api.html>). Los códigos de rechazo más comunes: `-1` tarjeta
inválida, `-7` tarjeta bloqueada, `-8` tarjeta vencida, `-11` demasiados reintentos.

## 5. Pasar a cobros reales

- [ ] Credenciales de **producción** (`FLOW_ENV=production`).
- [ ] `SITE_URL` con el dominio definitivo y certificado válido (sin `www`/`http` de más).
- [ ] `PAYMENTS_MODE=flow`.
- [ ] `SEED_DEMO=false`, `DEMO_ACCESS=off` y `npm run purge-demo` si la base venía con
      contenido de ejemplo.
- [ ] Hacer una compra real de $6.990 y confirmar que el cargo aparece en Flow y el
      memorial se crea; anular la compra desde Flow y revisar que no se dupliquen cupos.
- [ ] Revisar `data/` en la copia de seguridad (compras, comprobantes y uploads).

## 6. Reembolsos y anulaciones

El reembolso se hace desde el panel de Flow. La app no vuelve a consultar
automáticamente una compra ya pagada: si se anula en Flow, el memorial creado con esos
cupos sigue existiendo. Para revertir cupos manualmente, contacta al administrador de la
base (`purchases` y `users.credits`).

## 7. Diagnóstico rápido

| Síntoma | Causa probable |
| --- | --- |
| “La pasarela de pagos está en configuración” | Faltan `FLOW_API_KEY`/`FLOW_SECRET_KEY` o `PAYMENTS_MODE=demo` |
| “SITE_URL debe ser una URL HTTPS pública” | `SITE_URL` vacío, con `http://` o con una IP local |
| Pago aprobado en Flow pero comprobante **Pendiente** | La notificación no llegó. Revisa que `/pago/confirmacion` sea público y pulsa **Verificar pago** |
| Flow responde error de firma | Secret Key equivocada o de otro ambiente |
| El comprador vuelve a una URL equivocada | `SITE_URL` no coincide con el dominio público real |
