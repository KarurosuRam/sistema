# Entorno de prueba (staging)

Un segundo Jardín Memorial, aparte del sitio real y del contenido de ejemplo, para
recorrer la aplicación **como la usaría una familia**: crear cuenta, comprar, armar el
memorial y compartirlo.

## Qué lo hace distinto

| | Demostración (`/probar`, datos de ejemplo) | Entorno de prueba | Producción |
| --- | --- | --- | --- |
| Base de datos | `./data` | `~/jardin-ensayo` (configurable) | `DATA_DIR` del servidor |
| Contenido | 5 memoriales de ejemplo y cuenta demo | **vacío**: se empieza desde cero | los memoriales de los clientes |
| `NODE_ENV` | desarrollo | `production` | `production` |
| Cobros | simulados | simulados (pasarela de prueba) | reales (Mercado Pago o Flow) |
| Riesgo | ninguno | ninguno | cobros reales |

Los cobros del entorno de prueba son simulados a propósito: sirve para validar el
circuito completo sin mover dinero. La compra pasa por `/pago/demo/…`, que muestra el
paso de pago, no pide tarjeta y permite aprobar o cancelar.

## Cómo levantarlo

```bash
# Opción rápida (puerto 3100, datos en ~/jardin-ensayo)
scripts/entorno-prueba.sh

# Personalizado
PORT=3200 DATA_DIR=/srv/jardin-ensayo ADMIN_EMAILS=dueno@tudominio.cl \
  scripts/entorno-prueba.sh
```

En un servidor con dominio propio, añade además:

```bash
SITE_URL=https://pruebas.tudominio.cl \
EMBED_ORIGINS=https://www.tudominio.cl \
  scripts/entorno-prueba.sh
```

`SITE_URL` es la dirección con la que se generan los enlaces, el QR y el certificado.
`EMBED_ORIGINS` solo hace falta si el sitio se va a mostrar dentro de WordPress o de la
vista previa de Arena; sin esa variable la app no se deja incrustar.

## Recorrido sugerido

1. `/registro` → crear una cuenta nueva (es la experiencia real de un cliente).
2. `/panel/planes` → elegir **Pack familia** ($11.990) o **Un memorial** ($6.990).
3. Confirmar y aprobar el **pago de prueba**.
4. El comprobante muestra el pago acreditado y los memoriales disponibles.
5. `/panel/nuevo` → crear el memorial con foto principal, fechas, epitafio y biografía.
6. En **Administrar memorial**: subir hasta 10 fotos, un video de 60 s y un MP3.
7. **Compartir**: enlace público, QR descargable y certificado de propiedad (privado).
8. Abrir `/m/<enlace>` como visitante: encender una vela y dejar un mensaje.
9. `/panel/admin/pagos` (solo correos de `ADMIN_EMAILS`): ventas, ambiente y prueba de
   credenciales.

## Reiniciar de cero

```bash
rm -rf ~/jardin-ensayo    # borra base, fotos, audio y clave de cifrado
scripts/entorno-prueba.sh
```

## Pasar de prueba a producción

El entorno de prueba no cobra. Para cobrar de verdad:

1. Ejecuta la app con `SITE_URL` HTTPS y las credenciales reales
   (`MP_ACCESS_TOKEN` o `FLOW_API_KEY`/`FLOW_SECRET_KEY`), o pégalas en
   **Mi jardín → Pagos → Conectar tu cuenta**.
2. Deja `PAYMENTS_MODE` en `mercadopago` (recomendado) o `flow`.
3. No reutilices la base del entorno de prueba para producción: los clientes reales
   deben partir de una base limpia y sin contenido de ensayo.

Ver [`mercadopago.md`](mercadopago.md) y [`wordpress.md`](wordpress.md).
