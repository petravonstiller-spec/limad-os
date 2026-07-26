#!/usr/bin/env bash
# Final acceptance check. Runs inside the image and fails the build if the
# LiMaD look is not completely in place.
set -Eeuo pipefail

# shellcheck source=/dev/null
source /ctx/build_files/versions.env

fail() { echo "ACCEPTANCE FAILED: $*" >&2; exit 1; }

# Step 20 recorded the theme names the upstream installer actually produced.
if [[ -f /usr/share/limad/theme-names.env ]]; then
  # shellcheck source=/dev/null
  source /usr/share/limad/theme-names.env
fi
LIMAD_GTK_THEME_VARIANT="${LIMAD_GTK_THEME_ACTUAL:-$LIMAD_GTK_THEME_VARIANT}"
LIMAD_WHITESUR_ICON_NAME="${LIMAD_WHITESUR_ICON_ACTUAL:-$LIMAD_WHITESUR_ICON_NAME}"

# Same throwaway environment as in step 50: /root is not writable here.
export HOME="/tmp/limad-gsettings/home"
export XDG_CACHE_HOME="/tmp/limad-gsettings/cache"
export XDG_RUNTIME_DIR="/tmp/limad-gsettings/run"
export GSETTINGS_BACKEND="memory"
install -d -m 0700 "$HOME" "$XDG_CACHE_HOME/dconf" "$XDG_RUNTIME_DIR"

echo ":: Acceptance check"

# 1. GTK theme, in all three toolkit generations.
[[ -f "/usr/share/themes/${LIMAD_GTK_THEME_VARIANT}/gtk-3.0/gtk.css" ]] \
  || fail "GTK3 stylesheet missing"
[[ -f "/usr/share/themes/${LIMAD_GTK_THEME_VARIANT}/gtk-4.0/gtk.css" ]] \
  || fail "GTK4 stylesheet missing"
[[ -f "/etc/skel/.config/gtk-4.0/gtk.css" ]] \
  || fail "libadwaita theme missing in /etc/skel"

# 2. gnome-shell theme. Without it the top bar stays plain GNOME, which is not
#    the LiMaD look, so this is a hard failure unless explicitly relaxed.
SHELL_CSS="/usr/share/themes/${LIMAD_SHELL_THEME_ACTUAL:-$LIMAD_GTK_THEME_VARIANT}/gnome-shell/gnome-shell.css"
if [[ ! -f "$SHELL_CSS" ]]; then
  if [[ "${LIMAD_REQUIRE_SHELL_THEME:-1}" == "1" ]]; then
    fail "no gnome-shell stylesheet at ${SHELL_CSS}; the shell would stay plain GNOME"
  fi
  echo "   WARNING: no gnome-shell stylesheet; the shell keeps the GNOME default" >&2
fi

# 3. Icons: WhiteSur base plus the LiMaD overlay.
[[ -f "/usr/share/icons/${LIMAD_WHITESUR_ICON_NAME}/index.theme" ]] \
  || fail "WhiteSur icon theme ${LIMAD_WHITESUR_ICON_NAME} missing"
grep -q "^Inherits=${LIMAD_WHITESUR_ICON_NAME}" \
  "/usr/share/icons/${LIMAD_ICON_THEME_NAME}/index.theme" \
  || fail "the LiMaD overlay does not inherit ${LIMAD_WHITESUR_ICON_NAME}"
[[ -f "/usr/share/icons/${LIMAD_ICON_THEME_NAME}/index.theme" ]] \
  || fail "LiMaD icon theme missing"

for icon in de.limad.Cut de.limad.Drop de.limad.Study de.limad.Nws; do
  [[ -f "/usr/share/icons/${LIMAD_ICON_THEME_NAME}/512x512/apps/${icon}.png" ]] \
    || fail "own application icon missing: ${icon}"
done
[[ -f "/usr/share/icons/${LIMAD_ICON_THEME_NAME}/scalable/apps/de.limad.AnycubicSlicerNext.svg" ]] \
  || fail "own application icon missing: de.limad.AnycubicSlicerNext"

# 4. The overlay must not shadow generic WhiteSur icons.
if find "/usr/share/icons/${LIMAD_ICON_THEME_NAME}" -type d \
     \( -name places -o -name mimetypes -o -name devices -o -name status -o -name actions \) \
     | grep -q .; then
  fail "LiMaD icon theme contains generic icons; those belong to WhiteSur"
