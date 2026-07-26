# FIX43 – reproduzierbar sauberes Build-Paket

- Python-Cache-Reste werden vor jeder lokalen Prüfung und vor dem Upload automatisch entfernt.
- Alle aktiven Versionsmarker auf FIX43 synchronisiert.
- OWL Target-only-Build aus FIX42 bleibt erhalten.
- Das fertige ZIP wird nach erneutem Entpacken vollständig validiert.

# FIX42 – OWL nur als Runtime-Ziel bauen

- Behebt den GitHub-Abbruch beim nachträglichen Kompilieren von `googletest`.
- Verwendet `cmake --build ... --target owl`, nachdem der OWL-Binary-Build im Log bereits erfolgreich war.
- `BUILD_TESTING=OFF` und der CMake-4-Policy-Schalter bleiben erhalten.
- Aktive Versionsmarker auf FIX42 synchronisiert.

# FIX41 – Versionsstände synchronisiert

- Paketname und interne Build-Revision einheitlich auf FIX41 gesetzt.
- First-Login- und Flatpak-Marker auf FIX41 angehoben.
- CMake-4-/OWL-Regressionsprüfung auf FIX41 umbenannt.
- Produktversion bleibt 2.7.0-rc1; FIX41 ist die Build-Revision.


## FIX40 – Paket-Sauberkeit tatsächlich korrigiert

- Vier versehentlich mitgelieferte `__pycache__`-Verzeichnisse entfernt.
- Fertiges ZIP wird nach dem Packen erneut entpackt und mit `tests/validate.sh` geprüft.
- Keine Änderungen an `.github/workflows`.

# FIX37 – 26.07.2026

- Zoom bleibt als Standardanwendung enthalten.
- YTMDesktop und EasyEffects werden beim ersten Login als Benutzer-Flatpaks installiert.
- Neue kompakte App „LiMaD Klang“ mit direkt wirksamen Bass-, Mitten- und Höhenreglern.
- Schnellprofile einschließlich „Mehr Höhen“, eigene gespeicherte Werte und Übersteuerungsschutz.
- EasyEffects-Preset und Hintergrunddienst werden automatisch eingerichtet.
- Dock um YTMDesktop und LiMaD Klang erweitert.
- GitHub-Workflow und Repository-Zugang unverändert.

# FIX36 – 26.07.2026

- FIX35-App-Rollup übernommen.
- Laufzeitreparatur für veraltete Benutzer-Payloads ergänzt.
- App-Integritätsbericht ergänzt.
- AirDrop-Kompatibilitätsdienste auf maximal zehn Minuten begrenzt und Neustartschleifen verhindert.
- GitHub-Workflow unverändert.

# FIX35 – 26.07.2026

- LiMaD Study 6.2.1, LiMaD Cut 1.1.3 und LiDrop 0.11.0-preview4 integriert.
- Versionsbewusste App-Launcher gegen veraltete Benutzer-Payloads.
- Optionale, standardmäßig deaktivierte OWL/OpenDrop-Kompatibilität mit Sicherheitsprüfung.
- Keine `.github`- oder Workflow-Dateien verändert.

## 2.7.0-rc1 FIX32

- Aerion Mail wird beim ersten Login als Benutzer-Flatpak `io.github.hkdb.Aerion` installiert.
- Aerion erhält vor dem ersten Start die native System-Titelleiste (`native_titlebar=true`) und übernimmt dadurch die linke LiMaD-/GNOME-Fensteranordnung.
- Dock-Reihenfolge erweitert: Zen, Aerion, LiMaDCut, Study, LiDrop, Windows, LiMaD Updates, Anycubic, Zoom, Bazaar, Terminal, Dateien.
- Bei fehlendem Netzwerk wird die Installation beim nächsten Login erneut versucht.
- Alle Funktionen und Schutzmaßnahmen aus FIX31 bleiben erhalten.

## 2.7.0-rc1 FIX31

- Zen Browser, Zoom und Bazaar werden beim ersten Login automatisch als Benutzer-Flatpaks installiert.
- Flathub wird bei Bedarf ausschließlich im Benutzerkonto eingerichtet.
- Feste Dock-Reihenfolge: Zen, LiMaDCut, Study, LiDrop, Windows, LiMaD Updates, Anycubic, Zoom, Bazaar, Terminal, Dateien.
- Papierkorb und „Anwendungen anzeigen“ bleiben rechts als Dash-to-Dock-Funktionen aktiv.
- Fehlgeschlagene Downloads werden beim nächsten Login automatisch erneut versucht.
- Der bootc-sichere initramfs-Rollback aus FIX30 bleibt erhalten.

## FIX28 – Dock-Override-Reparatur

- Eigener spät geladener GNOME-Override für `favorite-apps`.
- Widersprechende Fedora-/Bazzite-Dock-Defaults werden normalisiert.
- Die FIX22-Buttons links, Theme, Wallpaper und das übrige Design bleiben unverändert.

## 2.7.0-rc1 FIX30

- Entfernt die manuelle `dracut --force`-Regenerierung aus `55-plymouth.sh`.
- Verhindert dadurch, dass die von Bazzite/bootc vorbereitete OSTree-initramfs im späten Image-Layer überschrieben wird.
- Behält das vollständige LiMaD-Plymouth-Theme und alle zwölf Spinner-Frames bei.
- Behält die FIX29-Prioritätskorrekturen für GNOME-Schemas und dconf bei.
- Ergänzt einen Regressionstest, der jeden künftigen `dracut`-Aufruf in `55-plymouth.sh` blockiert.


## FIX27 – FIX22-Design bewahrt, LiMaD-Branding und Windows-Automatik ergänzt

- Ausschließliche Entwicklungsbasis ist die hochgeladene FIX22-ZIP mit SHA-256 `56e2e53416a772b7753e7af45d0fbc969bea61e372ae657fc599cc04ea6b4a5e`.
- Die bestätigte FIX22-Fensteranordnung bleibt exakt `close,maximize,minimize:`: drei farbige macOS-artige Knöpfe links.
- Ein eigener Normalisierer entfernt ausschließlich widersprechende Upstream-Werte für `button-layout`; Theme, Wallpaper und Dock-Stil bleiben unangetastet.
- Der vollständige LiMaD-Bootscreen bleibt bytegleich und erhält zwölf separate violette Spinner-Frames für eine echte Plymouth-Ladeanimation.
- Das transparente LiMaD-Logo wird für GNOME-Systeminformationen, Fastfetch sowie die LiMaD-, Bazzite- und Fedora-Fallbackpfade von Cockpit/Anaconda installiert.
- Das gepinnte Logo-Menu-Schema erhält das feine LiMaD-L als echten Standard. Eine Prüfung entfernt vor dem Kompilieren mögliche doppelte globale Schema-IDs.
- LiMaD Cut, LiDrop, Windows-Installer und Anycubic Slicer Next sind im GNOME-Dock voreingestellt und werden beim ersten Login ergänzend ohne Verlust vorhandener Favoriten abgesichert.
- Der Windows-Auto-Installer erkennt NWS/.NET, Office, CAD, Kreativprogramme, Spiele und ältere Anwendungen und installiert die vorgesehenen Winetricks-Abhängigkeiten einzeln in definierter Reihenfolge.
- Build-, Acceptance- und Post-Commit-Prüfung kontrollieren Branding, Spinner, Systemlogo, Dock, Windows-Installer und die linke FIX22-Fensteranordnung.
- Ein Schutzmanifest bestätigt 398 unveränderte Dateien der FIX22-Basis einschließlich Themes, Wallpaper, App-Payloads, GitHub-Workflow und ISO-Werkzeugen.
- Buildrevision `gnome42-phase4-fix27`; das bereits verwendete GHCR-Paket `limad-os-gnome-fix16` bleibt bewusst bestehen.

