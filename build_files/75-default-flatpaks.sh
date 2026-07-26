#!/usr/bin/env bash
# Wires user-scoped default Flatpaks. Downloads happen after the real user logs
# in, never inside the bootc container build where /var is not deployment state.
set -Eeuo pipefail

# shellcheck source=/dev/null
source /ctx/build_files/versions.env

echo ":: Preparing LiMaD default Flatpak applications"
command -v flatpak >/dev/null 2>&1 || {
  echo "FATAL: Bazzite base image does not provide Flatpak" >&2
  exit 1
}
readonly INSTALLER=/usr/local/bin/limad-install-default-flatpaks
readonly AERION_TITLEBAR=/usr/local/bin/limad-aerion-native-titlebar
readonly AUTOSTART=/etc/xdg/autostart/limad-default-flatpaks.desktop
readonly KLANG_DESKTOP=/usr/share/applications/de.limad.Klang.desktop
readonly KLANG_LAUNCHER=/usr/local/bin/limad-klang
readonly KLANG_PRESET_INSTALLER=/usr/local/bin/limad-install-klang-preset
readonly KLANG_SERVICE=/usr/local/bin/limad-easyeffects-service
readonly KLANG_AUTOSTART=/etc/xdg/autostart/limad-easyeffects-service.desktop
[[ -f "$INSTALLER" ]] || { echo "FATAL: default Flatpak installer missing" >&2; exit 1; }
[[ -f "$AERION_TITLEBAR" ]] || { echo "FATAL: Aerion title-bar helper missing" >&2; exit 1; }
[[ -f "$AUTOSTART" ]] || { echo "FATAL: default Flatpak autostart missing" >&2; exit 1; }
[[ -f "$KLANG_DESKTOP" ]] || { echo "FATAL: LiMaD Klang desktop entry missing" >&2; exit 1; }
[[ -x "$KLANG_LAUNCHER" ]] || { echo "FATAL: LiMaD Klang launcher missing" >&2; exit 1; }
[[ -x "$KLANG_PRESET_INSTALLER" ]] || { echo "FATAL: LiMaD Klang preset installer missing" >&2; exit 1; }
[[ -x "$KLANG_SERVICE" ]] || { echo "FATAL: LiMaD Klang service helper missing" >&2; exit 1; }
[[ -f "$KLANG_AUTOSTART" ]] || { echo "FATAL: LiMaD Klang autostart missing" >&2; exit 1; }
chmod 0755 "$INSTALLER" "$AERION_TITLEBAR" "$KLANG_LAUNCHER" "$KLANG_PRESET_INSTALLER" "$KLANG_SERVICE"
chmod 0644 "$AUTOSTART"
desktop-file-validate "$AUTOSTART" "$KLANG_DESKTOP" "$KLANG_AUTOSTART"
for app_id in app.zen_browser.zen io.github.hkdb.Aerion us.zoom.Zoom app.ytmdesktop.ytmdesktop com.github.wwmm.easyeffects io.github.kolunmi.Bazaar; do
  grep -Fq "$app_id" "$INSTALLER" || {
    echo "FATAL: default Flatpak installer missing ${app_id}" >&2
    exit 1
  }
done
echo ":: Default Flatpak application setup ready"
