#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import socket
import subprocess
import threading
import time
from pathlib import Path

import gi

gi.require_version("Gtk", "4.0")
from gi.repository import Gdk, Gio, GLib, Gtk

APP_ID = "de.limad.Klang"
EE_ID = "com.github.wwmm.easyeffects"
PRESET_NAME = "LiMaD Klang"
RUNTIME_DIR = Path(os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}"))
SOCKET_PATH = RUNTIME_DIR / "EasyEffectsServer"
CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "limad"
STATE_FILE = CONFIG_DIR / "klang.json"

BANDS = {
    "bass": (0, 1, 2),
    "mid": (3, 4, 5, 6),
    "treble": (7, 8, 9),
}

PROFILES = {
    "Neutral": {"bass": 0.0, "mid": 0.0, "treble": 0.0},
    "Musik": {"bass": 2.0, "mid": 0.0, "treble": 2.0},
    "Mehr Bass": {"bass": 4.0, "mid": 0.0, "treble": 0.0},
    "Klare Sprache": {"bass": -1.0, "mid": 2.0, "treble": 2.0},
    "Mehr Höhen": {"bass": 0.0, "mid": 0.0, "treble": 4.0},
}


def run_quiet(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)


def flatpak_installed() -> bool:
    return run_quiet(["flatpak", "info", EE_ID]).returncode == 0