## FIX22 – Anaconda-Label und Kickstart-Pfad getrennt behandeln

- Die ISO-Prüfung hat `inst.ks=hd:LABEL=LIMAD_OS_270_RC1:/osbuild.ks` fälschlich vollständig als Volume-ID gelesen.
- Die Volume-ID endet vor dem Doppelpunkt; `:/osbuild.ks` ist der Pfad innerhalb des Mediums und gehört nicht zum Label.
- `verify-source-iso.sh` und `audit-boot-config.py` prüfen jetzt nur den Labelteil.
- `rewrite-boot-config.py` ersetzt nur die Volume-ID und bewahrt den Kickstart-Pfad unverändert.
- Ein ausführbarer Regressionstest deckt Prüfung, Fehlermeldung und Pfaderhalt ab.
- Systemabbild, Anwendungen, GNOME-Vorgaben, Themes, Wallpaper und Plymouth bleiben gegenüber FIX21 unverändert.

## FIX21 – natives bootc-image-builder-Metadatenlayout

- Behandelt `.treeinfo` korrekt als optional, weil der aktuelle Fedora-44-Builder sie nicht erzeugt.
- Erhält und aktualisiert `.treeinfo` nur bei Buildervarianten, die sie tatsächlich liefern.
- Prüft Boot-Payloads und EFI-Struktur weiterhin direkt.
- Ergänzt vollständige ISO-Layout- und Bootdiagnosen bei Workflow-Fehlern.

# LiMaD OS 2.7.0-rc1 – FIX20 ESP-GUID-Auswertung

- Der ISO-Build aus FIX19 war erfolgreich; die Quellprüfung verwarf die gültige EFI-Systempartition wegen der von xorriso ausgegebenen, bytegeordneten GPT-Typ-GUID.
- Die gemeinsame ISO-Prüfbibliothek erkennt jetzt die kanonische ESP-GUID und die von `xorriso -report_system_area plain` ausgegebene Rohdarstellung.
- `GPT type GUID` und `GPT partition type GUID` werden beide unterstützt; Schutz-MBR-Typ `0xee` wird weiterhin nicht als EFI-Partition akzeptiert.
- Ein Regressionstest bildet die tatsächliche GitHub-Ausgabe nach.
- Systemanpassungen und App-Payloads bleiben unverändert. Buildrevision `gnome42-phase4-fix20`.

# LiMaD OS 2.7.0-rc1 – FIX19 xorriso-Dateisuche

- Der ISO-Build aus FIX18 enthielt `images/install.img`; der Prüfer meldete sie wegen einer falschen `xorriso -find ... -print`-Syntax dennoch als fehlend.
- Alle ISO-Datei- und Konfigurationssuchen verwenden jetzt die dokumentierte Aktion `-exec echo --`.
- Die Änderung betrifft ausschließlich ISO-Prüfung und ISO-Nachbearbeitung; Systemanpassungen und App-Payloads bleiben unverändert.
- Buildrevision `gnome42-phase4-fix19`; GHCR-Paket `limad-os-gnome-fix16` bleibt bestehen.

# LiMaD OS 2.7.0-rc1 – FIX18 aktuelles Anaconda-ISO-Layout

- Der Builder-Exitcode 0 und `Results saved in /output` werden korrekt als erfolgreicher ISO-Bau behandelt.
- Die Quellprüfung erwartet nicht mehr fälschlich ein bereits vorhandenes `/images/product.img`.
- Das aktuelle Installer-Stage2 `/images/install.img` und der `.treeinfo`-Verweis darauf werden verbindlich geprüft.
- Das LiMaD-`product.img` wird bei aktuellen Builder-ISOs neu erzeugt; bei älteren kompatiblen Layouts wird ein vorhandenes Overlay erhalten und erweitert.
- Die finale ISO muss sowohl das unveränderte `install.img` als auch das neu eingefügte LiMaD-`product.img` enthalten.
- ISO-Dateien werden über exakte `xorriso -find`-Auswertung statt über den unzuverlässigen Rückgabecode von `xorriso -ls` geprüft.
- Buildrevision `gnome42-phase4-fix18`; GHCR-Paket `limad-os-gnome-fix16` bleibt bestehen.

# LiMaD OS 2.7.0-rc1 – FIX17 kontrollierte Builder-Exit-Recovery

- Behebt den realen GitHub-Abbruch nach vollständig erzeugter ISO mit `Build complete!`, `Results saved in .` und anschließendem Exitcode 5.
- Der Buildercontainer wird ohne automatisches `--rm` gestartet, eindeutig benannt und kontrolliert entfernt.
- Das Ausgabeverzeichnis wird explizit mit `--output /output` festgelegt.
- Exitcode 5 wird ausschließlich nach erfolgreicher Pflichtprüfung der Quell-ISO akzeptiert; andere Fehlercodes bleiben fatal.
- Neue Vorprüfung kontrolliert Volume-ID, Kernel, Initramfs, EFI-GRUB, UEFI-El-Torito, Hybrid-MBR/GPT, Medienprüfsumme und Bootpfade vor jeder ISO-Nachbearbeitung.
- Branding und tiefe Endprüfung laufen getrennt; Builderprotokolle werden bei Fehlern als Diagnoseartefakt gesichert.
- Buildrevision `gnome42-phase4-fix17`; das bereits öffentliche GHCR-Paket `limad-os-gnome-fix16` wird weiterverwendet.

# LiMaD OS 2.7.0-rc1 – FIX16 tiefe ISO-Boot-Reparatur

- Die ISO-Volume-ID wird jetzt bereits durch `bootc-image-builder` über `[customizations.iso]` erzeugt. Eine nachträgliche Änderung des ISO-Labels ist nicht mehr erlaubt.
- Die echte EFI-GRUB-Konfiguration in `images/efiboot.img` wird auf Kurzoptionen `-l`/`-L`, lange Labeloptionen, Labelvariablen sowie Kernelparameter geprüft.
- Kernel und Initramfs müssen in der fertigen ISO tatsächlich unter `/images/pxeboot/` vorhanden sein.
- Das ursprüngliche Anaconda-`product.img` wird nicht mehr ersetzt, sondern als Root entpackt, mit LiMaD-Dateien ergänzt und wieder gepackt. Dadurch bleiben die übrigen Installer-Dateien erhalten.
- Nach Änderungen an `product.img` und `efiboot.img` werden die SHA-256-Werte in `.treeinfo` aktualisiert.
- Der eingebettete ISO-Medienprüfwert wird nach der Nachbearbeitung mit `implantisomd5` neu erzeugt und mit `checkisomd5` geprüft.
- UEFI-El-Torito-Eintrag, Hybrid-MBR/GPT für USB-Medien, `BOOTX64.EFI`, `grubx64.efi`, Kernel-/Initrd-Ziele und alle relevanten Bootkonfigurationen werden vor der Veröffentlichung geprüft. Die EFI-Binärdateien müssen durch die Nachbearbeitung bytegleich bleiben.
- Riskante kosmetische GRUB-Hintergrund-Injektionen im frühen EFI-Bootpfad wurden entfernt. Das LiMaD-Bootbild bleibt über Plymouth aktiv.
- Buildrevision `gnome42-phase4-fix16`, GHCR-Paket `limad-os-gnome-fix16`.

# LiMaD OS 2.7.0-rc1 – FIX15 EFI-Boot-Reparatur

