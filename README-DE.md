# LiMaD OS 2.7.0 RC1 FIX28 (GNOME)

Kompletter Neuanfang: ein eigenes, atomar aktualisierbares Fedora-System auf
Basis von **Bazzite GNOME**, mit dem **MacTahoe**-Design, den
**WhiteSur**-Icons und – ausschließlich darüber gelegt – den eigenen
LiMaD-Programmicons.


## FIX28 – FIX27 mit gehärteten GNOME-Dock-Favoriten

FIX28 baut auf FIX27 auf; FIX27 baut ausschließlich auf dem unveränderten FIX22-Systemstand auf. Die bestätigte Fenster- und Desktopgestaltung bleibt erhalten: die drei farbigen macOS-artigen Fensterknöpfe stehen links in der Reihenfolge **Schließen – Maximieren – Minimieren**, das MacTahoe-/WhiteSur-Design, die drei LiMaD-Hintergründe und der bestehende Dock-Stil werden nicht verändert.

Gezielt ergänzt wurden:

- vollständiger LiMaD-Plymouth-Bootscreen mit separat animiertem violettem Lade-Ring,
- LiMaD-Produktlogo im Installer, in Systeminformationen und in den Cockpit-/Anaconda-Fallbackpfaden,
- transparentes feines LiMaD-L im Logo Menu statt Fedora-/Bazzite-Fallbackgrafiken,
- LiMaD Cut, LiDrop, Windows-Installer und Anycubic Slicer Next als abgesicherte Dock-Favoriten,
- Windows-Auto-Installer mit Erkennungsprofilen und geordneten Winetricks-Abhängigkeiten,
- dreistufige Prüfung der FIX22-Fensteranordnung im Build, nach dem OSTree-Commit und beim ersten Benutzerstart.

Ein Schutzmanifest vergleicht 398 nicht freigegebene Projektdateien bytegenau mit der originalen FIX22-ZIP. Dadurch fallen unbeabsichtigte Änderungen an Theme, Wallpaper, App-Payloads, Workflow oder ISO-Werkzeugen bereits vor dem Hochladen auf.

## Phase 3 – integrierte App-Updates

LiMaD Study, LiMaD Cut, LiDrop und Anycubic Slicer Next können über **LiMaD Updates** ohne Terminal aktualisiert werden. Der Updater sucht in Downloads und auf dem Schreibtisch nach `*.limad-update.zip`, prüft Struktur und SHA-256-Prüfsummen, installiert atomar in das Benutzerprofil und kann jederzeit auf die im Betriebssystem enthaltene Version zurückschalten. Ein Benutzer-Timer prüft alle sechs Stunden, ob ein neueres bereits heruntergeladenes Update-Paket vorliegt.


## Grundidee