fi

# 5. Compiled defaults.
[[ -f /usr/share/glib-2.0/schemas/gschemas.compiled ]] || fail "GLib schemas not compiled"
gsettings --schemadir /usr/share/glib-2.0/schemas get org.gnome.desktop.interface icon-theme \
  | grep -q "${LIMAD_ICON_THEME_NAME}" || fail "default icon theme is not ${LIMAD_ICON_THEME_NAME}"
gsettings --schemadir /usr/share/glib-2.0/schemas get org.gnome.desktop.interface gtk-theme \
  | grep -q "${LIMAD_GTK_THEME_VARIANT}" || fail "default GTK theme is not ${LIMAD_GTK_THEME_VARIANT}"
[[ -f /usr/share/limad/theme-names.env ]] || fail "theme name record from step 20 missing"
# shellcheck source=/dev/null
source /usr/share/limad/theme-names.env
EXPECTED_SHELL_THEME="${LIMAD_SHELL_THEME_ACTUAL:-$LIMAD_SHELL_THEME_VARIANT}"
SHELL_THEME="$(gsettings --schemadir /usr/share/glib-2.0/schemas get org.gnome.shell.extensions.user-theme name 2>/dev/null || echo '?')"
[[ "$SHELL_THEME" == "'${EXPECTED_SHELL_THEME}'" ]]   || fail "default GNOME Shell theme is ${SHELL_THEME}, expected ${EXPECTED_SHELL_THEME}"
BUTTON_LAYOUT="$(gsettings --schemadir /usr/share/glib-2.0/schemas get org.gnome.desktop.wm.preferences button-layout 2>/dev/null || echo '?')"
[[ "$BUTTON_LAYOUT" == "'close,maximize,minimize:'" ]]   || fail "FIX22 left-side window buttons changed: ${BUTTON_LAYOUT}"
FAVORITES="$(gsettings --schemadir /usr/share/glib-2.0/schemas get org.gnome.shell favorite-apps 2>/dev/null || echo '?')"
for desktop in app.zen_browser.zen.desktop io.github.hkdb.Aerion.desktop de.limad.Cut.desktop de.limad.Study.desktop de.limad.Drop.desktop de.limad.WindowsApps.desktop de.limad.Updater.desktop de.limad.AnycubicSlicerNext.desktop us.zoom.Zoom.desktop app.ytmdesktop.ytmdesktop.desktop de.limad.Klang.desktop io.github.kolunmi.Bazaar.desktop org.gnome.Console.desktop org.gnome.Nautilus.desktop; do
  [[ "$FAVORITES" == *"'$desktop'"* ]] || fail "requested dock favorite missing: ${desktop}"
done

# 6. Wallpapers: the LiMaD images and the registered default.
for wp in /usr/share/backgrounds/limad/LiMaD-Wallpaper-*.png; do
  [[ -f "$wp" ]] || fail "no LiMaD wallpaper installed"
  break
done
[[ -f /usr/share/gnome-background-properties/limad-wallpapers.xml ]] \
  || fail "wallpapers are not selectable in Settings"
[[ -f "/usr/share/glib-2.0/schemas/zzzzzzzzzz-limad-wallpaper.gschema.override" ]] \
  || fail "no default wallpaper configured"
DEFAULT_WP="$(sed -n "s|^picture-uri='file://\(.*\)'|\1|p" \
  /usr/share/glib-2.0/schemas/zzzzzzzzzz-limad-wallpaper.gschema.override | head -n1)"
[[ -f "$DEFAULT_WP" ]] || fail "configured wallpaper does not exist: ${DEFAULT_WP}"

# 7. Provenance of both upstream sources is retained.
[[ -f /usr/share/limad-source/mactahoe-gtk-theme/PROVENANCE.txt ]] || fail "MacTahoe provenance missing"
[[ -f /usr/share/limad-source/whitesur-icon-theme/PROVENANCE.txt ]] || fail "WhiteSur provenance missing"