- GRUB-Kurzoption `-l` in der eingebetteten EFI-Konfiguration wird auf die LiMaD-Volume-ID umgeschrieben.
- Behebt den Hardwarefehler `file /images/pxeboot/vmlinuz not found` nach dem Start vom USB-Stick.
- ISO-Verifikation prüft echte Kernel-/Initrd-Pfade und beide GRUB-Label-Schreibweisen.
- Buildrevision `gnome42-phase4-fix15`, GHCR-Paket `limad-os-gnome-fix15`.

# LiMaD OS 2.6.2 – Phase 3: integrierte App-Updates

## 2.7.0-rc1 FIX13

- Vollständiges FIX12-Paket übernommen.
- ISO-Validator prüft nur sichtbare GRUB-Menütitel.
- Interne Metadaten wie `--class fedora` verursachen keinen Fehlalarm mehr.
- Buildrevision auf `gnome42-phase4-fix13` angehoben.


- Neuer App-Updater mit automatischer lokaler Suche in Downloads und auf dem Schreibtisch.
- LiMaD Cut, LiMaD Study, LiDrop und Anycubic Slicer Next besitzen die Aktion `Nach Updates suchen`.
- Gefundene neuere `.limad-update.zip`-Pakete können mit einem Klick installiert werden.
- Der Updater prüft Manifest, App-ID, Version und SHA-256 jeder Nutzlastdatei.
- Zusätzlicher Schutz gegen Pfadmanipulation, symbolische Links, verschlüsselte ZIPs, doppelte Pfade und ZIP-Bomben.
- Installation erfolgt atomar im Benutzerprofil; Fehler aktivieren automatisch wieder den vorherigen Stand.
- Aktualisierte Apps können direkt aus dem Updater gestartet oder auf die Systemversion zurückgesetzt werden.
- Ein Benutzer-Timer sucht alle sechs Stunden nach bereits heruntergeladenen neuen App-Paketen und zeigt eine Desktop-Benachrichtigung.
- Online-Kanäle bleiben bewusst unkonfiguriert, bis verbindliche öffentliche Release-URLs für die Apps feststehen.

# LiMaD OS 2.6.1 – Phase 2: Systemupdate und NWS

- GitHub-Build prüft nach dem Push anonymen GHCR-Zugriff. Eine ISO wird nicht mehr veröffentlicht, wenn spätere `rpm-ostree`-Updates mit `unauthorized` scheitern würden.
- Neuer Menüpunkt `LiMaD System aktualisieren` mit verständlicher GHCR-Diagnose und eigenem Protokoll.
- NWS Desktop wird anhand des Installationsnamens erkannt. LiMaD richtet automatisch Windows-11-Modus, Core Fonts und Microsoft .NET Framework 4.8 ein.
- `wineserver -w` besitzt nach Installationen eine feste Wartezeit, damit der grafische Installer nicht dauerhaft hängen bleibt.
- Prüfanleitung `PHASE-2-UPDATE-NWS-PRUEFUNG.md` ergänzt.

# Änderungen

## 2.6.0-gnome34-branding – 23. Juli 2026

- LiMaD-Plymouth als unverwechselbarer Default inklusive Initramfs-Einbindung und Default-Symlinks.
- LiMaD-Hintergrund als GLib-, dconf- und einmalige Benutzer-Vorgabe für Neuinstallationen und Upgrades.
- GNOME Logo Menu setzt das LiMaD-L und ersetzt zusätzlich eingebettete Bazzite-Fallback-Logos.
- ISO-Nachbearbeitung injiziert ein LiMaD-product.img für Anaconda WebUI, ersetzt BIOS/UEFI-Bootmenüs und prüft das fertige ISO.
- Sichtbarer OS-Name, GNOME-About-Logo und Bootloader-Titel lauten LiMaD OS.


## 2.5.0-gnome33 – 22. Juli 2026

### LiMaD-Branding, neue App-Versionen und grafische ZIP-Updates

- LiMaD-Wallpaper 02 wird bei neuen und bestehenden Benutzerprofilen als Desktop- und Sperrbildschirmhintergrund gesetzt.
- Das Logo Menu wird erneut migriert und verwendet fest das originale LiMaD-L aus dem 64-Pixel-Icon; die eingebaute Bazzite-Iconauswahl ist deaktiviert.
- Neues Plymouth-Thema mit dem bereitgestellten LiMaD-Bootbild ersetzt den Bazzite-Bootscreen.
- LiMaD Study wurde auf `6.1.0-preview18`, LiDrop auf `0.10.1-preview1` aktualisiert.
- Neue grafische Anwendung **LiMaD Updates** für LiMaDCut, Study, LiDrop und Anycubic Slicer Next.
- App-Updates werden als geprüfte `.limad-update.zip` pro Benutzer installiert, atomar aktiviert und können ohne Terminal auf die Systemversion zurückgesetzt werden.
- Alle vier Programmstarter erkennen automatisch eine aktive Benutzeraktualisierung; die unveränderliche Bazzite-/bootc-Basis bleibt unberührt.
- Paketgenerator und verbindliche Update-Paketspezifikation sind für künftige Vierer-Übergaben enthalten.

## 2.4.0-gnome32 – 22. Juli 2026

### Desktop, Startmenü, Firefox und Wine nach dem ersten echten Installationslauf

- Einmalige First-Login-Migration setzt das bestätigte LiMaD-Theme, Icons, Shell-Theme, Fensterknöpfe links und das dauerhaft sichtbare Dock.
- Das Startmenü nutzt ausschließlich das ursprüngliche violette LiMaD-L; übrige alte Icons werden nicht übernommen. Sichtbare Menüeinträge sind deutsch.
- Firefox erhält `userChrome.css`/`userContent.css` für native und Flatpak-Profile.
- Wine Mono und Gecko werden nicht mehr abgeschaltet; `DISPLAY=:0` wird nicht erzwungen.
- Der komplette Fedora-Wine-Laufzeitsatz wird explizit installiert und der Image-Bau muss einen neuen Präfix plus `wine cmd` in Xvfb erfolgreich testen.
- Der Installer erkennt per-user Installationen und portable EXE-Dateien, meldet echte Wine-Codes und enthält `limad-wine-diagnose`.
- Bazzite-Gaming-Stack, Repositorys und ISO-Schlüssel-Workaround bleiben unverändert.

## 2.3.4-gnome31 – 22. Juli 2026

### ISO-Workaround für bootc-image-builder `file://`-Schlüssel

Der Image-Bau, der Nach-Commit-Test und `dnf5 makecache` waren erfolgreich.
Der ISO-Bau scheiterte trotzdem erneut mit Curl-Fehler 37 am vorhandenen
Terra-Mesa-Schlüssel unter `/usr/share/limad/repo-keys/`.

Damit ist die Ursache eindeutig: Der Manifest-/Depsolve-Schritt von
`bootc-image-builder` löst absolute `file://`-Schlüsselpfade gegen sein **eigenes
Dateisystem** auf, nicht gegen das Dateisystem des Quell-Abbilds. Das ist ein
bekannter offener Upstream-Fehler bei Anaconda-ISOs und betrifft genau Bazzites
`terra-mesa`-Repository. Ein Verschieben des Schlüssels innerhalb des
LiMaD-Abbilds kann diesen Fehler daher grundsätzlich nicht lösen.

- Neuer Helfer `build_files/prepare-bib-key-wrapper.sh`: Er erstellt für den
  ISO-Job ein kleines abgeleitetes `bootc-image-builder`-Abbild und kopiert die
  öffentlichen Repository-Schlüssel aus dem **exakten LiMaD-Quell-Abbild** an
  dieselben absoluten Pfade im Builder.
- Der LiMaD-Systeminhalt bleibt unverändert. `terra-mesa` bleibt aktiv;
  `gpgcheck` und `repo_gpgcheck` werden nicht abgeschaltet.
