#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
fail() { echo "FIX32 DEFAULT APPS FAILED: $*" >&2; exit 1; }

INSTALLER=system_files/usr/local/bin/limad-install-default-flatpaks
AERION_TITLEBAR=system_files/usr/local/bin/limad-aerion-native-titlebar
AUTOSTART=system_files/etc/xdg/autostart/limad-default-flatpaks.desktop
OVERRIDE=system_files/usr/share/glib-2.0/schemas/zzzzzzzzzz-limad-defaults.gschema.override
GNOME_STEP=build_files/50-gnome-defaults.sh
[[ -x "$INSTALLER" ]] || fail "installer missing or not executable"
[[ -x "$AERION_TITLEBAR" ]] || fail "Aerion title-bar helper missing or not executable"
grep -Fq "native_titlebar" "$AERION_TITLEBAR" || fail "Aerion title-bar preference missing"
[[ -f "$AUTOSTART" ]] || fail "autostart missing"
grep -Fq '75-default-flatpaks.sh' build_files/build.sh || fail "build step not wired"
for id in app.zen_browser.zen io.github.hkdb.Aerion us.zoom.Zoom app.ytmdesktop.ytmdesktop com.github.wwmm.easyeffects io.github.kolunmi.Bazaar; do
  grep -Fq "$id" "$INSTALLER" || fail "installer missing $id"
done
grep -Fq 'flatpak install --user --noninteractive -y flathub' "$INSTALLER" || fail "apps are not installed at user scope"
! grep -Eq 'flatpak install .*--system' "$INSTALLER" || fail "system Flatpak installation would modify global state"

python3 - "$OVERRIDE" <<'PY'
from pathlib import Path
import ast, re, sys
text=Path(sys.argv[1]).read_text()
match=re.search(r'^favorite-apps=(.*)$', text, re.M)
if not match: raise SystemExit('favorite-apps missing')
actual=ast.literal_eval(match.group(1))
expected=[
'app.zen_browser.zen.desktop','io.github.hkdb.Aerion.desktop','de.limad.Cut.desktop','de.limad.Study.desktop',
'de.limad.Drop.desktop','de.limad.WindowsApps.desktop','de.limad.Updater.desktop',
'de.limad.AnycubicSlicerNext.desktop','us.zoom.Zoom.desktop','app.ytmdesktop.ytmdesktop.desktop','de.limad.Klang.desktop',
'io.github.kolunmi.Bazaar.desktop','org.gnome.Console.desktop','org.gnome.Nautilus.desktop']
if actual != expected: raise SystemExit(f'wrong order: {actual}')
step=Path('build_files/50-gnome-defaults.sh').read_text()
dconf=re.search(r'^favorite-apps=(.*)$', step, re.M)
if not dconf: raise SystemExit('dconf favorite-apps missing')
if ast.literal_eval(dconf.group(1)) != expected:
    raise SystemExit('dconf dock order differs from schema order')
for key, value in [('show-trash','true'),('show-show-apps-button','true'),('show-apps-at-top','false')]:
    if not re.search(rf'^{re.escape(key)}={value}$', text, re.M):
        raise SystemExit(f'{key}={value} missing')
PY

# Run the installer against fake Flatpak/GSettings commands, with no network.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/home" "$TMP/runtime"
cat > "$TMP/bin/flatpak" <<'FAKE'
#!/usr/bin/env bash
set -u
printf '%s\n' "$*" >> "$LIMAD_TEST_FLATPAK_LOG"
case "${1-}" in
  remotes) exit 0 ;;
  remote-add) exit 0 ;;
  info) exit 1 ;;
  install) exit 0 ;;
  *) exit 0 ;;
esac
FAKE
cat > "$TMP/bin/gsettings" <<'FAKE'
#!/usr/bin/env bash
case "${1-}" in
 list-schemas) echo org.gnome.shell ;;
 writable) echo true ;;
 set) printf '%s\t%s\t%s\n' "${2-}" "${3-}" "${4-}" >> "$LIMAD_TEST_GSETTINGS_LOG" ;;
 *) exit 0 ;;
