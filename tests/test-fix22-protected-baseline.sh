#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
from pathlib import Path
import hashlib
import json
import stat
import sys
manifest = json.loads(Path('tests/fix22-protected-files.json').read_text())
expected_base = '56e2e53416a772b7753e7af45d0fbc969bea61e372ae657fc599cc04ea6b4a5e'
if manifest.get('base_sha256') != expected_base:
    raise SystemExit('FIX22 PROTECTION FAILED: wrong source archive checksum recorded')
errors=[]
for entry in manifest.get('entries', []):
    path=Path(entry['path'])
    if not path.is_file():
        errors.append(f'{path}: missing')
        continue
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    mode=oct(stat.S_IMODE(path.stat().st_mode))
    if digest != entry['sha256']:
        errors.append(f'{path}: content changed')
    if mode != entry['mode']:
        errors.append(f'{path}: mode {mode}, expected {entry["mode"]}')
if errors:
    for error in errors[:50]:
        print('FIX22 PROTECTION FAILED:', error, file=sys.stderr)
    raise SystemExit(1)
print(f'FIX22 protected baseline unchanged: PASS ({len(manifest["entries"])} files)')
PY
