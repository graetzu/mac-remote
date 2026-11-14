import Cocoa

let SERVER_DIR = NSString(string: "~/dev/mac-remote").expandingTildeInPath
let SERVER_PORT = 8765
let SERVER_URL = "http://127.0.0.1:\(SERVER_PORT)"
let LOG_PATH = NSString(string: "~/Library/Logs/mac-remote.log").expandingTildeInPath

final class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var serverProcess: Process?
    var pollTimer: Timer?

    let statusMenuItem = NSMenuItem(title: "Status: wird geprüft…", action: nil, keyEquivalent: "")
    let startItem = NSMenuItem(title: "Starten", action: #selector(AppDelegate.startServer), keyEquivalent: "")
    let stopItem = NSMenuItem(title: "Stoppen", action: #selector(AppDelegate.stopServer), keyEquivalent: "")
    let openItem = NSMenuItem(title: "Im Browser öffnen", action: #selector(AppDelegate.openInBrowser), keyEquivalent: "")

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "antenna.radiowaves.left.and.right", accessibilityDescription: "Mac Remote")
        }

        let menu = NSMenu()
        statusMenuItem.isEnabled = false
        menu.addItem(statusMenuItem)
        menu.addItem(NSMenuItem.separator())

        startItem.target = self
        stopItem.target = self
        openItem.target = self
        menu.addItem(startItem)
        menu.addItem(stopItem)
        menu.addItem(openItem)

        menu.addItem(NSMenuItem.separator())
        let quitItem = NSMenuItem(title: "Beenden", action: #selector(AppDelegate.quit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu

        startServer()

        pollTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            self?.pollStatus()
        }
        pollStatus()
    }

    @objc func startServer() {
        if serverProcess != nil { return }

        if !FileManager.default.fileExists(atPath: LOG_PATH) {
            FileManager.default.createFile(atPath: LOG_PATH, contents: nil)
        }
        let logHandle = FileHandle(forWritingAtPath: LOG_PATH)
        logHandle?.seekToEndOfFile()

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/zsh")
        proc.arguments = ["-l", "-c", "cd \(SERVER_DIR) && exec node server.js"]
        proc.standardOutput = logHandle ?? FileHandle.nullDevice
        proc.standardError = logHandle ?? FileHandle.nullDevice
        proc.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async { self?.serverProcess = nil }
        }

        do {
            try proc.run()
            serverProcess = proc
        } catch {
            NSLog("MacRemote: Fehler beim Start: \(error)")
        }
    }

    @objc func stopServer() {
        serverProcess?.terminate()
        serverProcess = nil

        let kill = Process()
        kill.executableURL = URL(fileURLWithPath: "/bin/zsh")
        kill.arguments = ["-l", "-c", "lsof -ti tcp:\(SERVER_PORT) | xargs -r kill"]
        try? kill.run()
    }

    @objc func openInBrowser() {
        if let url = URL(string: SERVER_URL) {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func quit() {
        stopServer()
        NSApp.terminate(nil)
    }

    func pollStatus() {
        var request = URLRequest(url: URL(string: "\(SERVER_URL)/api/volume")!)
        request.timeoutInterval = 1.5
        let task = URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                let running = (error == nil) && (response as? HTTPURLResponse)?.statusCode == 200
                self.statusMenuItem.title = running ? "● Läuft (Port \(SERVER_PORT))" : "○ Gestoppt"
                self.startItem.isEnabled = !running
                self.stopItem.isEnabled = running
                self.openItem.isEnabled = running
                self.statusItem.button?.appearsDisabled = !running
            }
        }
        task.resume()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
