#!/usr/bin/env bash
# Empaqueta el plugin para subirlo a WordPress:
#   Plugins → Añadir nuevo → Subir plugin → Elegir archivo.
#
# Uso:  bash deploy/wordpress/build-plugin.sh
# Sale: dist/jardin-memorial-<versión>.zip
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
raiz="$(cd "$here/../.." && pwd)"
src="$here/plugin/jardin-memorial"

if [ ! -f "$src/jardin-memorial.php" ]; then
  echo "No encuentro el plugin en $src" >&2
  exit 1
fi

version="$(grep -m1 -E '^[[:space:]]*\*[[:space:]]*Version:' "$src/jardin-memorial.php" | sed -E 's/.*Version:[[:space:]]*//' | tr -d '[:space:]')"
[ -n "$version" ] || version="0.0.0"

mkdir -p "$raiz/dist"
out="$raiz/dist/jardin-memorial-$version.zip"
rm -f "$out"

cd "$here/plugin"

# `zip` existe en casi todos los Linux/macOS; si no, se usa Python.
if command -v zip >/dev/null 2>&1; then
  zip -r -q "$out" jardin-memorial \
    -x '*.DS_Store' '__MACOSX/*' '*.swp' '*~' '*.git*'
else
  python3 - "$out" <<'PY'
import os, sys, zipfile
out = sys.argv[1]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk('jardin-memorial'):
        dirs[:] = [d for d in dirs if d not in ('__MACOSX', '.git')]
        for name in files:
            if name == '.DS_Store' or name.endswith('~') or name.endswith('.swp'):
                continue
            path = os.path.join(base, name)
            z.write(path, path)
PY
fi

echo "Listo: $out"
echo "Tamaño: $(du -h "$out" | cut -f1)"
echo "Súbelo en WordPress → Plugins → Añadir nuevo → Subir plugin."
