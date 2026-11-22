# Jardín Memorial · imagen de producción
# Node 22 incluye node:sqlite, que la app usa como base de datos.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

WORKDIR /app

# curl se usa solo para el healthcheck del contenedor.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Dependencias primero: así la capa se reutiliza si solo cambia el código.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

# Los archivos subidos y la base SQLite viven en /app/data (volumen).
RUN mkdir -p /app/data/uploads /app/data/tmp \
    && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "--experimental-sqlite", "server.js"]
