# Mac Remote

Fernbedienung für den Mac vom iPhone aus (oder jedem anderen Gerät im selben Netzwerk) –
als Webapp, kein App-Store-Download nötig. Ein kleiner Node-Server läuft auf dem Mac und
steuert ihn per AppleScript/JXA (Medien, Lautstärke, Apps, System) und `cliclick` (Trackpad).

## Features

- **Medien**: Play/Pause, 10s vor/zurück, Lautstärke-Slider, Mute
- **Shortcuts**: Apps (z. B. Stremio) oder URLs (YouTube, Twitch) auf einem bestimmten
  Bildschirm im Vollbild öffnen
- **Trackpad**: 1 Finger bewegen/klicken, halten+ziehen = Drag, 2 Finger = Scrollen/Rechtsklick,
  dazu ein D-Pad für Richtungsnavigation
- **Eingabe**: Text ans aktive Textfeld senden, inkl. Tab/Esc/Enter/Entf
- **Apps**: laufende Programme auflisten, fokussieren oder beenden
- **System**: Schlaf, Neustart, Herunterfahren, Abmelden (mit Sicherheitsabfrage)
- **Jetzt läuft**: Titel/Interpret des aktuell laufenden Mediums (beliebige App/Website mit
  Now-Playing-Integration) plus Scrubber zum Spulen
- **Mac Remote.app**: Menüleisten-App zum Starten/Stoppen des Servers

## Voraussetzungen

- Node.js
- [`nowplaying-cli`](https://github.com/kirtan-shah/nowplaying-cli) (`brew install nowplaying-cli`)
- [`cliclick`](https://github.com/BlueM/cliclick) (`brew install cliclick`)
- macOS-Berechtigungen: Der Prozess, der `osascript`/`cliclick` ausführt (i. d. R. Terminal
  oder MacRemote.app), braucht **Bedienungshilfen**-Zugriff unter
  *Systemeinstellungen → Datenschutz & Sicherheit → Bedienungshilfen*

## Nutzung

```bash
npm install
node server.js
```

Dann auf dem iPhone (im selben WLAN) `http://<mac-ip>:8765` öffnen und optional über
„Zum Home-Bildschirm" als App-Icon ablegen.

## MacRemote.app (Menüleisten-App)

Im Ordner `MacRemoteApp/` liegt der Quellcode einer kleinen Swift-Menüleisten-App, die den
Server im Hintergrund startet/stoppt:

```bash
cd MacRemoteApp
swiftc -O -o MacRemote.app/Contents/MacOS/MacRemote main.swift -framework Cocoa
cp -R MacRemote.app /Applications/
open /Applications/MacRemote.app
```

## Hinweis zum Scrollen

Native CGEvent-Scroll-Events werden auf aktuellen macOS-Versionen teils ignoriert. Der
Server simuliert 2-Finger-Scrollgesten deshalb über gebündelte Pfeiltasten-Presses
(`scripts/scrollKeys.js`) statt über direkte Scroll-Wheel-Events.

## Hinweis zu „Jetzt läuft"

Titel, Dauer und Play/Pause-Status kommen zuverlässig über macOS' systemweite
Now-Playing-Schnittstelle. Seeken (`seek`) funktioniert ebenfalls zuverlässig als
Absolut-Position. Die laufende Positionsanzeige wird clientseitig interpoliert und
mit jedem Poll (alle 2s) korrigiert – bei Quellen, die selbst keine kontinuierlichen
Positions-Updates melden (z. B. YouTube im Browser), bleibt die Anzeige zwischen den
Korrekturen entsprechend stehen, statt flüssig zu laufen.
