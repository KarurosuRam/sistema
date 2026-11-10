# Amapola · Sistema de reservas para peluquería

Aplicación web completa para que las clientas reserven hora en línea y el equipo
administre la agenda, los servicios y la comunicación. Cada mensaje o recordatorio
que se envía desde la administración **queda en la cuenta de la clienta y se copia
automáticamente a su WhatsApp**.

![Flujo](https://img.shields.io/badge/WhatsApp-copia%20automática-25D366) ![Node](https://img.shields.io/badge/Node.js-22%2B-339933) ![SQLite](https://img.shields.io/badge/SQLite-local-003B57)

---

## Qué incluye

### Para las clientas
- Registro e inicio de sesión con correo, teléfono (WhatsApp) y contraseña.
- Catálogo de servicios con duración, descripción y precio.
- Reserva guiada en 4 pasos: servicio → estilista → fecha y hora → confirmación.
- Disponibilidad real: solo muestra horarios libres según la agenda de cada estilista,
  considerando la duración del servicio y los días cerrados (domingo y lunes).
- **Mis reservas**: próximas y historial, con cancelación hasta 2 horas antes.
- **Mensajes**: bandeja con confirmaciones, recordatorios y promociones, indicando
  el estado de la copia enviada a WhatsApp.

### Para la administración
- **Resumen** con reservas del día, pendientes, mensajes sin leer, facturación del mes
  y gráfico de la semana.
- **Agenda diaria** con filtros por estado y acciones para confirmar, completar o
  cancelar (cada cambio notifica a la clienta por su cuenta y WhatsApp).
- **Mensajes**: compositor con plantillas, vista previa tipo WhatsApp, envío a una
  clienta o a todas, categorías (recordatorio, confirmación, promoción, información)
  y variables `{nombre}`, `{servicio}`, `{fecha}`, `{hora}`, `{estilista}`.
- **Recordatorios de mañana** con un clic: se envían a todas las reservas del día
  siguiente y no se duplican. También pueden automatizarse con `AUTO_REMINDERS=1`
  (el servidor revisa cada mañana y envía los recordatorios pendientes).
- **Clientas** con búsqueda, historial, último mensaje y acceso directo al compositor.
- **Servicios** y **equipo** editables (duración, precio, especialidad, activar/desactivar).
- **Envíos WhatsApp**: bitácora con la copia exacta de cada mensaje, estado
  (`enviado`, `simulado`, `fallido`), prueba de conexión y conteos.

---

## Cómo se cumple el envío a WhatsApp

```
Admin escribe un mensaje
        │
        ├─► messages        → aparece en la cuenta de la clienta (bandeja)
        └─► whatsapp_log    → copia enviada al WhatsApp de la clienta
```

El envío está abstraído en `src/whatsapp.js` y soporta tres proveedores, en orden
de prioridad:

| Prioridad | Proveedor | Variables necesarias |
|-----------|-----------|----------------------|
| 1 | **Meta WhatsApp Cloud API** (recomendado) | `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID` |
| 2 | **Twilio WhatsApp** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| 3 | **Simulador local** | ninguna |

Sin credenciales el sistema funciona en **modo demostración**: el mensaje se guarda
igual en la cuenta, se registra en la bitácora del panel y se escribe en
`data/whatsapp-outbox.log`, pero no sale a la red. Al agregar las credenciales en
`.env` los mismos mensajes se envían de verdad, sin cambiar código.

### Configurar envío real (Meta Cloud API)
1. Crea una app en <https://developers.facebook.com/apps> y agrega el producto WhatsApp.
2. Copia el **Phone number ID** y genera un **token permanente**.
3. Crea el archivo `.env`:

```bash
cp .env.example .env
# edita .env
META_WHATSAPP_TOKEN=EAAG...
META_PHONE_NUMBER_ID=123456789012345
WHATSAPP_COUNTRY_CODE=56
```

4. Reinicia el servidor. En **Administración → Envíos WhatsApp** verás
   “Envío real habilitado” y podrás usar “Probar conexión”.

> En producción, Meta exige plantillas aprobadas (*message templates*) para iniciar
> conversaciones fuera de la ventana de 24 h. La estructura de `sendWhatsApp()` está
> lista para añadir el envío por plantilla cuando tengas las tuyas aprobadas.

---

## Requisitos y puesta en marcha

- Node.js **22 o superior** (usa el módulo integrado `node:sqlite`).
- No requiere compiladores ni servicios externos para funcionar.

```bash
npm install
npm start          # http://localhost:3000
# o bien
npm run dev        # recarga automática con --watch
```

La base de datos se crea sola en `data/amapola.db` con datos de demostración la
primera vez. Para empezar de cero, detén el servidor y borra la carpeta `data/`.

### Cuentas de demostración

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administración | `admin@amapola.cl` | `admin123` |
| Clienta | `cliente@demo.cl` | `cliente123` |

También puedes crear tu propia cuenta desde **Ingresar → Crea tu cuenta**.

---

## Estructura del proyecto

```
sistema/
├── server.js              # Servidor Express, .env, estáticos y manejo de errores
├── src/
│   ├── db.js              # SQLite (node:sqlite), esquema, hash de contraseñas y seed
│   ├── time.js            # Fechas/horas en la zona horaria del salón
│   ├── auth.js            # Sesiones por token y middlewares de rol
│   ├── booking.js         # Horarios, disponibilidad y validación de reservas
│   ├── notify.js          # Crea el mensaje en la cuenta + envía copia a WhatsApp
│   ├── whatsapp.js        # Adaptador Meta / Twilio / simulador
│   └── routes.js          # API REST completa
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── img/               # Imágenes del sitio
│   └── js/
│       ├── api.js         # Cliente HTTP con token en localStorage
│       ├── core.js        # Estado, iconos, layout, router y utilidades
│       ├── pages.js       # Inicio, acceso, reserva, mis reservas y mensajes
│       └── admin.js       # Panel de administración
└── data/                  # Base SQLite y bitácora de WhatsApp (no versionado)
```

### Modelo de datos
- `users` — clientas y administración (con teléfono para WhatsApp).
- `services` — nombre, descripción, duración y precio.
- `staff` — estilistas con especialidad y color.
- `appointments` — reserva (clienta, servicio, estilista, fecha, hora, estado).
- `messages` — mensajes de la cuenta (título, cuerpo, categoría, leído).
- `whatsapp_log` — copia exacta enviada, proveedor, estado y error.
- `sessions` — token de sesión con expiración.

---

## API (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Crea cuenta + mensaje de bienvenida por WhatsApp |
| POST | `/api/auth/login` | Inicia sesión y devuelve token |
| GET | `/api/services`, `/api/staff` | Catálogo público |
| GET | `/api/availability?date&serviceId` | Horarios libres por estilista |
| POST | `/api/appointments` | Crea reserva y envía confirmación |
| PATCH | `/api/appointments/:id` | Cambia estado (con aviso opcional) |
| GET | `/api/messages` | Bandeja de la clienta con estado de WhatsApp |
| POST | `/api/messages/:id/read` | Marca leído |
| GET | `/api/admin/stats` | Métricas del panel |
| GET | `/api/admin/clients` | Listado de clientas con historial |
| POST | `/api/admin/messages` | **Envía a la cuenta y copia a WhatsApp** |
| POST | `/api/admin/reminders/tomorrow` | Recordatorios masivos del día siguiente |
| GET | `/api/admin/outbox` | Bitácora de envíos WhatsApp |
| POST | `/api/admin/whatsapp/test` | Mensaje de prueba |
| POST/PATCH | `/api/admin/services`, `/api/admin/staff` | Catálogo y equipo |

La autenticación usa `Authorization: Bearer <token>`.

---

## Decisiones de seguridad y producción

- Contraseñas con `scrypt` + sal; sesiones con token aleatorio de 32 bytes y expiración.
- Validación de solapamientos en el servidor (no solo en la interfaz).
- URLs y textos escapados en el frontend para evitar inyección de HTML.
- Para producción: servir detrás de HTTPS, rotar los tokens de WhatsApp y respaldar
  `data/amapola.db`. Si el volumen crece, migrar de SQLite a PostgreSQL manteniendo
  el mismo esquema.
- WhatsApp Business API requiere consentimiento del usuario para enviar mensajes;
  las cuentas se crean con aceptación implícita al registrarse y el número se usa
  exclusivamente para las notificaciones del salón.
