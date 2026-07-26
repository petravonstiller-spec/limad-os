#!/usr/bin/env bash
set -Eeuo pipefail

source /ctx/build_files/versions.env

THEME_DIR="/usr/share/plymouth/themes/limad"

echo ":: Activating LiMaD boot splash"
for file in limad.plymouth limad.script boot-splash.png spinner-{00..11}.png; do
  [[ -s "${THEME_DIR}/${file}" ]] || { echo "FATAL: Plymouth file missing: ${file}" >&2; exit 1; }
done
command -v plymouth-set-default-theme >/dev/null 2>&1 || { echo "FATAL: plymouth-set-default-theme missing" >&2; exit 1; }
plymouth-set-default-theme limad
mkdir -p /etc/plymouth /etc/dracut.conf.d /usr/share/plymouth/themes
ln -sfn limad/limad.plymouth /usr/share/plymouth/themes/default.plymouth
if [[ -d /etc/alternatives ]]; then
  ln -sfn /usr/share/plymouth/themes/limad/limad.plymouth /etc/alternatives/default.plymouth
fi
[[ -f /etc/plymouth/plymouthd.conf ]] || { echo "FATAL: Plymouth configuration missing" >&2; exit 1; }
grep -q '^Theme=limad$' /etc/plymouth/plymouthd.conf || { echo "FATAL: LiMaD Plymouth theme not selected" >&2; exit 1; }
[[ "$(readlink -f /usr/share/plymouth/themes/default.plymouth)" == "${THEME_DIR}/limad.plymouth" ]] || { echo "FATAL: default.plymouth does not resolve to LiMaD" >&2; exit 1; }

echo ":: LiMaD boot splash active"

# IMPORTANT (bootc/OSTree): Do not run dracut --force here.
# The Bazzite base image owns kernel/initramfs generation. Rebuilding the
# pre-generated initramfs during this late customization layer can omit
# bootc/OSTree root modules and make the installed system enter dracut
# emergency mode. The theme files and dracut configuration remain installed
# for the platform-managed initramfs lifecycle.
echo ":: LiMaD Plymouth files installed; initramfs remains managed by bootc/Bazzite"