esac
FAKE
cat > "$TMP/bin/notify-send" <<'FAKE'
#!/usr/bin/env bash
exit 0
FAKE
chmod 0755 "$TMP/bin/"*
export PATH="$TMP/bin:/usr/bin:/bin"
export HOME="$TMP/home"
export XDG_CONFIG_HOME="$TMP/home/.config"
export XDG_STATE_HOME="$TMP/home/.local/state"
export XDG_RUNTIME_DIR="$TMP/runtime"
export LIMAD_TEST_FLATPAK_LOG="$TMP/flatpak.log"
export LIMAD_TEST_GSETTINGS_LOG="$TMP/gsettings.log"
export LIMAD_AERION_TITLEBAR_HELPER="$PWD/$AERION_TITLEBAR"
export LIMAD_KLANG_PRESET_HELPER="$PWD/system_files/usr/local/bin/limad-install-klang-preset"
export LIMAD_KLANG_PRESET_SOURCE="$PWD/system_files/usr/share/limad-klang/LiMaD Klang.json"

# Pre-seeding is idempotent and must preserve unrelated Aerion settings.
bash "$AERION_TITLEBAR"
python3 - "$HOME/.var/app/io.github.hkdb.Aerion/data/aerion/aerion.db" <<'PYDB'
import sqlite3, sys
path=sys.argv[1]
with sqlite3.connect(path) as db:
    value=db.execute("SELECT value FROM settings WHERE key='native_titlebar'").fetchone()
    if value != ('true',): raise SystemExit(f'wrong native_titlebar value: {value!r}')
    db.execute("INSERT INTO settings(key,value) VALUES('unrelated_test','keep-me')")
PYDB
bash "$AERION_TITLEBAR"
python3 - "$HOME/.var/app/io.github.hkdb.Aerion/data/aerion/aerion.db" <<'PYDB'
import sqlite3, stat, sys
from pathlib import Path
path=Path(sys.argv[1])
with sqlite3.connect(path) as db:
    native=db.execute("SELECT value FROM settings WHERE key='native_titlebar'").fetchone()
    other=db.execute("SELECT value FROM settings WHERE key='unrelated_test'").fetchone()
if native != ('true',): raise SystemExit(f'native setting changed: {native!r}')
if other != ('keep-me',): raise SystemExit(f'unrelated setting lost: {other!r}')
if stat.S_IMODE(path.stat().st_mode) != 0o600: raise SystemExit('Aerion DB permissions are not 0600')
PYDB

bash "$INSTALLER"
[[ -f "$XDG_CONFIG_HOME/limad/default-flatpaks-fix43.done" ]] || fail "completion marker missing"
grep -Fq 'install --user --noninteractive -y flathub app.zen_browser.zen' "$TMP/flatpak.log" || fail "Zen not installed"
grep -Fq 'install --user --noninteractive -y flathub io.github.hkdb.Aerion' "$TMP/flatpak.log" || fail "Aerion not installed"
grep -Fq 'install --user --noninteractive -y flathub us.zoom.Zoom' "$TMP/flatpak.log" || fail "Zoom not installed"
grep -Fq 'install --user --noninteractive -y flathub app.ytmdesktop.ytmdesktop' "$TMP/flatpak.log" || fail "YTMDesktop not installed"
grep -Fq 'install --user --noninteractive -y flathub com.github.wwmm.easyeffects' "$TMP/flatpak.log" || fail "EasyEffects not installed"
grep -Fq 'install --user --noninteractive -y flathub io.github.kolunmi.Bazaar' "$TMP/flatpak.log" || fail "Bazaar not installed"
grep -Fq "app.zen_browser.zen.desktop" "$TMP/gsettings.log" || fail "dock order not applied"

echo "FIX32 Aerion native title bar, default apps and exact dock order: PASS"