- Der Helfer übernimmt den LiMaD-Schlüsselpool, die Fedora-/Distributionsschlüssel
  und `/etc/pki/rpm-gpg` als Absicherung für weitere lokale Schlüsselpfade.
- Vor dem eigentlichen ISO-Bau wird geprüft, dass der Terra-Mesa-Schlüssel im
  abgeleiteten Builder wirklich sichtbar ist. Fehlt er, endet der Lauf sofort
  mit einer klaren Meldung.
- Der ISO-Schritt startet ausschließlich den vorbereiteten Builder und nicht
  mehr direkt `quay.io/centos-bootc/bootc-image-builder:latest`.
- Neuer Offline-Regressionstest `test-bib-key-bridge.sh` schützt die komplette
  Verdrahtung und verbietet als Abkürzung das Abschalten von Repositorys oder
  der Signaturprüfung.

## 2.3.3-gnome30 – 22. Juli 2026

### Repository-Schlüssel jetzt im unveränderlichen Image-Bereich

- Der Terra-Mesa-Schlüssel wird nicht mehr unter `/usr/etc` erzwungen. Ein
  nach `ostree container commit` gestarteter OCI-Container besitzt diesen Pfad
  nicht zuverlässig, obwohl die Laufzeitkopie unter `/etc` vorhanden sein kann.
- Fehlende lokale Repository-Schlüssel werden aus `distribution-gpg-keys` nach
  `/usr/share/limad/repo-keys/` kopiert. Die betroffene `gpgkey=`-Zeile wird auf
  diesen unveränderlichen Pfad umgeschrieben. Der spätere ISO-Lauf zeigte jedoch,
  dass bootc-image-builder solche Pfade wegen Upstream-Fehler #1188 nicht aus dem
  Quell-Abbild liest; dafür enthält 2.3.4 den separaten Builder-Workaround.
- `terra-mesa` bleibt ausdrücklich aktiviert. Kann sein Schlüssel nicht sauber
  auf den unveränderlichen Pfad umgestellt werden, bricht der Image-Bau ab.
- Die Repository-Prüfung deaktiviert keine Archive mehr stillschweigend. Jeder
  aktive, aber unbrauchbare lokale Schlüssel ist nun ein klarer Buildfehler.
- Der Nach-Commit-Test umgeht den Bazzite-Container-Entrypoint mit
  `--entrypoint /usr/bin/bash`. Dadurch erscheint beim Prüfen eines OCI-Images
  nicht mehr die irreführende Meldung, das System sei nicht über libostree
  gebootet worden.
- Der fertige Commit wird vor Push und ISO mit einem Dateiaudit sowie einem
  echten `dnf5 makecache --refresh` geprüft.
- Der Regressionstest schützt den unveränderlichen Schlüsselpfad und verbietet
  die alte `/usr/etc/pki/rpm-gpg`-Annahme.

## 2.3.2-gnome29 – 22. Juli 2026

Der Container-Bau und das Veröffentlichen von 2.3.1 waren erfolgreich. Der
ISO-Bauer scheiterte trotzdem erneut am fehlenden Terra-Mesa-Schlüssel. Die
Ursache lag im Schlüssel-Schritt selbst: Aus dem Laufzeitpfad
`/etc/pki/rpm-gpg/...` wurde durch rohe Zeichenkettenverkettung irrtümlich
`/usr/etc/etc/pki/rpm-gpg/...`. Während des Image-Baus funktionierte DNF über
die temporäre Kopie unter `/etc`; nach `ostree container commit` war im
maßgeblichen Standardbaum `/usr/etc` jedoch kein Schlüssel am richtigen Ort.

- Die Abbildung lautet jetzt exakt `/etc/...` → `/usr/etc/...`; der doppelte
  Pfadbestandteil `etc` kann nicht mehr entstehen.
- `84-repo-keys.sh` prüft nach dem Kopieren ausdrücklich, dass die maßgebliche
  OSTree-Kopie unter `/usr/etc/pki/rpm-gpg/` existiert.
- `85-repo-hygiene.sh` kontrolliert bei Repository-Dateien unter `/usr/etc`
  zusätzlich den dazugehörigen Schlüssel im selben Standardbaum.
- Der GitHub-Workflow startet das **bereits committed** Image vor Push und ISO,
  prüft beide Terra-Schlüsselpfade und führt darin `dnf5 makecache --refresh`
  aus. Damit kann derselbe Fehler nicht mehr erst im ISO-Job auftauchen.
- Neuer Offline-Regressionstest `test-repo-key-paths.sh` schützt den exakten
  Pfadfehler und den Post-Commit-Prüfschritt.

## 2.3.1-gnome28 – 21. Juli 2026

Der Bau von 2.3.0 war vollständig erfolgreich – Design, Icons, Programme, Wine
und auch die Terra-Mesa-Korrektur. Gescheitert ist ausschließlich das
Veröffentlichen in die Registry, mit HTTP 403 nach jeweils erfolgreicher
Anmeldung.

Ursache: Ein GHCR-Paket gehört dem Repository, das es erstmals veröffentlicht
hat. Das Paket `limad-os` stammt aus dem früheren Repository `imad-os`. Seit
dem Wechsel läuft der Arbeitsablauf unter `limad-os` – ein anderes Repository,
das keinen Schreibzugriff auf das fremde Paket besitzt.

- Der Paketname lautet jetzt `limad-os-gnome-fix14`. Damit entsteht ein frisches
  Paket, das automatisch zum laufenden Repository gehört. Alternativ lässt sich
  dem alten Paket unter „Package settings -> Manage Actions access" Zugriff
  geben; dann genügt es, `LIMAD_IMAGE_NAME` zurückzusetzen.
- Ein 403 wird nicht mehr blind wiederholt. Der Arbeitsablauf erkennt es,
  bricht sofort ab und erklärt beide Lösungswege im Protokoll. Für echte
  Netzwerkfehler bleiben drei Versuche.

## 2.3.0-gnome27 – 21. Juli 2026

Besserer Umgang mit `terra-mesa`: **Der fehlende Schlüssel wird bereitgestellt,
statt das Archiv abzuschalten.** Bei einem Gaming-System ist das Abschalten die
schlechtere Lösung – aus terra-mesa kommen die gepatchten Mesa-Treiber.

- Neuer Schritt `84-repo-keys.sh`: Fehlt einem aktiven Archiv der Schlüssel,
  wird er aus der Fedora-Sammlung `distribution-gpg-keys` nachgelegt, nach
  `/etc/pki/rpm-gpg/` und `/usr/etc/pki/rpm-gpg/`. Bewusst allgemein gehalten,
  nicht fest auf Terra verdrahtet.
- `distribution-gpg-keys` ist jetzt Pflichtpaket.
- Die Archivprüfung durchsucht zusätzlich `/etc/distro.repos.d` und
  `/usr/share/dnf5/repos.d` – dnf5 liest auch von dort. Abgeschaltet wird nur
  noch, wofür sich kein Schlüssel finden lässt.
- **Echter Nachweis statt Dateipfad-Vermutungen:** Nach diesen Schritten holt
  der Bau die Metadaten aller aktiven Archive per `dnf5 makecache --refresh`.
  Genau das tut auch der ISO-Bauer. Scheitert es, bricht der Image-Bau nach
  fünf Minuten mit den letzten Zeilen der Ausgabe ab, statt zwanzig Minuten
  später im ISO-Job.
- Die Wiederherstellung wurde vorab an einer Nachbildung geprüft: Der fehlende
  Terra-Mesa-Schlüssel wird eingesetzt, vorhandene Schlüssel und Pfade mit
  Variablen bleiben unangetastet.

## 2.2.8-gnome26 – 21. Juli 2026

