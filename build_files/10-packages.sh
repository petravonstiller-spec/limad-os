#!/usr/bin/env bash
# Packages required to build and run the LiMaD look on GNOME.
set -Eeuo pipefail

# Sourced for standalone use by the theme probe workflow.
# shellcheck source=/dev/null
source /ctx/build_files/versions.env

echo ":: Installing build and runtime packages"

# Build dependencies for the vinceliuice installers (SCSS -> CSS, gresource).
BUILD_PACKAGES=(
  git
  sassc
  glib2-devel
  libxml2
  ImageMagick
  distribution-gpg-keys
  python3-devel
  libnl3-devel
  libev-devel
  libpcap-devel
  gcc-c++
  gcc
  make
  cmake
)

# Runtime pieces of the macOS-like GNOME experience.
RUNTIME_PACKAGES=(
  gnome-tweaks
  gnome-shell-extension-user-theme
  gnome-shell-extension-dash-to-dock
  gnome-shell-extension-blur-my-shell
  plymouth
  plymouth-plugin-script
  gnome-themes-extra
  gtk-murrine-engine
)

# Runtime of the natively shipped LiMaD applications (GTK4 + WebKit via
# PyGObject) and of LiDrop's network discovery.
APP_PACKAGES=(
  python3-gobject
  gtk4
  webkitgtk6.0
  avahi
  nss-mdns
  qrencode
  desktop-file-utils
  shared-mime-info
  file
  libnotify
  polkit
  libarchive
  bluez
  iw
  python3-virtualenv
  python3-pip
)

dnf5 -y install "${BUILD_PACKAGES[@]}" || dnf -y install "${BUILD_PACKAGES[@]}"

# Runtime packages are installed one by one: a single renamed package in a
# future Fedora release must not break the whole image build.
for pkg in "${RUNTIME_PACKAGES[@]}" "${APP_PACKAGES[@]}"; do
  if rpm -q "$pkg" >/dev/null 2>&1; then
    echo "   already present: $pkg"
    continue
  fi
  if dnf5 -y install "$pkg" 2>/dev/null || dnf -y install "$pkg" 2>/dev/null; then
    echo "   installed: $pkg"
  else
    echo "   WARNING: package not available, skipped: $pkg" >&2
  fi
done

echo ":: Package step done"
