#!/usr/bin/env bash
#
# Levanta un entorno de prueba (staging) con base de datos propia.
#
# Diferencias con el entorno normal:
#   · NODE_ENV=production y SEED_DEMO=false: arranca vacío, como una
#     instalación nueva, para recorrer el registro y la compra reales.
#   · Base de datos y archivos en un directorio aparte: no toca ./data.
#   · Los cobros siguen en modo demostración (pasarela de prueba incluida),
#     salvo que se pasen credenciales reales.
#
# Uso:
#   scripts/entorno-prueba.sh                 # puerto 3100, datos en ~/jardin-ensayo
#   PORT=3200 scripts/entorno-prueba.sh
#   DATA_DIR=/srv/jardin-ensayo scripts/entorno-prueba.sh
#
# Variables opcionales: PORT, DATA_DIR, SITE_URL, EMBED_ORIGINS, ADMIN_EMAILS,
# además de las credenciales de pago habituales (MP_*, FLOW_*).

set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-3100}"
DATA_DIR="${DATA_DIR:-$HOME/jardin-ensayo}"
ADMIN_EMAILS="${ADMIN_EMAILS:-}"

mkdir -p "$DATA_DIR"
echo "→ Entorno de prueba en http://localhost:$PORT"
echo "  datos: $DATA_DIR (para reiniciar de cero: bórralo)"
echo "  cuentas: regístrate en /registro (la base arranca vacía)"

exec env \
  NODE_ENV=production \
  PORT="$PORT" \
  DATA_DIR="$DATA_DIR" \
  SEED_DEMO=false \
  SITE_URL="${SITE_URL:-http://localhost:$PORT}" \
  EMBED_ORIGINS="${EMBED_ORIGINS:-}" \
  ADMIN_EMAILS="$ADMIN_EMAILS" \
  npm start
