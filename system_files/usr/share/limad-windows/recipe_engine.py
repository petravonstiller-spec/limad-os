#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class Plan:
    recipe: str
    profile: str
    windows_version: str
    architecture: str
    dependencies: tuple[str, ...]
    reasons: tuple[str, ...]


PROFILES = {
    "standard": ("win10", ("corefonts", "vcrun2022")),
    "dotnet": ("win11", ("corefonts", "dotnet48")),
    "office": ("win10", ("corefonts", "riched20", "msxml6", "vcrun2022")),
    "cad": ("win10", ("corefonts", "vcrun2022", "dxvk")),
    "creative": ("win10", ("corefonts", "vcrun2022", "dxvk")),
    "gaming": ("win10", ("vcrun2022", "dxvk", "vkd3d")),
    "legacy": ("win7", ("corefonts", "vcrun2010", "d3dx9")),
    "minimal": ("win10", ()),
}

RECIPES = (
    ("nws", re.compile(r"(nws[-_ ]?desktop|new[-_ ]?world[-_ ]?scheduler|jw[-_ ]?scheduler)", re.I), "dotnet"),
    ("office", re.compile(r"(office|microsoft[ _-]?365|m365|winword|excel|powerpoint)", re.I), "office"),
    ("adobe", re.compile(r"(photoshop|illustrator|lightroom|adobe|creative[ _-]?cloud)", re.I), "creative"),
    ("gaming", re.compile(r"(battle[._ -]?net|epic[ _-]?games|gog|ubisoft|ea[ _-]?app|game|launcher)", re.I), "gaming"),
    ("cad", re.compile(r"(autocad|solidworks|fusion[ _-]?360|cad|cam|slicer)", re.I), "cad"),
    ("legacy", re.compile(r"(setup32|win32|legacy|classic|old)", re.I), "legacy"),
)


def detect_architecture(path: Path) -> str:
    if shutil.which("file") is None or not path.is_file():
        return "win64"
    try:
        result = subprocess.run(
            ["file", "-b", str(path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired):
        return "win64"
    text = result.stdout.lower()
    if "pe32+" in text or "x86-64" in text or "aarch64" in text:
        return "win64"
    if "pe32" in text or "80386" in text:
        return "win32"
    return "win64"


def analyze(path: Path, forced_profile: str | None = None) -> Plan:
    suffix = path.suffix.lower()
    if suffix not in {".exe", ".msi"}:
        raise ValueError("Nur EXE- und MSI-Dateien werden unterstützt.")
    if forced_profile is not None and forced_profile not in PROFILES:
        raise ValueError(f"Unbekanntes Profil: {forced_profile}")

    architecture = detect_architecture(path)
    recipe = "generic"
    profile = forced_profile or "standard"
    reasons: list[str] = []

    if forced_profile is None:
        for candidate, pattern, detected_profile in RECIPES:
            if pattern.search(path.name):
                recipe = candidate
                profile = detected_profile
                reasons.append(f"Dateiname passt zum Rezept {candidate}")
                break
    else:
        recipe = "manual"
        reasons.append(f"Profil {forced_profile} wurde manuell gewählt")

    windows_version, dependencies = PROFILES[profile]
    reasons.append("MSI-Paket erkannt" if suffix == ".msi" else "EXE-Datei erkannt")
    reasons.append(f"{architecture}-Architektur erkannt oder als sicherer Standard gewählt")
    return Plan(
        recipe=recipe,
        profile=profile,
        windows_version=windows_version,
        architecture=architecture,
        dependencies=tuple(dependencies),
        reasons=tuple(reasons),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("--profile", choices=sorted(PROFILES))
    args = parser.parse_args()
    try:
        plan = analyze(args.file, args.profile)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(asdict(plan), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