| Schicht | Herkunft | Umfang |
|---|---|---|
| Basissystem | `ghcr.io/ublue-os/bazzite-gnome:stable` | Kernel, Treiber, GNOME, Flatpak |
| GTK-, Shell- und GDM-Design | [MacTahoe-gtk-theme](https://github.com/vinceliuice/MacTahoe-gtk-theme), Tag `2026-05-24` | Fenster, Menüleiste, Anmeldebildschirm |
| Alle allgemeinen Icons | [WhiteSur-icon-theme](https://github.com/vinceliuice/WhiteSur-icon-theme), Tag `2025-12-27` | Ordner, Dateitypen, Geräte, Fremdprogramme |
| **Nur** eigene Programmicons | `LiMaD_Programmicons_2` | LiMaDCut, LiDrop, Study, Anycubic, NWS, … |

Das Icon-Thema `LiMaD` erbt von `WhiteSur-dark` und enthält **nichts außer den
eigenen Programmicons**. Ein Test schlägt fehl, sobald dort ein allgemeines
Icon (Ordner, Dateityp, Gerät, Status) auftaucht – so kann das eigene Paket
das WhiteSur-Design nie versehentlich überschreiben.

## Enthaltene eigene Icons

| Icon-Name | Programm | Größen |
|---|---|---|
| `de.limad.Cut` (`limad-cut`) | LiMaDCut | 16–512 px, native Vorlagen |
| `de.limad.Drop` (`limad-drop`) | LiDrop | 16–512 px |
| `de.limad.Study` (`limad-study`) | LiMaD Study | 16–512 px + SVG |
| `de.limad.AnycubicSlicerNext` | Anycubic Slicer Next | SVG |
| `de.limad.Nws` (`limad-nws`) | New World Scheduler | 16–512 px |
| `de.limad.Office` (`limad-office`) | LiMaD Office | 16–512 px |
| `de.limad.Music` (`limad-music`) | LiMaD Musik | 16–512 px |
| `de.limad.Settings` (`limad-settings`) | LiMaD Einstellungen | 16–512 px |
| `de.limad.Store` (`limad-store`) | LiMaD Store | 16–512 px |
| `de.limad.Apps` (`limad-apps`) | LiMaD Programme | 16–512 px |
| `de.limad.WindowsApps` (`windows-apps`) | Windows-Programme | 16–512 px |
| `de.limad.Logo` (`limad-os`) | LiMaD Markenlogo | 16–512 px |
| `de.limad.StartButton` (`limad-start`) | originales LiMaD-L im Startmenü | 16–512 px |

Bewusst **nicht** übernommen wurden die Icons für Fremd- und Systemobjekte
(Elisa, LibreOffice, Ordner „Dokumente“/„Downloads“, Installer, Fedora-Logo) –
die liefert WhiteSur einheitlich mit.

## GNOME-Standardeinstellungen

Systemweit als Vorgabe gesetzt (jederzeit vom Benutzer änderbar):

- GTK- und Shell-Design `LiMaD-Dark-purple`, Icons `LiMaD`
- dunkles Farbschema, Fensterknöpfe links: Schließen – Maximieren – Minimieren
- Dock dauerhaft unten; kein Auto-Hide und kein Intellihide
- Startmenü mit dem unveränderten ursprünglichen LiMaD-**L** und deutschen Bezeichnungen
- Firefox für native und Flatpak-Profile im dunklen LiMaD-Lila-Design
- Erweiterungen: User Themes, Dash to Dock, Blur my Shell und Logo Menu
- neue Fenster zentriert, Hot Corners aktiv, Wochentag und Akkuprozent im Panel
- eigene LiMaD-Hintergrundbilder in 4K als Desktop- und Sperrbildschirm-Standard, Flatpak-Programme übernehmen das Design
- LiMaD-Bootbild über Plymouth statt des Bazzite-Startbilds


## LiMaD Windows Auto-Installer

Der Windows-Installer enthält den vollständigen Fedora-Wine-Laufzeitsatz inklusive Mono, 32-/64-Bit-Gecko und Audio. Beim Image-Bau werden ein echter neuer Wine-Präfix und `wine cmd` geprüft. Vor dem Start einer EXE- oder MSI-Datei zeigt LiMaD einen Installationsplan an und wählt anhand des Dateinamens ein Profil für Standardprogramme, .NET/NWS, Office, CAD/3D, Kreativprogramme, Spiele oder ältere Anwendungen. Benötigte Winetricks-Komponenten werden einzeln und in definierter Reihenfolge installiert; jeder Fehler nennt die betroffene Abhängigkeit und den Protokollpfad.

Die Programmerkennung durchsucht zusätzlich `AppData/Local/Programs`. Portable EXE-Dateien können direkt zum Menü hinzugefügt werden. Diagnose: `limad-wine-diagnose`; Log: `~/.local/share/limad-windows/install.log`.

## FIX20: EFI-Systempartition im xorriso-Bericht korrekt erkennen

Der ISO-Build war in FIX19 erfolgreich. Der Prüfer erwartete jedoch die kanonische ESP-GUID, während xorriso sie im System-Area-Bericht als bytegeordnete Roh-GUID ausgibt. FIX20 erkennt beide Formen und prüft weiterhin, dass eine echte EFI-Systempartition vorhanden ist.

## FIX19: xorriso-Dateisuche repariert

FIX18 erzeugte die ISO korrekt, aber die Quellprüfung verwendete die nicht unterstützte Shell-find-Aktion `-print` innerhalb von `xorriso -find`. Dadurch wurde selbst ein vorhandenes `images/install.img` als fehlend bewertet. FIX19 verwendet in Quellprüfung, Branding und Endprüfung ausdrücklich `-exec echo --`.

## FIX18: aktuelles Anaconda-ISO-Layout

Fedora 44 erzeugt die Installer-Laufzeit als `images/install.img`. Eine unveränderte Quell-ISO enthält dabei nicht zwingend bereits ein `images/product.img` und der aktuelle `bootc-image-builder` erzeugt in diesem Pipelinepfad keine `.treeinfo`. Die Vorprüfung kontrolliert daher das echte Stage2-Abbild und die Boot-Payloads direkt; `.treeinfo` wird nur validiert, wenn sie tatsächlich vorhanden ist. Das LiMaD-`product.img` wird anschließend als optionales Anaconda-Overlay neu erzeugt oder, falls vorhanden, erhalten und erweitert. Erst die finale ISO muss beide Dateien enthalten.

## FIX17: kontrollierter Builder-Abschluss

Der ISO-Workflow unterscheidet jetzt zwischen einem echten fehlgeschlagenen Build und dem beobachteten nachgelagerten Exitcode 5 nach bereits vollständig erzeugter ISO. Eine ISO wird dabei niemals ungeprüft übernommen: Vor Branding und Veröffentlichung müssen Volume-ID, Kernel, Initramfs, EFI-GRUB, UEFI-/USB-Bootstruktur und Medienprüfsumme erfolgreich validiert sein.

## FIX16: abgesicherte UEFI-ISO

Der ISO-Bau setzt die Volume-ID bereits nativ im Image Builder. Nachträgliche
Label-Änderungen sind gesperrt, weil sie EFI-GRUB und ISO-Dateisystem
auseinanderlaufen lassen können. Ein vorhandenes Anaconda-`product.img` wird erhalten und erweitert. Fehlt es im aktuellen Fedora-44-Layout, wird das LiMaD-Overlay neu erzeugt. Anschließend werden `.treeinfo`,
der eingebettete Medienprüfwert, UEFI-El-Torito, EFI-Binärdateien sowie alle
Kernel- und Initramfs-Pfade geprüft. Eine ISO mit falschem Label, fehlendem
`vmlinuz`, defekter EFI-Struktur oder veralteten Prüfsummen wird nicht
veröffentlicht.

## Bauen

Auf macOS `START-GITHUB-BUILD-MAC.command` doppelklicken, auf Linux
`START-GITHUB-BUILD-LINUX.sh` ausführen. Beide prüfen zuerst das Projekt, dann
das Ziel-Repository, laden anschließend hoch und starten den GitHub-Workflow,
der

1. die Offline-Prüfungen wiederholt,
2. das Container-Image baut,
3. das bereits per OSTree committed Image prüft; lokale GPG-Schlüssel liegen
   dabei unter `/usr/share/limad/repo-keys/` und die DNF-Metadaten müssen sich
   aktualisieren lassen, bevor das Image nach `ghcr.io` geschoben wird,
4. für den ISO-Job die öffentlichen Repository-Schlüssel aus genau diesem
   Quell-Abbild in einen kleinen, abgeleiteten `bootc-image-builder` übernimmt,
5. daraus eine installierbare ISO erzeugt,
6. die fertige ISO mit einem adaptiv erzeugten oder erhaltenen LiMaD-product.img, LiMaD-Installerlogo und LiMaD-Bootmenü nachbearbeitet und anschließend automatisch prüft.

Der zusätzliche Builder-Schritt ist kein Bestandteil des fertigen Systems. Er
ist ein gezielter Workaround für einen offenen Fehler im ISO-Depsolver von
`bootc-image-builder`: `file://`-Schlüssel werden dort gegen das Dateisystem des
Builders statt gegen das Quell-Abbild aufgelöst. Repositorys und GPG-Prüfungen
bleiben vollständig aktiviert.

Die ISO liegt anschließend als Artefakt beim Workflow-Lauf.

Beim Start wird gefragt:

- **Frisch anlegen** – löscht das vorhandene Repository und erstellt es neu.
  Erfordert einen Token mit `delete_repo` und eine getippte Bestätigung.
  Historie, bisherige Läufe und Artefakte gehen dabei verloren.
- **Aktualisieren** – überschreibt das vorhandene Repository (empfohlen).

Existiert das Repository noch nicht, wird es in beiden Fällen automatisch
angelegt.

Der Token wird beim ersten Mal abgefragt und auf Wunsch dauerhaft hinterlegt:
auf macOS im Schlüsselbund, unter Linux im Passwortdienst der Arbeitsumgebung,
und nur falls beides fehlt in `~/.config/limad/github-token` mit Rechten `600`.
Nie im Projektverzeichnis – er kann also weder ins Repository noch in ein
Archiv geraten. Wird ein hinterlegter Token von GitHub abgelehnt, verwirft ihn
das Skript und fragt neu.

Zum Entfernen von Hand:

```
security delete-generic-password -s "LiMaD OS Build" -a github-token   # macOS
secret-tool clear service "LiMaD OS Build" account github-token        # Linux
```

### Wenn das Hochladen scheitert

Meldet Git `Repository not found`, prüft das Startskript selbst die drei
üblichen Ursachen und fragt nach dem richtigen Ziel:

1. Das Repository existiert noch nicht – auf github.com anlegen, ohne README,
   ohne .gitignore, ohne Lizenz.
2. Der Name stimmt nicht.
3. Es ist privat und der verwendete Token hat keinen `repo`-Haken. Alte
   Zugangsdaten löschen mit
   `printf 'protocol=https\nhost=github.com\n' | git credential-osxkeychain erase`.

Ein funktionierendes Ziel merkt sich das Skript in `.github-target`.

## Lokale Prüfung

```bash
bash tests/validate.sh
```

Läuft ohne Netzwerk, ohne Podman und ohne Linux-Desktop – also auch auf dem
Mac vor dem Hochladen.

## Mitgelieferte Programme

Alle vier Eigenprogramme laufen nativ im Image – ohne Flatpak, ohne
Nachinstallation:

| Programm | Umsetzung | Start |
|---|---|---|
| **LiMaDCut** 1.0.4 | GTK4 + WebKit (PyGObject) | `limad-cut` |
| **LiMaD Study** 6.1.0-preview18 | GTK4 + WebKit, eigene Dateitypen | `limad-study` |
| **LiDrop** 0.10.1-preview1 | GTK4 + WebKit, Dienst über systemd, Avahi und Firewalld | `limad-drop` |
| **Anycubic Slicer Next** 1.3.96 | natives Linux-Paket, beim Build aus zwei geprüften Teilen zusammengesetzt | `anycubicslicernext` |

Keines der Programme hängt von KDE ab – sie waren von Anfang an GTK-basiert
und passen damit direkt zu GNOME. Ein Test schlägt fehl, sobald irgendwo
`kdialog`, `kwriteconfig` oder ähnliches auftaucht.

## App-Updates ohne Terminal

Die neue Anwendung **LiMaD Updates** installiert Aktualisierungen für alle vier integrierten Programme per Doppelklick oder Dateiauswahl. Unterstützt werden LiMaDCut, LiMaD Study, LiDrop und Anycubic Slicer Next. Jede App besitzt zusätzlich im GNOME-Kontextmenü die Aktion **Update installieren**.

Updates werden pro Benutzer unter `~/.local/share/limad-updater/` abgelegt. Das unveränderliche OS bleibt unangetastet. Vor der Aktivierung werden Paketstruktur und SHA-256-Prüfsummen kontrolliert; anschließend wird die neue Fassung atomar umgeschaltet. Über **Systemversion** lässt sich jederzeit auf die im OS enthaltene Version zurückgehen.

Künftige App-Pakete tragen die Endung `.limad-update.zip`. Aufbau und Erzeugung sind in `UPDATE-PAKET-SPEZIFIKATION.md` beschrieben.

## Systemupdates ohne GHCR-Anmeldefehler

Der Build prüft das veröffentlichte LiMaD-Abbild anonym, bevor eine ISO freigegeben wird. Dadurch kann keine neue Installations-ISO mehr entstehen, deren spätere `rpm-ostree`-Aktualisierung wegen eines privaten GHCR-Pakets mit `unauthorized` scheitert. Der Menüpunkt **LiMaD System aktualisieren** führt das atomare Update aus und erklärt einen verbliebenen Registry-Fehler verständlich.

## Windows-Programme (Wine)

`Windows-Programme` im Menü öffnet einen echten grafischen Installer
(GTK4/libadwaita), der alles Nötige selbst erledigt:

1. **Automatische Einrichtung** – beim ersten Start wird das 64-Bit-Wine-Profil
   unter `~/.local/share/limad-windows/prefix` selbständig angelegt; keine
   Rückfragen, keine Terminal-Kommandos.
2. **Installieren** – EXE oder MSI auswählen (oder im Dateimanager
   doppelklicken, die Dateitypen sind registriert). MSI läuft automatisch über
   `msiexec`.
3. **Erkennen** – nach der Installation vergleicht der Installer den Bestand an
   Programmdateien vor und nach dem Lauf und zeigt die neu hinzugekommenen
   Programme an. Deinstallations- und Hilfsprogramme werden herausgefiltert.
4. **Ins Menü übernehmen** – für die ausgewählten Programme entstehen
   GNOME-Menüeinträge. Das Programmsymbol wird per `wrestool`/`icotool` direkt
   aus der EXE geholt; klappt das nicht, greift das LiMaD-Windows-Icon.
5. **Verwalten** – installierte Programme lassen sich in der Liste starten oder
   wieder aus dem Menü entfernen; die gesamte Windows-Umgebung kann mit einem
   Klick zurückgesetzt werden.

Das Symbol dafür ist das eigene `de.limad.WindowsApps`-Icon – die blau-violette
Vierfenster-Kachel aus dem LiMaD-Iconpaket.

## Hintergrundbilder

Drei eigene Motive in 3840x2160 liegen unter `/usr/share/backgrounds/limad/`
und stehen in Einstellungen -> Erscheinungsbild zur Auswahl:

| Datei | Motiv |
|---|---|
| `LiMaD-Wallpaper-01-Logo-Links-4K.png` | großes Symbol links, freie Fläche rechts |
| `LiMaD-Wallpaper-02-Logo-Zentriert-4K.png` | zentriertes helles Symbol (Standard) |
| `LiMaD-Wallpaper-03-Wellen-Emblem-4K.png` | dunkler, transparentes Emblem, kräftige Wellen |

Das Standardbild wird in `build_files/versions.env` über
`LIMAD_DEFAULT_WALLPAPER` festgelegt. Die Hintergrundbilder von MacTahoe landen
im Unterordner `mactahoe/` und bleiben ebenfalls verfügbar.

## Basis einfrieren

Während der Entwicklung folgt das Abbild `ghcr.io/ublue-os/bazzite-gnome:stable`,
damit Sicherheitsaktualisierungen automatisch ankommen. Das bedeutet aber auch,
dass zwei Builds desselben LiMaD-Standes unterschiedlich ausfallen können.

Jeder Build zeigt in der Zusammenfassung den Digest der verwendeten Basis und
legt ihn zusätzlich als `/usr/share/limad/base-image.txt` im System ab. Sobald
ein Stand als gut befunden ist, genügt **eine** Zeile in
`build_files/versions.env`:

```
BASE_IMAGE_REF="ghcr.io/ublue-os/bazzite-gnome@sha256:<digest>"
```

`BASE_IMAGE_REF` ist die einzige Angabe, die zählt: Der Containerfile nimmt sie
als Build-Argument entgegen, der Arbeitsablauf reicht sie durch. `BASE_IMAGE`
und `BASE_IMAGE_TAG` daneben dienen nur der Lesbarkeit der Protokolle.

Danach ist der Bau vollständig reproduzierbar – Basis, Design und Icons sind
dann alle gepinnt.

## Lizenzen

Siehe `LICENSE-NOTICE.md`. Die Upstream-Lizenzen und die genauen Commits
werden zusätzlich im Image unter `/usr/share/limad-source/` abgelegt.