Das Abbild wurde vollständig und fehlerfrei gebaut; erst das Hochladen zur
Registry scheiterte:

```
Error: trying to reuse blob ... StatusCode: 403
```

Podman prüft dabei, ob einzelne Schichten bereits in der Registry vorhanden
sind, um sie nicht erneut zu übertragen. GHCR beantwortete eine dieser Anfragen
mit 403. Am Projekt lag es nicht – dieselbe Stelle lief zuvor mehrfach durch.

- Jeder Push bekommt jetzt bis zu vier Versuche mit 30 Sekunden Pause und einer
  frischen Anmeldung dazwischen. Vorübergehende Registry-Fehler kosten damit
  keinen kompletten Durchlauf mehr.
- Jeder Versuch wird nummeriert protokolliert.

## 2.2.7-gnome25 – 21. Juli 2026

`terra-mesa` blockierte den ISO-Bau erneut, obwohl der Bau es abgeschaltet
hatte. Grund: Bazzite ist ein OSTree-System. Die maßgebliche Konfiguration
liegt unter `/usr/etc/yum.repos.d/`, `/etc` ist nur die Laufzeitkopie. Der
ISO-Bauer liest die Originale – die Änderung ging ins Leere.

- Beide Verzeichnisse werden jetzt behandelt, `/etc` und `/usr/etc`.
- Nach dem Abschalten prüft der Schritt den Endzustand: Verweist noch ein
  aktives Archiv auf einen fehlenden Schlüssel, bricht der **Image-Bau** ab.
  Damit fällt so ein Fehler nach fünf Minuten auf statt nach zwanzig im
  ISO-Job.
- Im Protokoll steht künftig, welche Verzeichnisse durchsucht wurden und in
  welcher Datei welches Archiv abgeschaltet wurde.
- Beides wurde vorab an einer Nachbildung mit zwei Verzeichnissen geprüft.

## 2.2.6-gnome24 – 21. Juli 2026

Korrektur eines Fehlers aus 2.2.5. Der neue Schritt zur Archivprüfung hat
**alle** Paketarchive abgeschaltet statt nur des defekten:

```
NoReposError: There are no enabled repositories
```

Ursache: Fedora-Archive verweisen auf ihre Signaturschlüssel mit Variablen im
Pfad (`RPM-GPG-KEY-fedora-$releasever-$basearch`). Die Prüfung suchte wörtlich
nach einer Datei mit `$releasever` im Namen – die es nie gibt.

- Variablen werden jetzt aufgelöst: `$releasever` aus `/etc/os-release`,
  `$basearch` aus der Rechnerarchitektur. Bleibt danach eine unbekannte
  Variable übrig, wird das Archiv **nicht** angetastet.
- Sicherungsnetz: Würde die Prüfung alle Archive abschalten, nimmt sie sämtliche
  Änderungen zurück und bricht mit klarer Meldung ab. Ein Abbild ohne
  Paketarchive wäre nicht aktualisierbar.
- Vor jeder Änderung wird eine Sicherungskopie angelegt und danach entfernt.
- Am Ende steht im Protokoll, wie viele Archive aktiv bleiben.
- Beide Fälle wurden nachgestellt: mit realistischen Fedora-Pfaden bleibt genau
  das defekte Archiv abgeschaltet; fehlen alle Schlüssel, greift die Rücknahme.

## 2.2.5-gnome23 – 21. Juli 2026

Der ISO-Bauer löst Abhängigkeiten gegen alle im Abbild aktivierten
Paketarchive auf und scheiterte an einem davon:

```
Failed to retrieve GPG key for repo 'terra-mesa':
Couldn't open file /etc/pki/rpm-gpg/RPM-GPG-KEY-terra44-mesa
```

Der Signaturschlüssel fehlt bereits im Bazzite-Basisabbild. Im laufenden
Betrieb fällt das kaum auf, der ISO-Bau prüft jedoch jedes Archiv.

- Neuer Schritt `85-repo-hygiene.sh`: Er prüft jedes aktivierte Paketarchiv
  darauf, ob die hinterlegte Schlüsseldatei wirklich vorhanden ist, und
  deaktiviert die betroffenen Archive. Jede Änderung wird protokolliert.
- Ein Archiv ohne Schlüssel lässt sich ohnehin nicht verwenden – weder beim
  ISO-Bau noch später auf dem laufenden System.
- Die Logik wurde vorab an einer Nachbildung des Fehlerfalls geprüft: Das
  Archiv mit fehlendem Schlüssel wird abgeschaltet, das intakte daneben bleibt
  unangetastet.

## 2.2.4-gnome22 – 21. Juli 2026

Das Abbild wird vom ISO-Bauer jetzt gefunden. Er verlangte als Nächstes:

```
error: no default root filesystem type specified in container,
please use "--rootfs" to set manually
```

- Der ISO-Bau gibt das Dateisystem jetzt mit. Vorgabe ist `btrfs`, wie es
  Bazzite selbst verwendet. Einstellbar über `LIMAD_ROOTFS` in
  `build_files/versions.env` (möglich sind `btrfs`, `xfs`, `ext4`).
- Der gewählte Wert wird vor dem Bau protokolliert.

## 2.2.3-gnome21 – 21. Juli 2026

Das Container-Abbild ist erstmals vollständig gebaut, geprüft und
veröffentlicht. Nur der ISO-Bau scheiterte:

```
error: cannot build manifest: image not known
bootc-image-builder no longer pulls images, make sure to pull it before running
```

- Der ISO-Job läuft auf einem frischen Läufer, auf dem das Abbild noch nicht
  liegt. Er meldet sich jetzt zuerst bei ghcr.io an – nötig, weil das
  Repository privat ist – und lädt das Abbild in die Root-Container-Ablage, die
  anschließend an den ISO-Bauer weitergereicht wird.
- Größe des geladenen Abbilds und freier Plattenplatz werden vorher
  protokolliert. Falls der ISO-Bau am Speicherplatz scheitert, ist das damit
  sofort erkennbar.

## 2.2.2-gnome20 – 21. Juli 2026

Rücknahme eines selbstverschuldeten Rückschritts. In 2.2.1 hatte ich
`install -d /root/.cache/dconf` eingefügt, um eine harmlose dconf-Warnung
loszuwerden. In einem OSTree-Abbild ist `/root` ein Symlink auf
`/var/roothome`, den es zur Bauzeit nicht gibt – der Bau brach dort ab, obwohl
Design, Icons und Programme längst fertig waren.

- Beide `/root/.cache/dconf`-Zeilen entfernt.
- Für das Übersetzen und Prüfen der Vorgaben wird stattdessen eine
  Wegwerf-Umgebung unter `/tmp` verwendet, zusammen mit
  `GSETTINGS_BACKEND=memory`. Damit liest `gsettings` nur die übersetzten
  Vorgabewerte und legt keine echte dconf-Datenbank an.
- Neue Prüfung: Build-Skripte dürfen keine absoluten Pfade unter `/root`,
  `/var/home` oder `/var/roothome` schreiben. Der Fehlerfall wurde
  nachgestellt; Pfade wie `"$TMP/root/..."` in entpackten Paketbäumen bleiben
  erlaubt.

## 2.2.1-gnome19 – 21. Juli 2026

Der vollständige Bau lief erstmals bis zur Abnahme durch: MacTahoe, WhiteSur,
Icons, Anycubic (Paket rekonstruiert und geprüft), alle vier Programme, Wine
mit 60 Paketen und der Windows-Installer. Gescheitert ist nur die Abnahme, und
zwar zu Recht.