# 8. Natively shipped LiMaD applications.
for bin in /usr/local/bin/limad-cut /usr/local/bin/limad-study /usr/local/bin/limad-drop \
           /usr/bin/anycubicslicernext /usr/local/bin/limad-windows-setup \
           /usr/local/bin/limad-winrun /usr/local/bin/limad-wine-diagnose \
           /usr/local/bin/limad-first-login-setup /usr/local/bin/limad-firefox-theme-setup \
           /usr/local/bin/limad-updater /usr/local/bin/limad-klang \
           /usr/local/bin/limad-install-klang-preset /usr/local/bin/limad-easyeffects-service; do
  [[ -x "$bin" ]] || fail "application launcher missing or not executable: $bin"
done
[[ -f /usr/share/limad-cut/native_shell.py ]] || fail "LiMaDCut payload missing"
[[ -d /usr/share/limad-study/src/limad_study ]] || fail "LiMaD Study payload missing"
[[ -f /usr/share/limad-drop/limad_dropd.py ]] || fail "LiDrop payload missing"
[[ -x /usr/lib/limad/apps/anycubic-slicer-next/bin/AnycubicSlicerNext ]] \
  || fail "Anycubic Slicer Next binary missing"
[[ -f /usr/share/limad-windows/installer.py ]] || fail "Windows installer missing"
[[ -f /usr/share/limad-windows/recipe_engine.py ]] || fail "Windows recipe engine missing"
python3 -c 'from pathlib import Path; import sys; [compile(Path(p).read_text(encoding="utf-8"), p, "exec") for p in sys.argv[1:]]' /usr/share/limad-windows/installer.py /usr/share/limad-windows/recipe_engine.py || fail "Windows installer Python validation failed"
[[ -f /usr/share/icons/LiMaD/64x64/apps/limad-start.png ]] || fail "original LiMaD L start icon missing"
[[ -f /etc/xdg/autostart/limad-first-login.desktop ]] || fail "first-login setup missing"
[[ -x /usr/local/bin/limad-install-default-flatpaks ]] || fail "default Flatpak installer missing"
[[ -x /usr/local/bin/limad-aerion-native-titlebar ]] || fail "Aerion native-titlebar helper missing"
grep -Fq "native_titlebar" /usr/local/bin/limad-aerion-native-titlebar || fail "Aerion native-titlebar preference missing"
[[ -f /etc/xdg/autostart/limad-default-flatpaks.desktop ]] || fail "default Flatpak autostart missing"
[[ -f /usr/share/applications/de.limad.Klang.desktop ]] || fail "LiMaD Klang desktop entry missing"
[[ -f "/usr/share/limad-klang/LiMaD Klang.json" ]] || fail "LiMaD Klang preset missing"
[[ -f /etc/xdg/autostart/limad-easyeffects-service.desktop ]] || fail "EasyEffects service autostart missing"
[[ -f /usr/share/limad/firefox/chrome/userChrome.css ]] || fail "Firefox LiMaD theme missing"
[[ -f /etc/xdg/autostart/limad-firefox-theme.desktop ]] || fail "Firefox setup autostart missing"
[[ -f /usr/share/limad-updater/apps.json ]] || fail "LiMaD app updater missing"
[[ -f /usr/share/applications/de.limad.Updater.desktop ]] || fail "LiMaD updater desktop entry missing"
[[ -f /usr/share/plymouth/themes/limad/boot-splash.png ]] || fail "LiMaD boot splash image missing"
[[ -f /usr/share/plymouth/themes/limad/limad.script ]] || fail "LiMaD Plymouth script missing"
for frame in /usr/share/plymouth/themes/limad/spinner-{00..11}.png; do
  [[ -s "$frame" ]] || fail "LiMaD Plymouth spinner frame missing: ${frame}"
done
grep -q 'Plymouth.SetRefreshFunction(refresh_callback)' /usr/share/plymouth/themes/limad/limad.script   || fail "LiMaD Plymouth spinner animation is not registered"
grep -q '^Theme=limad$' /etc/plymouth/plymouthd.conf || fail "LiMaD Plymouth theme not selected"
[[ "$(readlink -f /usr/share/plymouth/themes/default.plymouth)" == /usr/share/plymouth/themes/limad/limad.plymouth ]] || fail "default Plymouth link is not LiMaD"
grep -q '^ID=fedora$' /usr/lib/os-release || fail "technical distro ID is not Fedora-compatible"
grep -q '^NAME="LiMaD OS"$' /usr/lib/os-release || fail "visible OS identity is not LiMaD"
grep -q '^BOOTLOADER_NAME="LiMaD OS ' /usr/lib/os-release || fail "bootloader identity is not LiMaD"
for branding_id in limad bazzite fedora; do
  [[ -f "/usr/share/cockpit/branding/${branding_id}/branding.css" ]]     || fail "installed Cockpit/Anaconda branding missing for ${branding_id}"
  [[ -s "/usr/share/cockpit/branding/${branding_id}/logo.png" ]]     || fail "installed LiMaD branding logo missing for ${branding_id}"
