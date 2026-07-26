#!/usr/bin/python3
from __future__ import annotations
import argparse
import hashlib
import hmac
import base64
import json
import mimetypes
import os
import secrets
import shutil
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VERSION = "0.11.0-preview4"
PORT = 47777
PAIR_TTL = 300
PAIR_ATTEMPT_LIMIT = 8
CHUNK_LIMIT = 16 * 1024 * 1024
DEFAULT_MAX_SIZE = 20 * 1024 * 1024 * 1024
WEB_ROOT = Path(__file__).resolve().parent / "web"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def json_bytes(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def safe_name(value: str) -> str:
    name = Path(value.replace("\\", "/")).name.replace("\x00", "").strip()
    name = "".join(ch for ch in name if ch >= " " and ch not in '<>:"/\\|?*')
    if name in {"", ".", ".."}:
        name = "Datei"
    stem = name[:220]
    return stem


def unique_path(folder: Path, name: str) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    candidate = folder / name
    if not candidate.exists():
        return candidate
    p = Path(name)
    for index in range(1, 10000):
        candidate = folder / f"{p.stem} ({index}){p.suffix}"
        if not candidate.exists():
            return candidate
    raise RuntimeError("Kein freier Dateiname gefunden")


def local_ip() -> str:
    # Prefer the active kernel route. This works even when the internet itself is
    # unavailable because no packet has to be sent successfully.
    try:
        result = subprocess.run(
            ["ip", "-4", "route", "get", "1.1.1.1"],
            capture_output=True, text=True, timeout=2, check=False,
        )
        parts = result.stdout.split()
        if "src" in parts:
            address = parts[parts.index("src") + 1]
            if address and not address.startswith("127."):
                return address
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        pass

    # Fall back to all globally usable interface addresses.
    try:
        result = subprocess.run(
            ["ip", "-o", "-4", "addr", "show", "scope", "global"],
            capture_output=True, text=True, timeout=2, check=False,
        )
        for line in result.stdout.splitlines():
            fields = line.split()
            if "inet" in fields:
                address = fields[fields.index("inet") + 1].split("/", 1)[0]
                if address and not address.startswith("127."):
                    return address
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        pass

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("1.1.1.1", 80))
        address = sock.getsockname()[0]
        if address and not address.startswith("127."):
            return address
    except OSError:
        pass
    finally:
        sock.close()

    try:
        for address in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not address.startswith("127."):
                return address
    except OSError:
        pass
    return "127.0.0.1"