- **Fehler behoben:** Die Datei mit den GNOME-Vorgaben verwendete `//` als
  Kommentarzeichen. GLib-Schlüsseldateien kennen nur `#`, weshalb
  `glib-compile-schemas` die **gesamte Datei verworfen** hat – mit einer
  einzigen Warnung mitten im Protokoll. Sämtliche Vorgaben (Design, Icons,
  dunkles Farbschema, Dock, Erweiterungen) waren damit wirkungslos. Die
  Abnahme hat genau das gemeldet.
- Neue Offline-Prüfung: Die Vorgabendatei wird als Schlüsseldatei eingelesen;
  jede Zeile, die weder Gruppe noch `#`-Kommentar noch `Schlüssel=Wert` ist,
  lässt die Prüfung fehlschlagen. Der Fehlerfall wurde nachgestellt.
- Der Bau bricht jetzt schon in Schritt 50 ab, wenn eine LiMaD-Vorgabendatei
  beim Übersetzen beanstandet wird, statt erst bei der Abnahme.
- Zusätzlich prüft Schritt 50 unmittelbar nach dem Übersetzen, ob Icon-Design,
  GTK-Design und dunkles Farbschema tatsächlich gesetzt sind, und zeigt die
  Werte an.
- `/root/.cache/dconf` wird angelegt, das beseitigt die dconf-Warnungen.

## 2.2.0-gnome18 – 21. Juli 2026

Der MacTahoe-Schritt läuft erstmals vollständig durch: Anlauf „full look"
gelingt, es entstehen `LiMaD-Dark-purple` samt hdpi- und solid-Varianten, die
Shell-Anpassung greift, GTK 4 landet in `/etc/skel`. Auch WhiteSur installiert
sauber. Abgebrochen hat nur noch meine Nachprüfung.

- **Icon-Themenname wird ermittelt statt angenommen.** Mit Akzentfarbe erzeugt
  WhiteSur `WhiteSur-purple-dark`, nicht `WhiteSur-dark`. Derselbe Fehler, der
  beim GTK-Design längst behoben war – bei den Icons hatte ich ihn übersehen.
  Der tatsächliche Name wird jetzt von der Festplatte gelesen und als
  `LIMAD_WHITESUR_ICON_ACTUAL` in `/usr/share/limad/theme-names.env` abgelegt.
- Die `Inherits=`-Zeile des LiMaD-Icon-Themas wird beim Bau auf diesen Namen
  umgeschrieben. Ohne das hätten fehlende Icons keinen Rückfall gehabt.
- Zusätzlich entsteht ein Verweis `WhiteSur-dark` auf den echten Ordner, damit
  Stellen mit dem alten Namen weiterhin funktionieren.
- Die Abnahmeprüfung liest den Namen aus `theme-names.env` und prüft zusätzlich,
  dass die Vererbung wirklich stimmt.
- Der Schnelltest zeigt die `Inherits=`-Zeile mit an.
- Die Akzentfarbe steht jetzt als `WHITESUR_ACCENT` in `versions.env`.

## 2.1.9-gnome17 – 21. Juli 2026

Der Theme-Schnelltest hat die Ursache endgültig freigelegt. Die Installation
selbst lief bereits sauber – zu sehen an „Installing 'LiMaD' themes",
„Changing maximized window style" und der Variantenliste. Abgebrochen hat sie
an einer Kosmetik-Anweisung:

```
+ setterm -cursor on
setterm: $TERM is not defined.
```

Ein Container-Bau hat kein Terminal, also ist `TERM` nicht gesetzt. Der
Installer schaltet nach jeder Meldung den Cursor wieder ein und löscht den
Bildschirm; beides scheitert. Da die Bibliotheken mit `set -Eeo pipefail` und
`trap signal_error ERR` laufen, reißt dieser belanglose Fehler den ganzen Lauf
mit.

- `TERM` wird auf `xterm-256color` gesetzt.
- Zusätzliche Attrappen für `setterm`, `clear`, `reset` und `tput` liegen
  während des Schritts im Suchpfad. Sie tun nichts und liefern immer Erfolg,
  damit Terminal-Kosmetik den Bau nie wieder abbrechen kann. Wie die
  sudo-Attrappe liegen sie in einem temporären Verzeichnis und gelangen nicht
  ins Abbild.
- Der WhiteSur-Schritt bekommt dieselbe Absicherung.

Der Fehlerfall wurde vorab nachgestellt: ohne die Attrappen bricht ein Skript
mit derselben Fallenstellung ab, mit ihnen läuft es bis zum Ende durch.

## 2.1.8-gnome16 – 21. Juli 2026

- Der benötigte Token-Haken `workflow` wird jetzt genannt. Ohne ihn lehnt
  GitHub jede Änderung an Dateien unter `.github/workflows/` ab – das Hochladen
  scheiterte deshalb ganz am Ende, obwohl Repository und Commit bereits standen.
- Tritt der Fall auf, erklärt das Skript ihn im Klartext und führt Schritt für
  Schritt durch das Nachrüsten des Hakens, statt nur die Git-Meldung zu zeigen.
- Andere Fehler beim Hochladen werden ebenfalls mit den letzten Zeilen der
  Git-Ausgabe dargestellt.

## 2.1.7-gnome15 – 21. Juli 2026

- Der Token lässt sich jetzt dauerhaft hinterlegen und muss nicht bei jedem
  Lauf neu eingefügt werden. Nach der ersten erfolgreichen Anmeldung fragt das
  Skript, ob es ihn speichern soll.
- Ablage bewusst außerhalb des Projektverzeichnisses: auf macOS im
  Schlüsselbund (`security`), unter Linux im Passwortdienst (`secret-tool`),
  und nur als letzter Ausweg in `~/.config/limad/github-token` mit Rechten
  `600`. So kann der Token weder ins Repository noch in ein Archiv geraten.
- Wird ein hinterlegter Token abgelehnt, verwirft ihn das Skript automatisch
  und fragt einmal neu, statt abzubrechen.

## 2.1.6-gnome14 – 21. Juli 2026

- Die Startskripte geben bei einem Fehler der GitHub-Schnittstelle jetzt deren
  eigene Meldung im Klartext aus, statt nur den HTTP-Status.
- Wird das Anlegen eines Repositorys mit 403 oder 404 abgelehnt, erklärt das
  Skript die Ursache: Fine-grained Tokens dürfen ohne die Kontoberechtigung
  „Administration" keine Repositories erstellen. Es nennt beide Auswege
  (klassischer Token mit `repo`/`delete_repo`, oder einmal von Hand anlegen).
- Kein Abbruch mehr in diesem Fall: Das Skript wartet, bis das Repository von
  Hand angelegt wurde, prüft nach und fährt fort.
- Fehlt dem Token das Recht `delete_repo`, wird nicht mehr abgebrochen, sondern
  auf „Aktualisieren" ausgewichen.

## 2.1.5-gnome13 – 21. Juli 2026

- **Fehler behoben:** `tests/test-anycubic-package.sh` verwendete `mapfile`,
  das erst mit bash 4 kam. macOS liefert bis heute bash 3.2 aus, weshalb die
  Prüfung dort abbrach. Die Stelle kommt jetzt ohne Arrays aus.
- Neue Absicherung: Der Syntaxtest lehnt bash-4-Konstrukte (`mapfile`,
  `readarray`, assoziative Arrays, `${x,,}`, `${x^^}`) in allen Dateien ab, die
  auf dem Mac laufen müssen – also in `tests` und den beiden Startskripten.
- **Startskripte verwalten das Repository selbst.** Sie melden sich mit einem
  Token bei GitHub an und legen das Repository an, falls es fehlt. Zur Auswahl
  stehen „Frisch anlegen" (löscht das vorhandene Repository, mit getippter
  Bestätigung und `delete_repo`-Recht) und „Aktualisieren" (Standard).
