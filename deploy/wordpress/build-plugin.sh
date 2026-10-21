#!/usr/bin/env bash
# Genera deploy/wordpress/jardin-memorial.zip, listo para subir en
# WordPress → Plugins → Añadir nuevo → Subir plugin.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/plugin/jardin-memorial"
out="$here/jardin-memorial.zip"

if [ ! -f "$src/jardin-memorial.php" ]; then
  echo "No encuentro el plugin en $src" >&2
  exit 1
fi

rm -f "$out"
cd "$here/plugin"
zip -r -q "$out" jardin-memorial \
  -x '*.DS_Store' '__MACOSX/*' '*.swp' '*~'

echo "Listo: $out"
echo "Súbelo en WordPress → Plugins → Añadir nuevo → Subir plugin."