done
[[ -s /usr/share/pixmaps/de.limad.Logo.png ]] || fail "LiMaD system information logo missing"

# 8a. Bazzite GNOME must use a branded GDM login screen.
if [[ "${BASE_IMAGE_REF}" == *bazzite-gnome* ]]; then
  [[ -f /usr/lib/systemd/system/gdm.service ]] || fail "gdm.service missing from Bazzite GNOME image"
  ACTIVE_DM="$(readlink -f /etc/systemd/system/display-manager.service || true)"
  [[ "$ACTIVE_DM" == /usr/lib/systemd/system/gdm.service ]] \
    || fail "Bazzite GNOME display manager is not GDM: ${ACTIVE_DM:-missing}"
  [[ -s /usr/share/limad/gdm-branding.env ]] || fail "GDM branding record missing"
  # shellcheck source=/dev/null
  source /usr/share/limad/gdm-branding.env
  [[ "$LIMAD_DISPLAY_MANAGER" == gdm ]] || fail "GDM branding record has wrong display manager"
  [[ -s "$LIMAD_GDM_RESOURCE" ]] || fail "branded GDM resource missing"
  [[ -s "$LIMAD_GDM_BACKGROUND" ]] || fail "LiMaD GDM background missing"
  CURRENT_GDM_SHA256="$(sha256sum "$LIMAD_GDM_RESOURCE" | awk '{print $1}')"
  [[ "$CURRENT_GDM_SHA256" == "$LIMAD_GDM_BRANDED_SHA256" ]] \
    || fail "GDM resource hash no longer matches the branded resource"
  [[ "$LIMAD_GDM_BRANDED_SHA256" != "$LIMAD_GDM_ORIGINAL_SHA256" ]] \
    || fail "GDM branded resource equals the original resource"
fi

# 8b. The system Logo Menu release must support the installed GNOME Shell.
python3 - <<'PY_LOGOMENU'
import json
import re
import subprocess
from pathlib import Path
metadata = Path('/usr/share/gnome-shell/extensions/logomenu@aryan_k/metadata.json')
if not metadata.is_file():
    raise SystemExit('ACCEPTANCE FAILED: Logo Menu metadata missing')
version = subprocess.check_output(['gnome-shell', '--version'], text=True).strip()
match = re.search(r'\b(\d+)(?:\.\d+)*$', version)
if not match:
    raise SystemExit(f'ACCEPTANCE FAILED: cannot parse GNOME Shell version: {version}')
major = match.group(1)
supported = {str(item) for item in json.loads(metadata.read_text()).get('shell-version', [])}
if major not in supported:
    raise SystemExit(f'ACCEPTANCE FAILED: Logo Menu supports {sorted(supported)}, installed GNOME is {major}')
PY_LOGOMENU

for desktop in de.limad.Cut de.limad.Study de.limad.Drop de.limad.AnycubicSlicerNext \
               de.limad.WindowsApps de.limad.Updater; do
  [[ -f "/usr/share/applications/${desktop}.desktop" ]] || fail "desktop entry missing: ${desktop}"
done

# 9. Wine, and the file types that reach the installer.
if [[ "${LIMAD_INSTALL_WINE:-1}" == "1" ]]; then
  command -v wine >/dev/null || fail "Wine is enabled but not installed"
  for pkg in wine-core wine-mono mingw32-wine-gecko mingw64-wine-gecko wine-pulseaudio; do
    rpm -q "$pkg" >/dev/null 2>&1 || fail "Wine runtime package missing: $pkg"
  done
  [[ -f /usr/share/limad/wine-smoke-test.txt ]] || fail "Wine prefix/command smoke test did not pass"
  grep -q 'de.limad.WindowsRun.desktop' /usr/share/applications/mimeapps.list \
    || fail "EXE/MSI files are not routed to the LiMaD Windows installer"
fi

echo ":: Acceptance check passed"