- Standardname ist jetzt `limad-os`.
- Der Token bleibt im Arbeitsspeicher: keine Datei, kein Eintrag in der
  Git-Konfiguration, keine Speicherung im Schlüsselbund.

## 2.1.4-gnome12 – 21. Juli 2026

Der Build von 2.1.3 hat erstmals echte Fehlermeldungen geliefert. Zwei
Ursachen, beide behoben:

- **`--silent-mode` entfernt.** Der Installer meldete „needs a root privilege",
  obwohl der Bau als Root läuft: Er prüft die Rechte über `sudo`, was im
  Container ohne Terminal scheitert. Die Anläufe ohne diese Option kamen
  dagegen bis zur eigentlichen Installation. Die Option bringt einem Bau
  ohnehin nichts und ist jetzt überall gestrichen – auch bei den
  Shell-Anpassungen und beim GDM-Aufruf.
- **sudo-Attrappe.** Damit auch andere Rechteprüfungen des Installers nicht
  ins Leere laufen, liegt während des Schritts eine kleine `sudo`-Attrappe im
  Suchpfad, die Prüfaufrufe beantwortet und Befehle direkt ausführt. Sie liegt
  in einem temporären Verzeichnis und wird danach entfernt – sie gelangt nie
  ins Abbild.
- **Abschaltung der stderr-Umleitung repariert.** Sie hatte nicht gegriffen:
  Die Zeile lautet `mkdir -p "$D"; exec 2> "$F"`, mein Suchmuster verlangte
  aber `exec` am Zeilenanfang. Jetzt wird die Umleitung an beliebiger Stelle
  einer Zeile ersetzt, und es wird geprüft, ob wirklich keine übrig blieb.
  Deshalb fehlte bei den weiter gekommenen Anläufen der eigentliche Grund.
- Bei einem Fehlschlag wird zusätzlich das Fehlerprotokoll des Installers
  ausgegeben, falls er noch eines hinterlassen hat.
- Neue Variante in der Anlaufkette: dunkel mit nur einer Deckkraftvariante.
- Der WhiteSur-Schritt bekommt dieselbe sudo-Attrappe.

## 2.1.3-gnome11 – 21. Juli 2026

- Der KDE-Rest `tests/test-anycubic-native.sh` ist entfernt. Er stammte aus dem
  übernommenen Anycubic-Paket, prüfte einen Plasma-Layout-Pfad und ein nicht
  mehr existierendes Build-Skript – und lief mangels Eintrag in `validate.sh`
  ohnehin nie mit.
- Ersetzt durch `tests/test-anycubic-package.sh`, der auf GNOME passt: Er setzt
  das geteilte Paket testweise zusammen, prüft die Prüfsummen, sieht in das
  enthaltene ELF-Programm hinein und kontrolliert Startdatei, Build-Schritt,
  Desktop-Eintrag, Icon und Dock-Verankerung.
- Der Sauberkeitstest durchsucht jetzt auch das Verzeichnis `tests` nach
  KDE-Spuren; ausgenommen sind nur die zwei Prüfungen, die diese Begriffe
  nennen müssen, um danach zu suchen. Zusätzlich schlägt er fehl, wenn eine
  Prüfung nicht in `validate.sh` eingetragen ist – genau daran lag es, dass der
  alte Test unbemerkt liegen blieb.
- Die README-Anleitung zum Einfrieren der Basis nennt nur noch `BASE_IMAGE_REF`.

## 2.1.2-gnome10 – 21. Juli 2026

- Die drei eigenen LiMaD-Hintergrundbilder in 4K (3840x2160) sind jetzt Teil des
  Abbilds und liegen unter `/usr/share/backgrounds/limad/`.
- Standard ist „Symbol zentriert". Änderbar mit einer Zeile in
  `build_files/versions.env` (`LIMAD_DEFAULT_WALLPAPER`).
- Alle drei erscheinen in Einstellungen -> Erscheinungsbild zur Auswahl, mit
  deutschen und englischen Namen.
- Die MacTahoe-Hintergrundbilder landen jetzt im Unterordner `mactahoe/`, damit
  die Standardauswahl nie versehentlich eines davon erwischt.
- Zwei neue Prüfungen: Jede in der Auswahlliste eingetragene Datei muss
  tatsächlich mitgeliefert werden, und das eingestellte Standardbild muss
  existieren.

## 2.1.1-gnome9 – 21. Juli 2026

Die Diagnoseausgabe aus 2.1.0 hat die Ursache freigelegt: `libs/lib-core.sh`
ermittelt den Benutzer mit `logname`. Das setzt eine Anmeldesitzung mit
utmp-Eintrag voraus – in einem Container gibt es beides nicht. `MY_USERNAME`
bleibt leer, das anschließende `getent passwd ''` findet nichts, und wegen
`set -Eeo pipefail` bricht die Bibliothek beim Laden ab. Die Optionen wurden nie
erreicht.

- Vor dem Aufruf werden `USER`, `LOGNAME`, `SUDO_USER` und `HOME` auf `root`
  gesetzt.
- `logname` wird in allen Bibliotheken durch `id -un` ersetzt, das ohne
  Anmeldesitzung funktioniert. Die betroffenen Fundstellen werden vorher
  protokolliert.
- Die Diagnoseprüfung gibt jetzt zusätzlich `MY_USERNAME` und `MY_HOME` aus, so
  dass im Protokoll direkt sichtbar ist, ob die Ermittlung greift.
- Der WhiteSur-Schritt bekommt dieselbe Absicherung.
- Der `--libadwaita`-Aufruf entfällt: Der Installer verweigert ihn als Root
  ausdrücklich ("Do not run '--libadwaita' option with sudo!"), und ein
  Container-Bau ist immer Root. Die GTK-4-Dateien werden direkt nach
  `/etc/skel/.config/gtk-4.0` kopiert.

## 2.1.0-gnome8 – 21. Juli 2026

Der zweite Build zeigte: Alle fünf Anläufe scheitern mit Status 2, und selbst
`install.sh --help` gibt keine einzige Zeile aus. Da das Skript direkt nach dem
Laden seiner Bibliotheken ein `echo` ausführt, das nie erscheint, scheitert es
bereits beim Laden von `libs/lib-install.sh` – und die Bibliotheken leiten dabei
ihr eigenes stderr in eine temporäre Datei um, die beim Beenden gelöscht wird.
Deshalb war nichts zu sehen.

- **Der Installer muss reden:** Nach dem Klonen wird die interne
  stderr-Umleitung (`exec 2> …`) in allen Bibliotheken deaktiviert. Zusätzlich
  wird das Laden der Bibliotheken einzeln mit `bash -x` geprüft und die
  Ablaufverfolgung ausgegeben, falls es scheitert. Umgebung, Dateiliste und
  bash-Version werden mitprotokolliert.
- **Staging statt Direktinstallation:** Jeder Anlauf installiert nach
  `/tmp/limad-theme-stage`. Erst das Ergebnis eines erfolgreichen Anlaufs wird
  nach `/usr/share/themes` kopiert. Das unveränderliche Systemverzeichnis sieht
  damit nie einen halbfertigen Stand.
- **Basis-Abbild wirklich einstellbar:** Der Containerfile verwendete bisher
  fest `bazzite-gnome:stable`, die Angaben in `versions.env` waren also
  wirkungslos. Jetzt gibt es `BASE_IMAGE_REF` als Build-Argument, das der
  Arbeitsablauf übergibt. Zum Einfrieren genügt eine Zeile in `versions.env`.
- **Fehlendes Shell-Design ist ein Fehler**, keine Warnung mehr. Ohne
  gnome-shell-Stylesheet bliebe die obere Leiste Standard-GNOME – das ist kein
  auslieferbarer Zustand. Über `LIMAD_REQUIRE_SHELL_THEME="0"` abschaltbar.