class Store:
    def __init__(self):
        home = Path.home()
        self.config_dir = Path(os.environ.get("XDG_CONFIG_HOME", home / ".config")) / "limad-drop"
        self.data_dir = Path(os.environ.get("XDG_DATA_HOME", home / ".local/share")) / "limad-drop"
        self.cache_dir = Path(os.environ.get("XDG_CACHE_HOME", home / ".cache")) / "limad-drop"
        self.state_dir = Path(os.environ.get("XDG_STATE_HOME", home / ".local/state")) / "limad-drop"
        self.destination = home / "LiDrop"
        self.incoming = self.cache_dir / "incoming"
        self.outgoing = self.data_dir / "outbox"
        for folder in (self.config_dir, self.data_dir, self.cache_dir, self.state_dir, self.destination, self.incoming, self.outgoing):
            folder.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "devices.db"
        self.admin_token = secrets.token_urlsafe(32)
        self.pair_lock = threading.Lock()
        self.pair_token = ""
        self.pair_code = ""
        self.pair_expires = 0.0
        self.pair_attempts = {}
        self._airdrop_probe_cache = None
        self._airdrop_probe_at = 0.0
        self._init_db()
        self.rotate_pairing()

    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=30000")
        return db

    def _init_db(self):
        with self.connect() as db:
            db.executescript("""
            CREATE TABLE IF NOT EXISTS devices(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                secret_hash TEXT NOT NULL,
                trusted INTEGER NOT NULL DEFAULT 0,
                auto_accept INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                last_seen TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS transfers(
                id TEXT PRIMARY KEY,
                direction TEXT NOT NULL,
                device_id TEXT,
                device_name TEXT,
                filename TEXT NOT NULL,
                size INTEGER NOT NULL,
                received INTEGER NOT NULL DEFAULT 0,
                sha256 TEXT,
                temp_path TEXT,
                final_path TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_modified INTEGER NOT NULL DEFAULT 0,
                error TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_transfer_device ON transfers(device_id,status,updated_at);
            """)

    def airdrop_config_path(self):
        return self.config_dir / "airdrop.json"

    def airdrop_state_path(self):
        runtime = Path(os.environ.get("XDG_RUNTIME_DIR", self.cache_dir))
        return runtime / "limad-airdrop-state.json"

    @staticmethod
    def _probe_command(args, timeout=3):
        try:
            result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
            return result.stdout if result.returncode == 0 else ""
        except (OSError, subprocess.SubprocessError):
            return ""

    def local_airdrop_probe(self):
        if self._airdrop_probe_cache is not None and time.monotonic() - self._airdrop_probe_at < 30:
            return dict(self._airdrop_probe_cache)
        # Use the OS-level probe first. It applies the safety rule that OWL may
        # never take over the interface carrying the user's normal WLAN link.
        system_probe = Path("/usr/local/bin/limad-airdrop-check")
        if system_probe.exists() and os.access(system_probe, os.X_OK):
            try:
                checked = subprocess.run([str(system_probe)], capture_output=True, text=True, timeout=10, check=False)
                if checked.returncode == 0:
                    result = json.loads(checked.stdout)
                    if isinstance(result, dict):
                        self._airdrop_probe_cache = dict(result)
                        self._airdrop_probe_at = time.monotonic()
                        return result
            except (OSError, subprocess.SubprocessError, ValueError, json.JSONDecodeError):
                pass
        iw_path = shutil.which("iw")
        iw_dev = self._probe_command([iw_path, "dev"]) if iw_path else ""
        iw_list = self._probe_command([iw_path, "list"], timeout=5) if iw_path else ""
        wifi = bool(iw_dev and "Interface" in iw_dev)
        monitor = bool(iw_list and "monitor" in iw_list.lower())
        interface = ""
        for line in iw_dev.splitlines():
            line = line.strip()
            if line.startswith("Interface "):
                interface = line.split(None, 1)[1].strip()
                break

        bluetooth = bool(Path("/sys/class/bluetooth").exists() or shutil.which("bluetoothctl"))
        backend_candidates = [
            Path("/usr/libexec/limad-airdrop/backend/opendrop"),
            Path("/usr/local/libexec/limad-airdrop/opendrop"),
            Path(__file__).resolve().parent / "airdrop" / "opendrop",
        ]
        backend_path = next((str(item) for item in backend_candidates if item.exists() and os.access(item, os.X_OK)), "")
        owl_path = shutil.which("owl") or ""
        if not owl_path:
            for item in [Path("/usr/libexec/limad-airdrop/backend/owl"), Path(__file__).resolve().parent / "airdrop" / "owl"]:
                if item.exists() and os.access(item, os.X_OK):
                    owl_path = str(item)
                    break

        adapter = ""
        driver = ""
        lspci = shutil.which("lspci")
        if lspci:
            pci = self._probe_command([lspci, "-nnk"])
            lines = pci.splitlines()
            for index, line in enumerate(lines):
                if "Network controller" in line or "Wireless controller" in line:
                    adapter = line.strip()
                    for detail in lines[index + 1:index + 5]:
                        stripped = detail.strip()
                        if stripped.startswith("Kernel driver in use:"):
                            driver = stripped.split(":", 1)[1].strip()
                            break
                    break

        available = bool(wifi and monitor and bluetooth and owl_path and backend_path)
        missing = []
        if not wifi: missing.append("WLAN-Schnittstelle")
        if not monitor: missing.append("aktiver Monitor-Modus")
        if not bluetooth: missing.append("Bluetooth")
        if not owl_path: missing.append("AWDL/OWL")
        if not backend_path: missing.append("OpenDrop-Backend")
        message = "AirDrop-Kompatibilität ist technisch bereit." if available else "Es fehlt: " + ", ".join(missing)
        result = {
            "available": available,
            "backend": "ready" if backend_path else "missing",
            "backendName": "OpenDrop" if backend_path else "",
            "backendPath": backend_path,
            "wifi": wifi,
            "monitor": monitor,
            "bluetooth": bluetooth,
            "awdl": bool(owl_path),
            "owlPath": owl_path,
            "interface": interface,
            "adapter": adapter,
            "driver": driver,
            "message": message,
            "checkedAt": now(),
        }
        self._airdrop_probe_cache = dict(result)
        self._airdrop_probe_at = time.monotonic()
        return result

    def airdrop_state(self):
        config = {"enabled": False, "visibility": "off"}
        try:
            config.update(json.loads(self.airdrop_config_path().read_text(encoding="utf-8")))
        except (OSError, ValueError, json.JSONDecodeError):
            pass
        state = {
            "available": False, "backend": "missing", "backendName": "",
            "wifi": False, "monitor": False, "bluetooth": False, "awdl": False,
            "message": "AirDrop-Backend oder kompatible AWDL-Hardware wurde nicht erkannt.",
            "checkedAt": now(), "devices": []
        }
        try:
            loaded = json.loads(self.airdrop_state_path().read_text(encoding="utf-8"))
            if isinstance(loaded, dict): state.update(loaded)
        except (OSError, ValueError, json.JSONDecodeError):
            pass
        # Probe from the running LiDrop process as well. This makes the status
        # useful even when the optional system timer has not run yet.
        state.update(self.local_airdrop_probe())
        state.update(config)
        state["preview"] = True
        if not state.get("available"):
            state["enabled"] = False
            state["visibility"] = "off"
        return state

    def update_airdrop(self, payload):
        self._airdrop_probe_cache = None
        self._airdrop_probe_at = 0.0
        enabled = bool(payload.get("enabled", False))
        visibility = str(payload.get("visibility", "off"))
        if visibility not in {"off", "everyone10"}:
            raise ValueError("Nur 'Für alle · 10 Minuten' wird unterstützt. Der Kontakte-Modus benötigt Apple-Anmeldedaten und ist nicht verfügbar.")
        if enabled and visibility == "off":
            visibility = "everyone10"
        if not enabled:
            visibility = "off"
        data = {"enabled": enabled, "visibility": visibility, "updatedAt": now()}
        self.airdrop_config_path().write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        command = ["/usr/local/bin/limad-airdrop-session", "start" if enabled else "stop"]
        try:
            result = subprocess.run(command, timeout=120, check=False, capture_output=True, text=True)
        except (OSError, subprocess.SubprocessError) as exc:
            raise ValueError(f"AirDrop-Kompatibilitätsdienst konnte nicht geschaltet werden: {exc}") from exc
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "Unbekannter Fehler").strip()
            # Never leave a configuration that claims AirDrop is active after a failed start.
            if enabled:
                data.update({"enabled": False, "visibility": "off", "error": detail, "updatedAt": now()})
                self.airdrop_config_path().write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            raise ValueError(detail)
        self._airdrop_probe_cache = None
        self._airdrop_probe_at = 0.0
        return self.airdrop_state()

    def rotate_pairing(self):
        with self.pair_lock:
            self.pair_token = secrets.token_urlsafe(24)
            self.pair_code = f"{secrets.randbelow(1000000):06d}"
            self.pair_expires = time.time() + PAIR_TTL

    def pairing(self):
        with self.pair_lock:
            if time.time() >= self.pair_expires:
                self.pair_token = secrets.token_urlsafe(24)
                self.pair_code = f"{secrets.randbelow(1000000):06d}"
                self.pair_expires = time.time() + PAIR_TTL
            ip = local_ip()
            return {
                "token": self.pair_token,
                "code": self.pair_code,
                "expiresIn": max(0, int(self.pair_expires - time.time())),
                "url": f"http://{ip}:{PORT}/?pair={urllib.parse.quote(self.pair_token)}",
                "address": f"http://{ip}:{PORT}/"
            }

    def consume_pair(self, token: str, code: str, name: str, remote: str):
        current = self.pairing()
        with self.pair_lock:
            attempts, window = self.pair_attempts.get(remote, (0, time.time()))
            if time.time() - window > PAIR_TTL:
                attempts, window = 0, time.time()
            if attempts >= PAIR_ATTEMPT_LIMIT:
                raise ValueError("Zu viele Kopplungsversuche. Bitte später erneut versuchen")
        valid_token = token and secrets.compare_digest(token, current["token"])
        valid_code = code and secrets.compare_digest("".join(ch for ch in code if ch.isdigit()), current["code"])
        if not (valid_token or valid_code):
            with self.pair_lock:
                self.pair_attempts[remote] = (attempts + 1, window)
            raise ValueError("Kopplungscode ist ungültig oder abgelaufen")
        with self.pair_lock:
            self.pair_attempts.pop(remote, None)
        device_id = secrets.token_hex(12)
        secret = secrets.token_urlsafe(32)
        stamp = now()
        with self.connect() as db:
            db.execute("INSERT INTO devices(id,name,secret_hash,trusted,auto_accept,created_at,last_seen) VALUES(?,?,?,?,?,?,?)",
                       (device_id, safe_name(name or "Smartphone"), hashlib.sha256(secret.encode()).hexdigest(), 0, 0, stamp, stamp))
        self.rotate_pairing()
        return {"deviceId": device_id, "deviceToken": f"{device_id}.{secret}", "name": safe_name(name or "Smartphone")}

    def authenticate(self, header: str | None):
        if not header or not header.startswith("Bearer "):
            return None
        value = header[7:].strip()
        if "." not in value:
            return None
        device_id, secret = value.split(".", 1)
        with self.connect() as db:
            row = db.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
            if not row:
                return None
            digest = hashlib.sha256(secret.encode()).hexdigest()
            if not secrets.compare_digest(digest, row["secret_hash"]):
                return None
            db.execute("UPDATE devices SET last_seen=? WHERE id=?", (now(), device_id))
            return dict(row)

    def is_admin(self, token: str | None) -> bool:
        return bool(token and secrets.compare_digest(token, self.admin_token))

    def list_devices(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT id,name,trusted,auto_accept,created_at,last_seen FROM devices ORDER BY last_seen DESC")]

    def public_device(self, row):
        return {key: row[key] for key in ("id", "name", "trusted", "auto_accept", "created_at", "last_seen") if key in row}

    def init_transfer(self, direction: str, device, payload: dict):
        name = safe_name(str(payload.get("name", "Datei")))
        size = int(payload.get("size", 0))
        last_modified = int(payload.get("lastModified", 0) or 0)
        if size < 0 or size > DEFAULT_MAX_SIZE:
            raise ValueError("Dateigröße ist nicht erlaubt")
        device_id = device.get("id") if device else str(payload.get("deviceId", ""))
        device_name = device.get("name") if device else ""
        if direction == "outbound":
            if device_id:
                with self.connect() as db:
                    target = db.execute("SELECT id,name FROM devices WHERE id=?", (device_id,)).fetchone()
                if not target:
                    raise ValueError("Zielgerät wurde nicht gefunden")
                device_name = target["name"]
        with self.connect() as db:
            existing = db.execute("SELECT * FROM transfers WHERE direction=? AND COALESCE(device_id,'')=? AND filename=? AND size=? AND last_modified=? AND status='uploading' ORDER BY created_at DESC LIMIT 1",
                                  (direction, device_id or "", name, size, last_modified)).fetchone()
            if existing and existing["temp_path"] and Path(existing["temp_path"]).exists():
                actual = Path(existing["temp_path"]).stat().st_size
                db.execute("UPDATE transfers SET received=?,updated_at=? WHERE id=?", (actual, now(), existing["id"]))
                return {"id": existing["id"], "received": actual, "size": size}
            transfer_id = secrets.token_hex(16)
            temp = self.incoming / f"{transfer_id}.partial"
            temp.touch(mode=0o600, exist_ok=False)
            stamp = now()
            db.execute("INSERT INTO transfers(id,direction,device_id,device_name,filename,size,received,temp_path,status,created_at,updated_at,last_modified) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                       (transfer_id, direction, device_id or None, device_name or None, name, size, 0, str(temp), "uploading", stamp, stamp, last_modified))
            return {"id": transfer_id, "received": 0, "size": size}

    def transfer(self, transfer_id: str):
        with self.connect() as db:
            row = db.execute("SELECT * FROM transfers WHERE id=?", (transfer_id,)).fetchone()
            return dict(row) if row else None

    def append_chunk(self, transfer_id: str, offset: int, reader, length: int):
        if length < 0 or length > CHUNK_LIMIT:
            raise ValueError("Ungültige Blockgröße")
        row = self.transfer(transfer_id)
        if not row or row["status"] != "uploading":
            raise ValueError("Übertragung ist nicht aktiv")
        path = Path(row["temp_path"])
        current = path.stat().st_size if path.exists() else 0
        if offset != current:
            return {"id": transfer_id, "received": current, "size": row["size"], "conflict": True}
        if current + length > row["size"]:
            raise ValueError("Block überschreitet die Dateigröße")
        remaining = length
        with path.open("ab", buffering=0) as handle:
            while remaining:
                chunk = reader.read(min(1024 * 1024, remaining))
                if not chunk:
                    raise ValueError("Verbindung wurde vorzeitig beendet")
                handle.write(chunk)
                remaining -= len(chunk)
        received = current + length
        with self.connect() as db:
            db.execute("UPDATE transfers SET received=?,updated_at=? WHERE id=?", (received, now(), transfer_id))
        return {"id": transfer_id, "received": received, "size": row["size"]}

    def complete_transfer(self, transfer_id: str):
        row = self.transfer(transfer_id)
        if not row or row["status"] != "uploading":
            raise ValueError("Übertragung ist nicht aktiv")
        path = Path(row["temp_path"])
        if not path.exists() or path.stat().st_size != row["size"]:
            raise ValueError("Datei ist noch nicht vollständig")
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(4 * 1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
        sha = digest.hexdigest()
        status = "pending"
        final_path = None
        if row["direction"] == "inbound":
            with self.connect() as db:
                device = db.execute("SELECT trusted,auto_accept FROM devices WHERE id=?", (row["device_id"],)).fetchone()
            if device and device["trusted"] and device["auto_accept"]:
                target = unique_path(self.destination, row["filename"])
                os.replace(path, target)
                final_path = str(target)
                status = "accepted"
        else:
            target = unique_path(self.outgoing, f"{transfer_id}-{row['filename']}")
            os.replace(path, target)
            final_path = str(target)
            status = "ready" if row["device_id"] else "draft"
        retained_temp = str(path) if row["direction"] == "inbound" and status == "pending" else None
        with self.connect() as db:
            db.execute("UPDATE transfers SET sha256=?,final_path=?,temp_path=?,status=?,received=size,updated_at=? WHERE id=?",
                       (sha, final_path, retained_temp, status, now(), transfer_id))
        if row["direction"] == "inbound":
            if status == "accepted":
                notify("LiDrop", f"{row['filename']} wurde automatisch angenommen")
            else:
                notify("LiDrop", f"{row['device_name'] or 'Ein Gerät'} möchte {row['filename']} senden")
        return self.transfer(transfer_id)

    def accept(self, transfer_id: str):
        row = self.transfer(transfer_id)
        if not row or row["direction"] != "inbound" or row["status"] != "pending":
            raise ValueError("Datei kann nicht angenommen werden")
        source = Path(row["temp_path"])
        target = unique_path(self.destination, row["filename"])
        os.replace(source, target)
        with self.connect() as db:
            db.execute("UPDATE transfers SET temp_path=NULL,final_path=?,status='accepted',updated_at=? WHERE id=?", (str(target), now(), transfer_id))
        return self.transfer(transfer_id)

    def reject(self, transfer_id: str):
        row = self.transfer(transfer_id)
        if not row or row["direction"] != "inbound" or row["status"] not in {"pending", "uploading"}:
            raise ValueError("Datei kann nicht abgelehnt werden")
        for key in ("temp_path", "final_path"):
            if row.get(key):
                try: Path(row[key]).unlink()
                except OSError: pass
        with self.connect() as db:
            db.execute("UPDATE transfers SET temp_path=NULL,final_path=NULL,status='rejected',updated_at=? WHERE id=?", (now(), transfer_id))
        return self.transfer(transfer_id)

    def update_device(self, device_id: str, payload: dict):
        with self.connect() as db:
            row = db.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
            if not row:
                raise ValueError("Gerät wurde nicht gefunden")
            name = safe_name(str(payload.get("name", row["name"])))
            trusted = 1 if payload.get("trusted", bool(row["trusted"])) else 0
            auto_accept = 1 if trusted and payload.get("autoAccept", bool(row["auto_accept"])) else 0
            db.execute("UPDATE devices SET name=?,trusted=?,auto_accept=? WHERE id=?", (name, trusted, auto_accept, device_id))
        return next(x for x in self.list_devices() if x["id"] == device_id)

    def delete_device(self, device_id: str):
        with self.connect() as db:
            db.execute("DELETE FROM devices WHERE id=?", (device_id,))
            db.execute("UPDATE transfers SET status='revoked',updated_at=? WHERE device_id=? AND status IN ('ready','draft','uploading')", (now(), device_id))

    def delete_devices(self, scope: str = "offline"):
        rows = self.list_devices()
        selected = []
        cutoff = time.time() - 90
        for row in rows:
            try:
                seen = datetime.fromisoformat(str(row.get("last_seen", "")).replace("Z", "+00:00")).timestamp()
            except (ValueError, TypeError):
                seen = 0
            if scope == "all" or (scope == "offline" and seen < cutoff):
                selected.append(row["id"])
        for device_id in selected:
            self.delete_device(device_id)
        return len(selected)

    def _safe_transfer_path(self, value: str | None) -> Path | None:
        if not value:
            return None
        try:
            path = Path(value).expanduser().resolve()
        except OSError:
            return None
        allowed = [self.cache_dir.resolve(), self.data_dir.resolve(), self.destination.resolve()]
        if any(path == base or base in path.parents for base in allowed):
            return path
        return None

    def delete_transfer(self, transfer_id: str, delete_file: bool = False):
        row = self.transfer(transfer_id)
        if not row:
            return False
        # Teil- und Outbox-Dateien werden beim Entfernen immer bereinigt. Bereits
        # angenommene Dateien im LiDrop-Ordner nur nach ausdrücklicher Bestätigung.
        candidates = []
        temp = self._safe_transfer_path(row.get("temp_path"))
        final = self._safe_transfer_path(row.get("final_path"))
        if temp:
            candidates.append(temp)
        if final and (delete_file or self.outgoing.resolve() in final.parents or self.cache_dir.resolve() in final.parents):
            candidates.append(final)
        for path in candidates:
            try:
                if path.is_file():
                    path.unlink()
            except OSError:
                pass
        with self.connect() as db:
            db.execute("DELETE FROM transfers WHERE id=?", (transfer_id,))
        return True

    def delete_transfers(self, scope: str = "finished", delete_files: bool = False):
        terminal = {"accepted", "downloaded", "rejected", "revoked", "error", "cancelled"}
        failed = {"rejected", "revoked", "error", "cancelled"}
        with self.connect() as db:
            rows = [dict(row) for row in db.execute("SELECT * FROM transfers ORDER BY updated_at DESC")]
        selected = []
        for row in rows:
            status = row.get("status")
            if scope == "all" or (scope == "finished" and status in terminal) or (scope == "failed" and status in failed):
                selected.append(row["id"])
        for transfer_id in selected:
            self.delete_transfer(transfer_id, delete_files)
        return len(selected)

    def set_outbound_target(self, transfer_id: str, device_id: str):
        with self.connect() as db:
            target = db.execute("SELECT id,name FROM devices WHERE id=?", (device_id,)).fetchone()
            row = db.execute("SELECT * FROM transfers WHERE id=? AND direction='outbound'", (transfer_id,)).fetchone()
            if not target or not row:
                raise ValueError("Datei oder Zielgerät wurde nicht gefunden")
            if row["status"] not in {"draft", "ready"}:
                raise ValueError("Ziel kann nicht mehr geändert werden")
            db.execute("UPDATE transfers SET device_id=?,device_name=?,status='ready',updated_at=? WHERE id=?", (target["id"], target["name"], now(), transfer_id))
        return self.transfer(transfer_id)

    def stage_paths(self, paths):
        results = []
        stamp = now()
        with self.connect() as db:
            for value in paths:
                path = Path(value).expanduser().resolve()
                if not path.is_file() or not os.access(path, os.R_OK):
                    continue
                transfer_id = secrets.token_hex(16)
                db.execute("INSERT INTO transfers(id,direction,filename,size,received,sha256,final_path,status,created_at,updated_at,last_modified) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                           (transfer_id, "outbound", safe_name(path.name), path.stat().st_size, path.stat().st_size, None, str(path), "draft", stamp, stamp, int(path.stat().st_mtime * 1000)))
                results.append(transfer_id)
        return results

    def admin_state(self):
        with self.connect() as db:
            transfers = [dict(row) for row in db.execute("SELECT * FROM transfers ORDER BY updated_at DESC LIMIT 200")]
        for item in transfers:
            item.pop("temp_path", None)
        return {
            "version": VERSION,
            "hostname": socket.gethostname(),
            "destination": str(self.destination),
            "pairing": self.pairing(),
            "devices": self.list_devices(),
            "transfers": transfers
        }

    def download_ticket(self, device_id: str, transfer_id: str, lifetime: int = 600):
        expires = int(time.time()) + lifetime
        message = f"{device_id}:{transfer_id}:{expires}".encode()
        signature = hmac.new(self.admin_token.encode(), message, hashlib.sha256).digest()
        encoded = base64.urlsafe_b64encode(signature).decode().rstrip("=")
        return f"{expires}.{encoded}"

    def validate_download_ticket(self, device_id: str, transfer_id: str, ticket: str) -> bool:
        try:
            expires_text, signature = ticket.split(".", 1)
            expires = int(expires_text)
        except (ValueError, AttributeError):
            return False
        if expires < int(time.time()):
            return False
        message = f"{device_id}:{transfer_id}:{expires}".encode()
        expected_raw = hmac.new(self.admin_token.encode(), message, hashlib.sha256).digest()
        expected = base64.urlsafe_b64encode(expected_raw).decode().rstrip("=")
        return secrets.compare_digest(signature, expected)

    def mobile_state(self, device):
        with self.connect() as db:
            outbound = [dict(row) for row in db.execute("SELECT id,filename,size,received,sha256,status,created_at,updated_at FROM transfers WHERE direction='outbound' AND device_id=? AND status IN ('ready','downloaded') ORDER BY updated_at DESC LIMIT 100", (device["id"],))]
            inbound = [dict(row) for row in db.execute("SELECT id,filename,size,received,status,created_at,updated_at FROM transfers WHERE direction='inbound' AND device_id=? ORDER BY updated_at DESC LIMIT 50", (device["id"],))]
        for item in outbound:
            ticket = self.download_ticket(device["id"], item["id"])
            item["downloadUrl"] = f"/api/download/{item['id']}?ticket={urllib.parse.quote(ticket)}"
        return {"version": VERSION, "device": self.public_device(device), "outbound": outbound, "inbound": inbound}


STORE = Store()


def notify(title: str, body: str):
    if os.environ.get("LIMAD_DROP_DISABLE_NOTIFICATIONS") == "1":
        return
    try:
        subprocess.Popen(["notify-send", "--app-name=LiDrop", "--icon=limad-drop", title, body], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)
    except OSError:
        pass


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class Handler(BaseHTTPRequestHandler):
    server_version = f"LiDrop/{VERSION}"

    def log_message(self, fmt, *args):
        line = f"{now()} {self.client_address[0]} {fmt % args}\n"
        try:
            with (STORE.state_dir / "server.log").open("a", encoding="utf-8") as handle:
                handle.write(line)
        except OSError:
            pass

    def _cors(self):
        origin = self.headers.get("Origin") or "*"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Authorization,Content-Type,X-LiMaD-Admin,X-File-Name,X-File-Size")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send(self, status=200, data=None, content_type="application/json; charset=utf-8", headers=None):
        if data is None:
            body = b""
        elif isinstance(data, bytes):
            body = data
        elif isinstance(data, str):
            body = data.encode("utf-8")
        else:
            body = json_bytes(data)
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if content_type.startswith("application/json") else "public, max-age=300")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if headers:
            for key, value in headers.items(): self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD": self.wfile.write(body)

    def _json_body(self, limit=1024 * 1024):
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > limit:
            raise ValueError("Anfrage ist zu groß")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8")) if raw else {}

    def _route(self):
        return urllib.parse.urlparse(self.path)

    def _admin(self):
        token = self.headers.get("X-LiMaD-Admin")
        if not STORE.is_admin(token):
            self._send(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "Admin-Zugriff erforderlich"})
            return False
        return True

    def _device(self):
        device = STORE.authenticate(self.headers.get("Authorization"))
        if not device:
            self._send(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "Gerät ist nicht gekoppelt"})
            return None
        return device

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.send_header("Content-Length", "0"); self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = self._route(); path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if path == "/api/health":
                return self._send(data={"ok": True, "version": VERSION})
            if path == "/api/public/info":
                pair = (query.get("pair") or [""])[0]
                current = STORE.pairing()
                return self._send(data={"ok": True, "version": VERSION, "hostname": socket.gethostname(), "pairValid": bool(pair and secrets.compare_digest(pair, current["token"]))})
            if path == "/api/admin/state":
                if not self._admin(): return
                return self._send(data={"ok": True, **STORE.admin_state(), "airdrop": STORE.airdrop_state()})
            if path == "/api/admin/qr":
                if not self._admin(): return
                pairing = STORE.pairing()
                try:
                    proc = subprocess.run(["qrencode", "-o", "-", "-t", "PNG", "-s", "8", "-m", "2", pairing["url"]], check=True, capture_output=True)
                    return self._send(data=proc.stdout, content_type="image/png")
                except Exception as exc:
                    return self._send(500, {"ok": False, "error": f"QR-Code konnte nicht erzeugt werden: {exc}"})
            if path == "/api/mobile/state":
                device = self._device()
                if not device: return
                return self._send(data={"ok": True, **STORE.mobile_state(device)})
            if path.startswith("/api/download/"):
                transfer_id = path.rsplit("/", 1)[-1]
                row = STORE.transfer(transfer_id)
                device = STORE.authenticate(self.headers.get("Authorization"))
                ticket = (query.get("ticket") or [""])[0]
                if not row or not row.get("device_id"):
                    return self._send(404, {"ok": False, "error": "Datei ist nicht verfügbar"})
                if not device and STORE.validate_download_ticket(row["device_id"], transfer_id, ticket):
                    with STORE.connect() as db:
                        device_row = db.execute("SELECT * FROM devices WHERE id=?", (row["device_id"],)).fetchone()
                    device = dict(device_row) if device_row else None
                if not device:
                    return self._send(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "Gerät ist nicht gekoppelt"})
                return self._download(transfer_id, device)
            if path == "/manifest.webmanifest":
                return self._static("manifest.webmanifest")
            if path in {"/", "/index.html"}:
                return self._static("index.html")
            if path.startswith("/assets/"):
                return self._static(path.removeprefix("/"))
            if path in {"/app.js", "/styles.css", "/sw.js"}:
                return self._static(path.removeprefix("/"))
            return self._send(404, {"ok": False, "error": "Nicht gefunden"})
        except (ValueError, OSError, sqlite3.Error, json.JSONDecodeError) as exc:
            return self._send(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self.log_error("Unhandled error: %r", exc)
            return self._send(500, {"ok": False, "error": "Interner LiDrop-Fehler"})

    def do_POST(self):
        parsed = self._route(); path = parsed.path
        try:
            if path == "/api/pair":
                payload = self._json_body()
                result = STORE.consume_pair(str(payload.get("token", "")), str(payload.get("code", "")), str(payload.get("name", "Smartphone")), self.client_address[0])
                notify("LiDrop", f"{result['name']} wurde gekoppelt")
                return self._send(201, {"ok": True, **result})
            if path == "/api/upload/init":
                payload = self._json_body()
                direction = str(payload.get("direction", "inbound"))
                if direction == "outbound":
                    if not self._admin(): return
                    result = STORE.init_transfer("outbound", None, payload)
                else:
                    device = self._device()
                    if not device: return
                    result = STORE.init_transfer("inbound", device, payload)
                return self._send(201, {"ok": True, **result})
            if path.startswith("/api/upload/") and path.endswith("/complete"):
                transfer_id = path.split("/")[3]
                row = STORE.transfer(transfer_id)
                if not row: raise ValueError("Übertragung wurde nicht gefunden")
                if row["direction"] == "outbound":
                    if not self._admin(): return
                else:
                    device = self._device()
                    if not device or device["id"] != row["device_id"]: return self._send(403, {"ok": False, "error": "Zugriff verweigert"})
                result = STORE.complete_transfer(transfer_id)
                return self._send(data={"ok": True, "transfer": public_transfer(result)})
            if path.startswith("/api/admin/transfer/") and path.endswith("/accept"):
                if not self._admin(): return
                result = STORE.accept(path.split("/")[4])
                return self._send(data={"ok": True, "transfer": public_transfer(result)})
            if path.startswith("/api/admin/transfer/") and path.endswith("/reject"):
                if not self._admin(): return
                result = STORE.reject(path.split("/")[4])
                return self._send(data={"ok": True, "transfer": public_transfer(result)})
            if path.startswith("/api/admin/device/"):
                if not self._admin(): return
                device_id = path.rsplit("/", 1)[-1]
                result = STORE.update_device(device_id, self._json_body())
                return self._send(data={"ok": True, "device": result})
            if path.startswith("/api/admin/outbound/") and path.endswith("/target"):
                if not self._admin(): return
                transfer_id = path.split("/")[4]
                result = STORE.set_outbound_target(transfer_id, str(self._json_body().get("deviceId", "")))
                return self._send(data={"ok": True, "transfer": public_transfer(result)})
            if path == "/api/admin/airdrop":
                if not self._admin(): return
                result = STORE.update_airdrop(self._json_body())
                return self._send(data={"ok": True, "airdrop": result})
            if path == "/api/admin/stage-paths":
                if not self._admin(): return
                ids = STORE.stage_paths(self._json_body().get("paths", []))
                return self._send(201, {"ok": True, "ids": ids})
            return self._send(404, {"ok": False, "error": "Nicht gefunden"})
        except (ValueError, OSError, sqlite3.Error, json.JSONDecodeError) as exc:
            return self._send(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self.log_error("Unhandled error: %r", exc)
            return self._send(500, {"ok": False, "error": "Interner LiDrop-Fehler"})

    def do_PUT(self):
        parsed = self._route(); path = parsed.path
        try:
            if path.startswith("/api/upload/"):
                transfer_id = path.rsplit("/", 1)[-1]
                row = STORE.transfer(transfer_id)
                if not row: raise ValueError("Übertragung wurde nicht gefunden")
                if row["direction"] == "outbound":
                    if not self._admin(): return
                else:
                    device = self._device()
                    if not device or device["id"] != row["device_id"]: return self._send(403, {"ok": False, "error": "Zugriff verweigert"})
                query = urllib.parse.parse_qs(parsed.query)
                offset = int((query.get("offset") or ["0"])[0])
                length = int(self.headers.get("Content-Length", "0"))
                result = STORE.append_chunk(transfer_id, offset, self.rfile, length)
                status = 409 if result.get("conflict") else 200
                return self._send(status, {"ok": not result.get("conflict", False), **result})
            return self._send(404, {"ok": False, "error": "Nicht gefunden"})
        except (ValueError, OSError, sqlite3.Error) as exc:
            return self._send(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self.log_error("Unhandled error: %r", exc)
            return self._send(500, {"ok": False, "error": "Interner LiDrop-Fehler"})

    def do_DELETE(self):
        parsed = self._route(); path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        if path.startswith("/api/admin/device/"):
            if not self._admin(): return
            STORE.delete_device(path.rsplit("/", 1)[-1])
            return self._send(data={"ok": True})
        if path == "/api/admin/devices":
            if not self._admin(): return
            scope = (query.get("scope") or ["offline"])[0]
            if scope not in {"offline", "all"}: raise ValueError("Ungültiger Gerätefilter")
            count = STORE.delete_devices(scope)
            return self._send(data={"ok": True, "deleted": count})
        if path.startswith("/api/admin/transfer/"):
            if not self._admin(): return
            transfer_id = path.rsplit("/", 1)[-1]
            delete_file = (query.get("file") or ["0"])[0] in {"1", "true", "yes"}
            if not STORE.delete_transfer(transfer_id, delete_file):
                return self._send(404, {"ok": False, "error": "Übertragung wurde nicht gefunden"})
            return self._send(data={"ok": True})
        if path == "/api/admin/transfers":
            if not self._admin(): return
            scope = (query.get("scope") or ["finished"])[0]
            if scope not in {"failed", "finished", "all"}: raise ValueError("Ungültiger Übertragungsfilter")
            delete_files = (query.get("file") or ["0"])[0] in {"1", "true", "yes"}
            count = STORE.delete_transfers(scope, delete_files)
            return self._send(data={"ok": True, "deleted": count})
        return self._send(404, {"ok": False, "error": "Nicht gefunden"})

    def _static(self, relative: str):
        target = (WEB_ROOT / relative).resolve()
        if WEB_ROOT.resolve() not in target.parents and target != WEB_ROOT.resolve():
            return self._send(403, {"ok": False, "error": "Zugriff verweigert"})
        if not target.is_file():
            return self._send(404, {"ok": False, "error": "Datei nicht gefunden"})
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        cache = "no-store, max-age=0" if target.name in {"index.html", "sw.js", "app.js", "styles.css", "manifest.webmanifest"} else "public, max-age=86400, immutable"
        data = target.read_bytes()
        self.send_response(200); self._cors(); self.send_header("Content-Type", mime); self.send_header("Content-Length", str(len(data))); self.send_header("Cache-Control", cache); self.send_header("X-Content-Type-Options", "nosniff"); self.end_headers()
        if self.command != "HEAD": self.wfile.write(data)

    def _download(self, transfer_id: str, device):
        row = STORE.transfer(transfer_id)
        if not row or row["direction"] != "outbound" or row["device_id"] != device["id"] or row["status"] not in {"ready", "downloaded"}:
            return self._send(404, {"ok": False, "error": "Datei ist nicht verfügbar"})
        path = Path(row["final_path"] or "")
        if not path.is_file():
            return self._send(410, {"ok": False, "error": "Quelldatei ist nicht mehr vorhanden"})
        size = path.stat().st_size
        start, end = 0, size - 1
        status = 200
        range_header = self.headers.get("Range")
        if range_header and range_header.startswith("bytes="):
            first, _, last = range_header[6:].partition("-")
            start = int(first or 0); end = int(last or size - 1)
            end = min(end, size - 1)
            if start > end or start >= size:
                return self._send(416, b"", "application/octet-stream", {"Content-Range": f"bytes */{size}"})
            status = 206
        length = max(0, end - start + 1)
        mime = mimetypes.guess_type(row["filename"])[0] or "application/octet-stream"
        self.send_response(status); self._cors(); self.send_header("Content-Type", mime); self.send_header("Content-Length", str(length)); self.send_header("Accept-Ranges", "bytes"); self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{urllib.parse.quote(row['filename'])}")
        if status == 206: self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if self.command != "HEAD":
            with path.open("rb") as handle:
                handle.seek(start); remaining = length
                while remaining:
                    chunk = handle.read(min(1024 * 1024, remaining))
                    if not chunk: break
                    self.wfile.write(chunk); remaining -= len(chunk)
        if start == 0 and end == size - 1:
            with STORE.connect() as db:
                db.execute("UPDATE transfers SET status='downloaded',updated_at=? WHERE id=?", (now(), transfer_id))


def public_transfer(row):
    if not row: return None
    return {key: row.get(key) for key in ("id", "direction", "device_id", "device_name", "filename", "size", "received", "sha256", "status", "created_at", "updated_at", "error")}


def runtime_file() -> Path:
    runtime = os.environ.get("XDG_RUNTIME_DIR")
    if runtime:
        return Path(runtime) / "limad-drop.json"
    return Path("/tmp") / f"limad-drop-{os.getuid()}.json"


def write_runtime():
    path = runtime_file()
    payload = {"port": PORT, "url": f"http://127.0.0.1:{PORT}/#admin={STORE.admin_token}", "adminToken": STORE.admin_token, "pid": os.getpid(), "version": VERSION}
    path.write_text(json.dumps(payload), encoding="utf-8")
    path.chmod(0o600)
    return path


def serve():
    path = write_runtime()
    server = Server(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        try: path.unlink()
        except OSError: pass
        server.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", nargs="?", default="serve", choices=["serve", "health"])
    args = parser.parse_args()
    if args.command == "health":
        print(json.dumps({"ok": True, "version": VERSION, "database": str(STORE.db_path)}))
        return 0
    serve()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
