#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/schemas"
cat > "$TMP/schemas/10-upstream.gschema.override" <<'EOF'
[org.gnome.shell]
favorite-apps=['org.gnome.Nautilus.desktop']
EOF
python3 "$ROOT/build_files/enforce-gnome-favorite-apps.py" "$TMP/schemas" >/dev/null
python3 - "$TMP/schemas" <<'PY'
from pathlib import Path
import ast, re, sys
root=Path(sys.argv[1])
expected=[
'app.zen_browser.zen.desktop','io.github.hkdb.Aerion.desktop','de.limad.Cut.desktop','de.limad.Study.desktop',
'de.limad.Drop.desktop','de.limad.WindowsApps.desktop','de.limad.Updater.desktop',
'de.limad.AnycubicSlicerNext.desktop','us.zoom.Zoom.desktop','app.ytmdesktop.ytmdesktop.desktop','de.limad.Klang.desktop',
'io.github.kolunmi.Bazaar.desktop','org.gnome.Console.desktop','org.gnome.Nautilus.desktop']
for path in root.glob('*.gschema.override'):
    text=path.read_text(); match=re.search(r'^favorite-apps=(.*)$', text, re.M)
    if match and ast.literal_eval(match.group(1)) != expected:
        raise SystemExit(f'{path.name}: wrong exact favorites')
canonical=root/'zzzzzzzzzzzz-limad-favorite-apps.gschema.override'
if not canonical.is_file(): raise SystemExit('canonical dock override missing')
PY
grep -Fq 'enforce-gnome-favorite-apps.py' "$ROOT/build_files/50-gnome-defaults.sh"
grep -Eq 'gnome42-phase4-fix(32|35|36|37|38|39|41|42|43)' "$ROOT/build_files/versions.env"
echo 'FIX28 canonical dock favorites override: PASS'
