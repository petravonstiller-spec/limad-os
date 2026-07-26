#!/usr/bin/env bash
# Shared Wine environment for LiMaD OS.
set -Eeuo pipefail
LIMAD_WIN_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/limad-windows"
export WINEPREFIX="${WINEPREFIX:-$LIMAD_WIN_HOME/prefix}"
export WINEARCH="${WINEARCH:-win64}"
export WINEDEBUG="${WINEDEBUG:--all}"
limad_win_have_wine() { command -v wine >/dev/null 2>&1; }
limad_win_prefix_ready() { [[ -f "$WINEPREFIX/system.reg" ]]; }
limad_win_health_check() { limad_win_have_wine || return 1; wine cmd /c "echo LIMAD_WINE_OK" 2>&1 | tr -d '\r' | grep -q 'LIMAD_WINE_OK'; }
limad_win_init_prefix() { limad_win_have_wine || return 1; mkdir -p "$LIMAD_WIN_HOME"; if ! limad_win_prefix_ready; then wineboot --init || return 1; wineserver -w || return 1; fi; limad_win_prefix_ready && limad_win_health_check; }
