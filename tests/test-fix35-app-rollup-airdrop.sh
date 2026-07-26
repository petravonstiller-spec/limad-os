#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
source build_files/versions.env
[[ "$LIMAD_BUILD_REVISION" =~ ^gnome42-phase4-fix(35|36|37|38|39|41|42|43)$ ]]
[[ "$LIMAD_STUDY_VERSION" == "6.2.1" ]]
[[ "$LIMAD_CUT_VERSION" == "1.1.3" ]]
[[ "$LIDROP_VERSION" == "0.11.0-preview4" ]]
[[ "$OWL_COMMIT" == "8e4e840b212ae5a09a8a99484be3ab18bad22fa7" ]]
[[ "$OPENDROP_COMMIT" == "ae5ac821fb3b233df3ac800e4eb47f287f4422cf" ]]
[[ "$(cat system_files/usr/share/limad-study/VERSION)" == "6.2.1" ]]
[[ "$(cat system_files/usr/share/limad-cut/VERSION)" == "1.1.3" ]]
[[ "$(cat system_files/usr/share/limad-drop/VERSION)" == "0.11.0-preview4" ]]
grep -q '65-airdrop-compat.sh' build_files/build.sh
grep -q 'limad-select-app-root' system_files/usr/local/bin/limad-study
grep -q 'limad-select-app-root' system_files/usr/local/bin/limad-cut
grep -q 'limad-select-app-root' system_files/usr/local/bin/limad-drop
for f in  system_files/usr/local/bin/limad-airdrop-check  system_files/usr/local/bin/limad-airdrop-control  system_files/usr/local/bin/limad-airdrop-session  system_files/usr/local/bin/limad-airdrop-wait  system_files/usr/local/bin/limad-opendrop-receive  system_files/usr/lib/systemd/system/limad-awdl@.service  system_files/usr/lib/systemd/user/limad-opendrop-receive.service  system_files/usr/share/polkit-1/rules.d/49-limad-airdrop.rules; do [[ -f "$f" ]]; done
! grep -RqsE 'enable[[:space:]]+limad-awdl@|enable[[:space:]]+limad-opendrop-receive' build_files system_files
python3 -m py_compile  system_files/usr/share/limad-drop/limad_dropd.py  system_files/usr/share/limad-cut/native_shell.py  system_files/usr/local/bin/limad-airdrop-check  system_files/usr/local/bin/limad-airdrop-session
if command -v node >/dev/null 2>&1; then node --check system_files/usr/share/limad-drop/web/app.js; fi
grep -q 'disabled>Nur bekannte Geräte' system_files/usr/share/limad-drop/web/app.js
grep -q 'separate freie WLAN-Schnittstelle' system_files/usr/local/bin/limad-airdrop-check
echo "FIX35 App-Rollup und AirDrop-Sicherheitsintegration: OK"
