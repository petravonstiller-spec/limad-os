#!/usr/bin/env python3
"""LiMaD Windows – automatischer Installer für Windows-Programme.

Legt beim ersten Start selbständig eine Wine-Umgebung an, installiert eine
EXE- oder MSI-Datei darin, erkennt anschließend die neu hinzugekommenen
Programme und legt dafür Einträge im GNOME-Menü an.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

from recipe_engine import analyze

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gio, GLib, Gtk  # noqa: E402

APP_ID = "de.limad.WindowsApps"
APP_NAME = "LiMaD Windows"
FALLBACK_ICON = "de.limad.WindowsApps"

HOME = Path(GLib.get_home_dir())
DATA_HOME = Path(os.environ.get("XDG_DATA_HOME", HOME / ".local/share"))
WIN_HOME = DATA_HOME / "limad-windows"
PREFIX = Path(os.environ.get("WINEPREFIX", WIN_HOME / "prefix"))
REGISTRY = WIN_HOME / "apps.json"
ICON_DIR = WIN_HOME / "icons"
DESKTOP_DIR = DATA_HOME / "applications"
LOG_FILE = WIN_HOME / "install.log"

# Installer leftovers that must never end up in the application menu.
SKIP_PATTERNS = re.compile(
    r"(unins|uninstall|setup|installer|updater|update|crashpad|crashreport|"
    r"vcredist|dotnet|repair|helper|service|daemon|report|debug)",
    re.IGNORECASE,
)


def wine_env() -> dict[str, str]:
    env = dict(os.environ)
    env["WINEPREFIX"] = str(PREFIX)
    env.setdefault("WINEARCH", "win64")
    env.setdefault("WINEDEBUG", "-all")
    return env


def have_wine() -> bool:
    return shutil.which("wine") is not None


def prefix_ready() -> bool:
    return (PREFIX / "system.reg").is_file()


def log(message: str) -> None:
    WIN_HOME.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {message}\n")


def run_wine(args: list[str], timeout: int | None = None) -> int:
    log("run: " + " ".join(args))
    try:
        proc = subprocess.run(
            args, env=wine_env(), timeout=timeout,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            errors="replace",
        )
    except subprocess.TimeoutExpired:
        log("timeout")
        return 124
    if proc.stdout:
        log(proc.stdout[-4000:])
    return proc.returncode


def dotnet48_ready() -> bool:
    framework = PREFIX / "drive_c/windows/Microsoft.NET"
    return any((framework / branch / "v4.0.30319/mscorlib.dll").is_file()
               for branch in ("Framework64", "Framework"))


def apply_plan(plan) -> tuple[bool, str]:
    log(
        f"plan recipe={plan.recipe} profile={plan.profile} "
        f"winver={plan.windows_version} arch={plan.architecture} "
        f"deps={','.join(plan.dependencies)} reasons={' | '.join(plan.reasons)}"
    )
    if shutil.which("winetricks") is None:
        return False, "Winetricks fehlt im Systemabbild."

    def set_windows_version() -> tuple[bool, str]:
        code = run_wine(["winetricks", "-q", plan.windows_version], timeout=900)
        if code != 0:
            return False, (
                f"Windows-Kompatibilitätsmodus {plan.windows_version} konnte nicht "
                f"gesetzt werden. Details: {LOG_FILE}"
            )
        return True, ""

    ready, error = set_windows_version()
    if not ready:
        return False, error

    for dependency in plan.dependencies:
        if dependency == "dotnet48" and dotnet48_ready():
            log("dependency dotnet48 already present")
            continue
        code = run_wine(["winetricks", "-q", dependency], timeout=5400)
        if code != 0:
            return False, (
                f"Abhängigkeit {dependency} konnte nicht eingerichtet werden. "
                f"Die Windows-Umgebung kann über den Status-Reiter zurückgesetzt werden. "
                f"Details: {LOG_FILE}"
            )

    ready, error = set_windows_version()
    if not ready:
        return False, error
    if "dotnet48" in plan.dependencies and not dotnet48_ready():
        return False, (
            "Microsoft .NET Framework 4.8 wurde nicht vollständig eingerichtet. "
            f"Details: {LOG_FILE}"
        )
    return True, ""


def wait_for_installer_processes(max_seconds: int = 120) -> None:
    code = run_wine(["wineserver", "-w"], timeout=max_seconds)
    if code == 124:
        log("installer left Wine processes running; continuing after bounded wait")


def program_roots() -> list[Path]:
    """Locations used by system-wide and per-user Windows installers."""
    drive_c = PREFIX / "drive_c"
    roots: list[Path] = []
    for name in ("Program Files", "Program Files (x86)"):
        candidate = drive_c / name
        if candidate.is_dir(): roots.append(candidate)
    users = drive_c / "users"
    if users.is_dir():
        for user in users.iterdir():
            if not user.is_dir(): continue
            for rel in (Path("AppData/Local/Programs"), Path("AppData/Roaming/Microsoft/Windows/Start Menu/Programs"), Path("Desktop")):
                candidate = user / rel
                if candidate.is_dir(): roots.append(candidate)
    return roots


def scan_executables() -> set[Path]:
    """All .exe files in standard and per-user installation locations."""
    found: set[Path] = set()
    for root in program_roots():
        for path in root.rglob("*.exe"):
            if path.is_file(): found.add(path)
    return found


def load_registry() -> list[dict]:
    if not REGISTRY.is_file():
        return []
    try:
        data = json.loads(REGISTRY.read_text(encoding="utf-8"))
        return data.get("applications", [])
    except (json.JSONDecodeError, OSError):
        return []


def save_registry(entries: list[dict]) -> None:
    WIN_HOME.mkdir(parents=True, exist_ok=True)
    REGISTRY.write_text(
        json.dumps({"version": 1, "applications": entries}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "programm"


def extract_icon(exe: Path, slug: str) -> str:
    """Extracts the program icon from the EXE. Falls back to the LiMaD icon."""
    if not (shutil.which("wrestool") and shutil.which("icotool")):
        return FALLBACK_ICON
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    tmp_ico = ICON_DIR / f"{slug}.ico"
    try:
        with tmp_ico.open("wb") as handle:
            extracted = subprocess.run(
                ["wrestool", "-x", "-t", "14", str(exe)],
                stdout=handle, stderr=subprocess.DEVNULL, timeout=30,
            )
        if extracted.returncode != 0 or tmp_ico.stat().st_size == 0:
            raise RuntimeError("no icon resource")
        subprocess.run(
            ["icotool", "-x", "-w", "256", "-o", str(ICON_DIR), str(tmp_ico)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30, check=True,
        )
        candidates = sorted(ICON_DIR.glob(f"{slug}*.png"), key=lambda p: p.stat().st_size)
        if not candidates:
            raise RuntimeError("no png produced")
        final = ICON_DIR / f"{slug}.png"
        candidates[-1].replace(final)
        for leftover in ICON_DIR.glob(f"{slug}*.png"):
            if leftover != final:
                leftover.unlink(missing_ok=True)
        return str(final)
    except Exception as exc:  # noqa: BLE001 - icon extraction is best effort
        log(f"icon extraction failed for {exe}: {exc}")
        return FALLBACK_ICON
    finally:
        tmp_ico.unlink(missing_ok=True)


def write_desktop_entry(name: str, exe: Path, icon: str) -> Path:
    DESKTOP_DIR.mkdir(parents=True, exist_ok=True)
    slug = slugify(name)
    path = DESKTOP_DIR / f"limad-win-{slug}.desktop"
    path.write_text(
        "[Desktop Entry]\n"
        "Type=Application\n"
        f"Name={name}\n"
        "Comment=Windows-Programm in LiMaD OS\n"
        f"Exec=/usr/local/bin/limad-winrun \"{exe}\"\n"
        f"Icon={icon}\n"
        "Terminal=false\n"
        "Categories=Utility;\n"
        "StartupNotify=true\n"
        f"X-LiMaD-Windows-Exe={exe}\n",
        encoding="utf-8",
    )
    path.chmod(0o755)
    subprocess.run(
        ["update-desktop-database", str(DESKTOP_DIR)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
    )
    return path


def nice_name(exe: Path) -> str:
    base = exe.stem.replace("_", " ").replace("-", " ").strip()
    return base[:1].upper() + base[1:] if base else exe.stem


class InstallerWindow(Adw.ApplicationWindow):
    def __init__(self, app: Adw.Application, initial_file: Path | None = None) -> None:
        super().__init__(application=app, title=APP_NAME)
        self.set_default_size(720, 560)
        self.busy = False

        self.toasts = Adw.ToastOverlay()
        self.stack = Adw.ViewStack()

        header = Adw.HeaderBar()
        self.switcher = Adw.ViewSwitcher(stack=self.stack, policy=Adw.ViewSwitcherPolicy.WIDE)
        header.set_title_widget(self.switcher)

        self.install_button = Gtk.Button(label="Windows-Datei wählen")
        self.install_button.add_css_class("suggested-action")
        self.install_button.connect("clicked", self.on_choose_file)
        header.pack_start(self.install_button)

        toolbar = Adw.ToolbarView()
        toolbar.add_top_bar(header)
        toolbar.set_content(self.toasts)
        self.toasts.set_child(self.stack)
        self.set_content(toolbar)

        self.stack.add_titled_with_icon(
            self.build_programs_page(), "programs", "Programme", "view-grid-symbolic")
        self.stack.add_titled_with_icon(
            self.build_status_page(), "status", "Umgebung", "applications-system-symbolic")

        self.refresh()
        if initial_file is not None:
            GLib.idle_add(self.start_install, initial_file)

    # ----------------------------------------------------------------- pages
    def build_programs_page(self) -> Gtk.Widget:
        self.programs_group = Adw.PreferencesGroup(
            title="Installierte Windows-Programme",
            description="Über LiMaD Windows installierte Programme erscheinen auch im GNOME-Menü.",
        )
        self.empty_state = Adw.StatusPage(
            icon_name=FALLBACK_ICON,
            title="Noch keine Windows-Programme",
            description="Wähle oben eine EXE- oder MSI-Datei aus. "
                        "Die Windows-Umgebung wird beim ersten Mal automatisch eingerichtet.",
        )
        page = Adw.PreferencesPage()
        page.add(self.programs_group)
        self.programs_scroller = page

        self.programs_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.programs_box.append(page)

        self.programs_stack = Gtk.Stack()
        self.programs_stack.add_named(self.empty_state, "empty")
        self.programs_stack.add_named(self.programs_box, "list")
        return self.programs_stack

    def build_status_page(self) -> Gtk.Widget:
        self.status_page = Adw.StatusPage(icon_name="applications-system-symbolic")
        self.status_button = Gtk.Button(halign=Gtk.Align.CENTER)
        self.status_button.add_css_class("pill")
        self.status_button.add_css_class("suggested-action")
        self.status_button.connect("clicked", self.on_prepare_environment)
        self.status_page.set_child(self.status_button)
        return self.status_page

    # --------------------------------------------------------------- helpers
    def toast(self, text: str) -> None:
        self.toasts.add_toast(Adw.Toast(title=text, timeout=4))

    def set_busy(self, busy: bool, label: str = "") -> None:
        self.busy = busy
        self.install_button.set_sensitive(not busy)
        self.status_button.set_sensitive(not busy)
        if busy and label:
            self.status_page.set_title(label)
            self.status_page.set_description("Bitte warten – das kann einige Minuten dauern.")
            self.stack.set_visible_child_name("status")
            spinner = Gtk.Spinner(spinning=True, width_request=32, height_request=32,
                                  halign=Gtk.Align.CENTER)
            self.status_page.set_child(spinner)
        elif not busy:
            self.status_page.set_child(self.status_button)
            self.refresh_status()

    def refresh(self) -> None:
        self.refresh_status()
        self.refresh_programs()

    def refresh_status(self) -> None:
        if not have_wine():
            self.status_page.set_icon_name("dialog-warning-symbolic")
            self.status_page.set_title("Wine ist nicht installiert")
            self.status_page.set_description(
                "Dieses Systemabbild wurde ohne Wine gebaut. "
                "Windows-Programme können daher nicht ausgeführt werden.")
            self.status_button.set_visible(False)
            self.install_button.set_sensitive(False)
            return
        self.status_button.set_visible(True)
        if prefix_ready():
            self.status_page.set_icon_name("emblem-ok-symbolic")
            self.status_page.set_title("Windows-Umgebung ist bereit")
            self.status_page.set_description(f"Profil: {PREFIX}")
            self.status_button.set_label("Umgebung zurücksetzen")
            self.status_button.remove_css_class("suggested-action")
            self.status_button.add_css_class("destructive-action")
        else:
            self.status_page.set_icon_name("applications-system-symbolic")
            self.status_page.set_title("Windows-Umgebung einrichten")
            self.status_page.set_description(
                "Beim ersten Programm wird die Umgebung automatisch angelegt. "
                "Du kannst das auch jetzt schon erledigen.")
            self.status_button.set_label("Jetzt einrichten")
            self.status_button.remove_css_class("destructive-action")
            self.status_button.add_css_class("suggested-action")

    def refresh_programs(self) -> None:
        for row in getattr(self, "_rows", []):
            self.programs_group.remove(row)
        self._rows = []
        entries = load_registry()
        if not entries:
            self.programs_stack.set_visible_child_name("empty")
            return
        for entry in entries:
            row = Adw.ActionRow(title=entry["name"], subtitle=entry.get("exe", ""))
            icon = entry.get("icon", FALLBACK_ICON)
            if icon.startswith("/") and Path(icon).is_file():
                image = Gtk.Image.new_from_file(icon)
            else:
                image = Gtk.Image.new_from_icon_name(FALLBACK_ICON)
            image.set_pixel_size(32)
            row.add_prefix(image)

            start = Gtk.Button(icon_name="media-playback-start-symbolic",
                               valign=Gtk.Align.CENTER, tooltip_text="Starten")
            start.add_css_class("flat")
            start.connect("clicked", self.on_start_program, entry)
            row.add_suffix(start)

            remove = Gtk.Button(icon_name="user-trash-symbolic",
                                valign=Gtk.Align.CENTER, tooltip_text="Aus dem Menü entfernen")
            remove.add_css_class("flat")
            remove.connect("clicked", self.on_remove_program, entry)
            row.add_suffix(remove)

            self.programs_group.add(row)
            self._rows.append(row)
        self.programs_stack.set_visible_child_name("list")

    # --------------------------------------------------------------- actions
    def on_start_program(self, _button: Gtk.Button, entry: dict) -> None:
        subprocess.Popen(["/usr/local/bin/limad-winrun", entry["exe"]])
        self.toast(f"{entry['name']} wird gestartet …")

    def on_remove_program(self, _button: Gtk.Button, entry: dict) -> None:
        desktop = entry.get("desktop")
        if desktop:
            Path(desktop).unlink(missing_ok=True)
        save_registry([e for e in load_registry() if e.get("exe") != entry.get("exe")])
        self.refresh_programs()
        self.toast(f"{entry['name']} aus dem Menü entfernt")

    def on_prepare_environment(self, _button: Gtk.Button) -> None:
        if prefix_ready():
            dialog = Adw.MessageDialog(
                transient_for=self, heading="Windows-Umgebung zurücksetzen?",
                body="Alle installierten Windows-Programme und ihre Daten werden gelöscht. "
                     "Die Menüeinträge werden ebenfalls entfernt.")
            dialog.add_response("cancel", "Abbrechen")
            dialog.add_response("reset", "Zurücksetzen")
            dialog.set_response_appearance("reset", Adw.ResponseAppearance.DESTRUCTIVE)
            dialog.connect("response", self.on_reset_response)
            dialog.present()
            return
        self.run_in_thread(self.task_init_prefix, "Windows-Umgebung wird eingerichtet")

    def on_reset_response(self, dialog: Adw.MessageDialog, response: str) -> None:
        dialog.close()
        if response != "reset":
            return
        for entry in load_registry():
            if entry.get("desktop"):
                Path(entry["desktop"]).unlink(missing_ok=True)
        save_registry([])
        self.run_in_thread(self.task_reset_prefix, "Windows-Umgebung wird zurückgesetzt")

    def on_choose_file(self, _button: Gtk.Button) -> None:
        file_filter = Gtk.FileFilter()
        file_filter.set_name("Windows-Programme (EXE, MSI)")
        for pattern in ("*.exe", "*.EXE", "*.msi", "*.MSI"):
            file_filter.add_pattern(pattern)
        filters = Gio.ListStore.new(Gtk.FileFilter)
        filters.append(file_filter)

        dialog = Gtk.FileDialog(title="Windows-Datei auswählen", filters=filters,
                                default_filter=file_filter)
        dialog.open(self, None, self.on_file_chosen)

    def on_file_chosen(self, dialog: Gtk.FileDialog, result: Gio.AsyncResult) -> None:
        try:
            gfile = dialog.open_finish(result)
        except GLib.Error:
            return
        if gfile is None:
            return
        self.start_install(Path(gfile.get_path()))

    def start_install(self, path: Path) -> bool:
        if self.busy:
            return False
        if not path.is_file():
            self.toast(f"Datei nicht gefunden: {path.name}")
            return False
        if path.suffix.lower() not in {".exe", ".msi"}:
            self.toast("Nur EXE- und MSI-Dateien werden unterstützt.")
            return False
        self.pending_file = path
        try:
            self.pending_plan = analyze(path)
        except ValueError as exc:
            self.toast(str(exc))
            return False
        deps = ", ".join(self.pending_plan.dependencies) or "keine zusätzlichen"
        profile_names = {
            "standard": "Standard",
            "dotnet": ".NET-Anwendung",
            "office": "Office",
            "cad": "CAD/3D",
            "creative": "Grafik/Adobe",
            "gaming": "Spiel/Launcher",
            "legacy": "Älteres Programm",
            "minimal": "Minimal",
        }
        profile_name = profile_names.get(self.pending_plan.profile, self.pending_plan.profile)
        architecture = "64-Bit" if self.pending_plan.architecture == "win64" else "32-Bit"
        dialog = Adw.MessageDialog(
            transient_for=self,
            heading="Installationsplan prüfen",
            body=(f"Erkanntes Profil: {profile_name}\n"
                  f"Windows-Modus: {self.pending_plan.windows_version}\n"
                  f"Architektur: {architecture}\n"
                  f"Abhängigkeiten: {deps}\n\n"
                  "LiMaD richtet die Umgebung automatisch ein und startet danach den Installer."))
        dialog.add_response("cancel", "Abbrechen")
        dialog.add_response("install", "Installieren")
        dialog.set_response_appearance("install", Adw.ResponseAppearance.SUGGESTED)
        dialog.set_default_response("install")
        dialog.connect("response", self.on_plan_response)
        dialog.present()
        return False

    def on_plan_response(self, dialog: Adw.MessageDialog, response: str) -> None:
        dialog.close()
        if response == "install":
            self.run_in_thread(self.task_install, f"{self.pending_file.name} wird installiert")

    # --------------------------------------------------------------- threads
    def run_in_thread(self, task, label: str) -> None:
        self.set_busy(True, label)
        thread = threading.Thread(target=self._thread_wrapper, args=(task,), daemon=True)
        thread.start()

    def _thread_wrapper(self, task) -> None:
        try:
            message = task()
        except Exception as exc:  # noqa: BLE001 - surfaced in the interface
            log(f"task failed: {exc}")
            message = f"Fehlgeschlagen: {exc}"
        GLib.idle_add(self._thread_done, message)

    def _thread_done(self, message: str | None) -> bool:
        self.set_busy(False)
        self.refresh()
        if message:
            self.toast(message)
        if getattr(self, "new_programs", None):
            self.present_new_programs()
        return False

    def task_init_prefix(self) -> str:
        WIN_HOME.mkdir(parents=True, exist_ok=True)
        boot_code = run_wine(["wineboot", "--init"], timeout=600)
        wait_code = run_wine(["wineserver", "-w"], timeout=600)
        if boot_code != 0 or wait_code != 0 or not prefix_ready():
            return f"Windows-Umgebung fehlgeschlagen. Details: {LOG_FILE}"
        health = run_wine(["wine", "cmd", "/c", "echo LIMAD_WINE_OK"], timeout=120)
        if health != 0:
            return f"Wine-Starttest fehlgeschlagen. Details: {LOG_FILE}"
        return "Windows-Umgebung ist bereit."

    def task_reset_prefix(self) -> str:
        run_wine(["wineserver", "-k"], timeout=60)
        shutil.rmtree(PREFIX, ignore_errors=True)
        shutil.rmtree(ICON_DIR, ignore_errors=True)
        return "Windows-Umgebung wurde zurückgesetzt."

    def task_install(self) -> str:
        path: Path = self.pending_file
        if not prefix_ready():
            init_message = self.task_init_prefix()
            if not prefix_ready() or init_message != "Windows-Umgebung ist bereit.":
                return init_message
        else:
            health = run_wine(["wine", "cmd", "/c", "echo LIMAD_WINE_OK"], timeout=120)
            if health != 0:
                return f"Wine-Starttest fehlgeschlagen. Details: {LOG_FILE}"

        plan = getattr(self, "pending_plan", analyze(path))
        runtime_ok, runtime_error = apply_plan(plan)
        if not runtime_ok:
            return runtime_error

        before = scan_executables()
        if path.suffix.lower() == ".msi":
            code = run_wine(["wine", "msiexec", "/i", str(path)], timeout=5400)
        else:
            code = run_wine(["wine", str(path)], timeout=5400)
        wait_for_installer_processes()
        after = scan_executables()

        candidates = []
        for exe in sorted(after - before):
            if SKIP_PATTERNS.search(exe.name):
                continue
            candidates.append(exe)

        # A selected EXE may itself be a portable application rather than an
        # installer. Offer it when Wine ran it successfully and no install tree
        # changed, instead of claiming that nothing was found.
        if (not candidates and path.suffix.lower() == ".exe" and code == 0
                and not SKIP_PATTERNS.search(path.name)):
            candidates.append(path)

        known = {entry.get("exe") for entry in load_registry()}
        self.new_programs = [exe for exe in candidates if str(exe) not in known]

        if self.new_programs:
            return ""
        if code == 124:
            return f"Installation wegen Zeitüberschreitung beendet. Details: {LOG_FILE}"
        if code != 0:
            return f"Installation fehlgeschlagen (Wine-Code {code}). Details: {LOG_FILE}"
        return ("Installation beendet, aber kein startbares Programm wurde erkannt. "
                f"Installationsprotokoll: {LOG_FILE}")

    # ------------------------------------------------------- post processing
    def present_new_programs(self) -> None:
        programs = self.new_programs
        self.new_programs = []

        dialog = Adw.MessageDialog(
            transient_for=self,
            heading="Neue Windows-Programme gefunden",
            body="Wähle aus, was im GNOME-Menü erscheinen soll.")
        group = Adw.PreferencesGroup()
        checks: list[tuple[Gtk.CheckButton, Path]] = []
        for exe in programs[:12]:
            row = Adw.ActionRow(title=nice_name(exe), subtitle=str(exe))
            check = Gtk.CheckButton(active=True, valign=Gtk.Align.CENTER)
            row.add_prefix(check)
            row.set_activatable_widget(check)
            group.add(row)
            checks.append((check, exe))
        scroller = Gtk.ScrolledWindow(propagate_natural_height=True, max_content_height=340)
        scroller.set_child(group)
        dialog.set_extra_child(scroller)
        dialog.add_response("skip", "Nicht hinzufügen")
        dialog.add_response("add", "Zum Menü hinzufügen")
        dialog.set_response_appearance("add", Adw.ResponseAppearance.SUGGESTED)
        dialog.set_default_response("add")
        dialog.connect("response", self.on_new_programs_response, checks)
        dialog.present()

    def on_new_programs_response(self, dialog: Adw.MessageDialog, response: str,
                                 checks: list[tuple[Gtk.CheckButton, Path]]) -> None:
        dialog.close()
        if response != "add":
            return
        entries = load_registry()
        added = 0
        for check, exe in checks:
            if not check.get_active():
                continue
            name = nice_name(exe)
            icon = extract_icon(exe, slugify(name))
            desktop = write_desktop_entry(name, exe, icon)
            entries.append({"name": name, "exe": str(exe),
                            "icon": icon, "desktop": str(desktop)})
            added += 1
        save_registry(entries)
        self.refresh_programs()
        self.stack.set_visible_child_name("programs")
        self.toast(f"{added} Programm(e) zum Menü hinzugefügt" if added else "Nichts hinzugefügt")


class InstallerApplication(Adw.Application):
    def __init__(self) -> None:
        super().__init__(application_id=APP_ID,
                         flags=Gio.ApplicationFlags.HANDLES_OPEN)
        self.window: InstallerWindow | None = None

    def do_activate(self) -> None:
        self.ensure_window().present()

    def do_open(self, files, n_files, hint) -> None:  # noqa: ANN001
        target = None
        if n_files:
            path = files[0].get_path()
            if path:
                target = Path(path)
        window = self.ensure_window(target)
        window.present()
        if target is not None and window.window_initialised:
            GLib.idle_add(window.start_install, target)

    def ensure_window(self, initial: Path | None = None) -> InstallerWindow:
        if self.window is None:
            self.window = InstallerWindow(self, initial)
            self.window.window_initialised = True
        return self.window


def main() -> int:
    WIN_HOME.mkdir(parents=True, exist_ok=True)
    return InstallerApplication().run(sys.argv)


if __name__ == "__main__":
    raise SystemExit(main())
