#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
from pathlib import Path
import sys
sf=Path('system_files')
def fail(m): sys.exit('WINE INTEGRATION FAILED: '+m)
build=Path('build_files/80-wine-installer.sh').read_text()
for pkg in ['wine-mono','mingw32-wine-gecko','mingw64-wine-gecko','wine-pulseaudio','xorg-x11-server-Xvfb']:
    if pkg not in build: fail('required package missing: '+pkg)
for needle in ['xvfb-run -a wineboot --init','echo LIMAD_WINE_OK','wine-smoke-test.txt']:
    if needle not in build: fail('build smoke missing: '+needle)
env=(sf/'usr/share/limad-windows/wine-env.sh').read_text()
if 'WINEDLLOVERRIDES' in env: fail('Wine Mono/Gecko are still disabled')
if 'DISPLAY="${DISPLAY:-:0}"' in env: fail('DISPLAY is still forced')
installer=(sf/'usr/share/limad-windows/installer.py').read_text()
for needle in ['AppData/Local/Programs','Wine-Code','echo LIMAD_WINE_OK','portable application']:
    if needle not in installer: fail('installer missing: '+needle)
if 'WINEDLLOVERRIDES' in installer: fail('installer still disables Mono/Gecko')
if not (sf/'usr/local/bin/limad-wine-diagnose').is_file(): fail('diagnose helper missing')
print('Wine packages, prefix smoke and installer detection: PASS')
PY