- **GDM-Theming vorerst aus** (`LIMAD_INSTALL_GDM_THEME="0"`). Der
  Anmeldebildschirm ist empfindlich und für das Testen von Desktop, Programmen
  und Wine nicht nötig. Nach dem ersten grünen Gesamtbau wieder einschalten.

## 2.0.5-gnome7 – 21. Juli 2026

- **Wichtig:** Zwischen den Installationsanläufen für MacTahoe wird jetzt
  aufgeräumt. Ein Anlauf, der erst spät scheitert, kann bereits Theme-Dateien
  geschrieben haben; ohne Bereinigung hätte die anschließende Namenserkennung
  Ordner aus mehreren Anläufen vorgefunden und womöglich den falschen gewählt.
  Jeder Anlauf startet nun auf leerem Grund, ebenso `/etc/skel/.config/gtk-4.0`.
- Das verwendete Basis-Abbild wird als `/usr/share/limad/base-image.txt` im
  System hinterlegt, und der Arbeitsablauf zeigt den Digest in der
  Zusammenfassung an. Damit lässt sich ein funktionierender Bazzite-Stand
  später gezielt einfrieren, statt weiter `:stable` zu verfolgen.

## 2.0.4-gnome6 – 21. Juli 2026

- Neuer Arbeitsablauf `Theme-Schnelltest`: baut nur die beiden Design-Schritte
  statt des kompletten Abbilds und zeigt anschließend, welche Design- und
  Icon-Ordner tatsächlich entstanden sind. Damit kostet eine Korrektur am
  Theme-Aufruf wenige Minuten statt einer halben Stunde. Start über
  Actions -> Theme-Schnelltest -> "Run workflow".
- `10-packages.sh` läuft jetzt auch eigenständig, ohne den Gesamtablauf.

## 2.0.3-gnome5 – 21. Juli 2026

Behebt den Abbruch des ersten Image-Builds in Schritt 20 (MacTahoe-Installer,
Exit-Code 2 ohne eigene Fehlermeldung).

- Der Installer wird jetzt in mehreren Anläufen aufgerufen, von der vollen
  LiMaD-Optik bis zum schlichten dunklen Design. Der erste erfolgreiche Anlauf
  gewinnt; erst wenn alle scheitern, bricht der Bau ab.
- Vor dem ersten Anlauf wird `install.sh --help` ins Protokoll geschrieben, und
  bei jedem Fehlschlag die letzten 25 Zeilen der Installerausgabe. Damit ist
  beim nächsten Lauf sichtbar, was der Installer tatsächlich bemängelt.
- Die problematische Kombination `--shell -i simple -h bigger` wurde aus dem
  Hauptaufruf entfernt; `-h` kollidiert dort mit der Hilfe-Option. Die
  Shell-Anpassungen laufen jetzt als eigener, fehlertoleranter Aufruf.
- Die endgültigen Designnamen werden nicht mehr angenommen, sondern nach der
  Installation aus `/usr/share/themes` ermittelt und in
  `/usr/share/limad/theme-names.env` festgehalten. Die GNOME-Vorgaben und die
  Abnahmeprüfung verwenden diese ermittelten Namen.
- Fällt der libadwaita-Installer aus, werden die GTK-4-Dateien direkt kopiert.
- Ein fehlendes gnome-shell-Stylesheet ist nur noch eine Warnung.

## 2.0.2-gnome4 – 21. Juli 2026

- `actions/checkout` und `actions/upload-artifact` von v4 auf v6 angehoben.
  Beide laufen damit nativ auf Node.js 24; die Abwertungswarnung im
  Workflow-Protokoll entfällt.

## 2.0.1-gnome3 – 21. Juli 2026

- Startskripte für macOS und Linux überarbeitet: Das Ziel-Repository wird jetzt
  **vor** dem Hochladen mit `git ls-remote` geprüft. Schlägt das fehl, nennt das
  Skript die drei möglichen Ursachen (Repository fehlt, falscher Name, fehlende
  Token-Rechte) und lässt Kontoname und Repository direkt eingeben, statt mit
  „Repository not found" abzubrechen.
- Ein einmal erfolgreich benutztes Ziel wird in `.github-target` gemerkt und ist
  beim nächsten Start vorbelegt. Die Datei bleibt lokal (in `.gitignore`).
- Der erste Commit wird korrekt erkannt, auch wenn noch kein `HEAD` existiert.
- Hinweis zur Uploadgröße (rund 140 MB) vor dem Push ergänzt.

## 2.0.0-gnome2 – 21. Juli 2026

- Die vier Eigenprogramme nativ eingebaut: LiMaDCut 1.0.4, LiMaD Study
  6.1.0-preview14, LiDrop 0.10.0-preview1 und Anycubic Slicer Next 1.3.96.
- Neuer grafischer Windows-Installer (GTK4/libadwaita) auf Wine-Basis: legt die
  Windows-Umgebung selbständig an, installiert EXE- und MSI-Dateien, erkennt die
  neu hinzugekommenen Programme, holt deren Symbole aus der EXE und legt
  GNOME-Menüeinträge an.
- EXE- und MSI-Dateitypen registriert, Programme im Dock verankert.
- Neue Prüfung `test-limad-apps.sh` für Programmnutzlasten, Startdateien,
  Anycubic-Prüfsummen und die Wine-Verdrahtung.

## 2.0.0-gnome1 – 21. Juli 2026

- Kompletter Neuaufbau auf Bazzite GNOME.
- MacTahoe-GTK-Theme (Tag 2026-05-24) und WhiteSur-Icons (Tag 2025-12-27)
  werden beim Bau aus der jeweiligen Quelle installiert, nichts davon liegt im
  Repository.
- Eigenes Icon-Thema `LiMaD`, das ausschließlich die eigenen Programmicons
  enthält und alles Übrige von WhiteSur erbt.
- Systemweite GNOME-Vorgaben: dunkles MacTahoe-Design, Fensterknöpfe links,
  Dash to Dock, Blur my Shell, User Themes.
- Sieben Offline-Prüfungen, die ohne Netzwerk und ohne Podman laufen.

## 2.7.0 RC1 – Phase 4 Release-Audit

- Phase-3-Funktionsstand als Release-Candidate eingefroren.
- Versionsquelle auf 2.7.0-rc1 aktualisiert.
- Verbindliche Phase-4-Prüfung für Branding, Installer, Updater und Kernanwendungen ergänzt.
- Statusmodell für Quellcode-, Build- und Hardwarebestätigung dokumentiert.

## 2.7.0-rc1 FIX29

- Plymouth-Theme wird nach der Installation in jede vorhandene Kernel-initramfs eingebettet.
- Alle zwölf violetten Spinner-Frames werden ausdrücklich durch Dracut aufgenommen.
- GNOME-Schema- und dconf-Vorgaben erhalten eine garantiert späte Sortierpriorität gegenüber Fedora/Bazzite.
- Der Build prüft nun zusätzlich das tatsächlich kompilierte GNOME-Shell-Theme.
- Dock-, Wallpaper- und linke FIX22-Fensterbutton-Härtung bleiben erhalten.

## 2.7.0-rc1 FIX39

- Behebt den CMake-4-Abbruch in der gepinnten OWL-Abhängigkeit `googletest`.
- Setzt für den isolierten OWL-Build `CMAKE_POLICY_VERSION_MINIMUM=3.5`.
- Deaktiviert nicht benötigte OWL/GoogleTest-Tests beim Image-Bau.
- Verändert weder die gepinnten Upstream-Commits noch GitHub-Workflows oder Repository-Inhalte.
