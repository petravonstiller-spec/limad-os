#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."

fail() { echo "WALLPAPER OVERRIDE HARDENING FAILED: $*" >&2; exit 1; }

TOOL="build_files/enforce-gnome-wallpaper.py"
[[ -x "$TOOL" ]] || fail "wallpaper normalization helper missing or not executable"
grep -q 'enforce-gnome-wallpaper.py' build_files/50-gnome-defaults.sh \
  || fail "GNOME defaults step does not invoke the helper"
grep -q 'zzzzzzzzzz-limad-wallpaper.gschema.override' "$TOOL" \
  || fail "canonical late override name missing"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/schemas" "$TMP/backgrounds"
touch "$TMP/backgrounds/LiMaD-Wallpaper.png"

cat > "$TMP/schemas/10-base.gschema.override" <<'EOF'
[org.gnome.desktop.background]
picture-uri='file:///usr/share/backgrounds/base.xml'
picture-uri-dark='file:///usr/share/backgrounds/base-dark.xml'
picture-options='scaled'

[org.gnome.desktop.interface]
color-scheme='prefer-dark'
EOF

cat > "$TMP/schemas/zzzzzzzzzzzz-upstream.gschema.override" <<'EOF'
[org.gnome.desktop.background]
picture-uri='file:///usr/share/backgrounds/convergence-dynamic.xml'
picture-uri-dark='file:///usr/share/backgrounds/convergence-dynamic.xml'

[org.gnome.desktop.screensaver]
picture-uri='file:///usr/share/backgrounds/convergence-dynamic.xml'
EOF

python3 "$TOOL" "$TMP/schemas" "$TMP/backgrounds/LiMaD-Wallpaper.png" >/tmp/limad-wallpaper-test.log

python3 - "$TMP/schemas" "$TMP/backgrounds/LiMaD-Wallpaper.png" <<'PY'
import re
import sys
from pathlib import Path

schema_dir = Path(sys.argv[1])
wallpaper = Path(sys.argv[2]).resolve()
uri = f"file://{wallpaper}"
canonical = schema_dir / "zzzzzzzzzz-limad-wallpaper.gschema.override"
if not canonical.is_file():
    raise SystemExit("canonical override not created")
for path in schema_dir.glob("*.gschema.override"):
    text = path.read_text(encoding="utf-8")
    for match in re.finditer(r"^picture-uri(?:-dark)?=(.*)$", text, re.M):
        if match.group(1) != repr(uri):
            raise SystemExit(f"conflicting wallpaper remains in {path.name}: {match.group(0)}")
    for match in re.finditer(r"^picture-options=(.*)$", text, re.M):
        if match.group(1) != "'zoom'":
            raise SystemExit(f"conflicting picture-options remains in {path.name}: {match.group(0)}")
print("synthetic conflicting override normalization: PASS")
PY

echo "Wallpaper override conflict hardening: PASS"