def start_easyeffects() -> bool:
    if not flatpak_installed():
        return False
    subprocess.run(["/usr/local/bin/limad-install-klang-preset"], check=False)
    if SOCKET_PATH.exists():
        return True
    subprocess.Popen(
        ["flatpak", "run", EE_ID, "--gapplication-service"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    for _ in range(60):
        if SOCKET_PATH.exists():
            return True
        time.sleep(0.1)
    return SOCKET_PATH.exists()


def send_command(command: str, timeout: float = 1.0) -> str:
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(timeout)
        client.connect(str(SOCKET_PATH))
        client.sendall((command + "\n").encode("utf-8"))
        try:
            data = client.recv(4096)
        except (socket.timeout, ConnectionResetError):
            data = b""
    return data.decode("utf-8", errors="replace").strip()


class KlangWindow(Gtk.ApplicationWindow):
    def __init__(self, app: Gtk.Application) -> None:
        super().__init__(application=app, title="LiMaD Klang")
        self.set_default_size(560, 470)
        self.set_size_request(430, 390)
        self._ready = False
        self._debounce_id = 0
        self._bypassed = False
        self._values = self._load_state()

        css = Gtk.CssProvider()
        css.load_from_data(
            b"""
            window { background: #17131d; color: #f5effa; }
            .title { font-size: 24px; font-weight: 800; }
            .subtitle { color: #b9a9c4; }
            .profile { border-radius: 999px; padding: 8px 14px; }
            .primary { background: #a855f7; color: white; font-weight: 700; }
            .status-ok { color: #7ee787; }
            .status-warn { color: #f2cc60; }
            scale trough { min-height: 8px; border-radius: 999px; }
            scale highlight { background: #b45cff; border-radius: 999px; }
            """
        )
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18)
        root.set_margin_top(22)
        root.set_margin_bottom(22)
        root.set_margin_start(24)
        root.set_margin_end(24)
        self.set_child(root)

        heading = Gtk.Label(label="LiMaD Klang")
        heading.add_css_class("title")
        heading.set_xalign(0)
        root.append(heading)

        subtitle = Gtk.Label(label="Bass, Mitten und Höhen sofort anpassen")
        subtitle.add_css_class("subtitle")
        subtitle.set_xalign(0)
        root.append(subtitle)

        profiles = Gtk.FlowBox()
        profiles.set_selection_mode(Gtk.SelectionMode.NONE)
        profiles.set_max_children_per_line(5)
        profiles.set_row_spacing(8)
        profiles.set_column_spacing(8)
        for name, values in PROFILES.items():
            button = Gtk.Button(label=name)
            button.add_css_class("profile")
            button.connect("clicked", self._on_profile, values)
            profiles.append(button)
        root.append(profiles)

        self.scales: dict[str, Gtk.Scale] = {}
        labels = {
            "bass": ("Bass", "Tiefe Frequenzen"),
            "mid": ("Mitten", "Stimmen und Instrumente"),
            "treble": ("Höhen", "Klarheit und Brillanz"),
        }
        for key in ("bass", "mid", "treble"):
            row = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
            label_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
            label = Gtk.Label(label=labels[key][0])
            label.set_xalign(0)
            label.set_hexpand(True)
            detail = Gtk.Label(label=labels[key][1])
            detail.add_css_class("subtitle")
            value_label = Gtk.Label(label=f"{self._values[key]:+.1f} dB")
            label_row.append(label)
            label_row.append(detail)
            label_row.append(value_label)
            row.append(label_row)

            scale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, -12.0, 12.0, 0.5)
            scale.set_draw_value(False)
            scale.set_hexpand(True)
            scale.set_value(self._values[key])
            scale.connect("value-changed", self._on_scale, key, value_label)
            row.append(scale)
            root.append(row)
            self.scales[key] = scale

        options = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        self.bypass = Gtk.Switch()
        self.bypass.set_active(True)
        self.bypass.connect("notify::active", self._on_effect_switch)
        options.append(self.bypass)
        options.append(Gtk.Label(label="Klangregelung aktiv"))
        options.append(Gtk.Label(label="Automatischer Übersteuerungsschutz", xalign=1))
        root.append(options)

        actions = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        reset = Gtk.Button(label="Zurücksetzen")
        reset.connect("clicked", self._on_profile, PROFILES["Neutral"])
        advanced = Gtk.Button(label="Erweiterte Einstellungen")
        advanced.connect("clicked", self._show_advanced)
        advanced.add_css_class("primary")
        actions.append(reset)
        actions.append(advanced)
        root.append(actions)

        self.status = Gtk.Label(label="EasyEffects wird vorbereitet …")
        self.status.set_xalign(0)
        self.status.add_css_class("subtitle")
        root.append(self.status)

        threading.Thread(target=self._prepare_backend, daemon=True).start()

    def _load_state(self) -> dict[str, float]:
        fallback = dict(PROFILES["Neutral"])
        try:
            raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            for key in fallback:
                value = float(raw.get(key, fallback[key]))
                fallback[key] = max(-12.0, min(12.0, value))
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            pass
        return fallback

    def _save_state(self) -> None:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(self._values, indent=2) + "\n", encoding="utf-8")

    def _prepare_backend(self) -> None:
        ok = start_easyeffects()
        if ok:
            try:
                send_command(f"load_preset:output:{PRESET_NAME}")
                send_command("global_bypass:0")
            except OSError:
                ok = False
        GLib.idle_add(self._backend_ready, ok)

    def _backend_ready(self, ok: bool) -> bool:
        self._ready = ok
        if ok:
            self.status.set_text("Klangregelung aktiv · Änderungen wirken sofort")
            self.status.remove_css_class("status-warn")
            self.status.add_css_class("status-ok")
            self._apply_values()
        else:
            self.status.set_text("EasyEffects ist noch nicht installiert oder konnte nicht gestartet werden.")
            self.status.add_css_class("status-warn")
        return GLib.SOURCE_REMOVE

    def _on_profile(self, _button: Gtk.Button, values: dict[str, float]) -> None:
        for key, value in values.items():
            self.scales[key].set_value(value)

    def _on_scale(self, scale: Gtk.Scale, key: str, value_label: Gtk.Label) -> None:
        value = round(scale.get_value() * 2.0) / 2.0
        self._values[key] = value
        value_label.set_text(f"{value:+.1f} dB")
        self._save_state()
        if self._debounce_id:
            GLib.source_remove(self._debounce_id)
        self._debounce_id = GLib.timeout_add(120, self._apply_values)

    def _apply_values(self) -> bool:
        self._debounce_id = 0
        if not self._ready or self._bypassed:
            return GLib.SOURCE_REMOVE
        try:
            for section, bands in BANDS.items():
                value = self._values[section]
                for channel in ("left", "right"):
                    for band in bands:
                        send_command(
                            f"set_property:output:equalizer:0:{channel}:band{band}Gain:{value:.1f}"
                        )
            headroom = -0.75 * max(0.0, *self._values.values())
            send_command(f"set_property:output:equalizer:0:outputGain:{headroom:.2f}")
            self.status.set_text("Gespeichert · Änderungen wirken sofort")
        except OSError:
            self._ready = False
            self.status.set_text("Verbindung zu EasyEffects verloren · wird neu gestartet …")
            threading.Thread(target=self._prepare_backend, daemon=True).start()
        return GLib.SOURCE_REMOVE

    def _on_effect_switch(self, switch: Gtk.Switch, _param: object) -> None:
        self._bypassed = not switch.get_active()
        if not self._ready:
            return
        try:
            send_command(f"global_bypass:{1 if self._bypassed else 0}")
            if not self._bypassed:
                self._apply_values()
        except OSError:
            self._ready = False

    def _show_advanced(self, _button: Gtk.Button) -> None:
        if self._ready:
            try:
                send_command("show_window")
                return
            except OSError:
                pass
        subprocess.Popen(["flatpak", "run", EE_ID], start_new_session=True)


class KlangApp(Gtk.Application):
    def __init__(self) -> None:
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.DEFAULT_FLAGS)

    def do_activate(self) -> None:
        win = self.props.active_window
        if win is None:
            win = KlangWindow(self)
        win.present()


if __name__ == "__main__":
    raise SystemExit(KlangApp().run())
