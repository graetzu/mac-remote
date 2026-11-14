const express = require("express");
const { WebSocketServer } = require("ws");
const { execFile } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const PORT = process.env.PORT || 8765;
const SCRIPTS = path.join(__dirname, "scripts");
const SHORTCUTS_FILE = path.join(__dirname, "shortcuts.json");

function loadShortcuts() {
  try {
    return JSON.parse(fs.readFileSync(SHORTCUTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveShortcuts(list) {
  fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(list, null, 2));
}

function jxa(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    execFile(
      "osascript",
      ["-l", "JavaScript", path.join(SCRIPTS, scriptName), ...args],
      (err, stdout, stderr) => {
        if (err) return reject(stderr || err.message);
        resolve(stdout.trim());
      }
    );
  });
}

function signed(n) {
  const r = Math.round(n);
  return (r >= 0 ? "+" : "") + r;
}

function cliclick(args) {
  return new Promise((resolve, reject) => {
    execFile("cliclick", args, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

function osaInline(script) {
  return new Promise((resolve, reject) => {
    execFile("osascript", ["-e", script], (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

const SCROLL_STEP_PX = 15;
const SCROLL_MAX_STEPS = 12;

function scroll(dx, dy) {
  const vCount = Math.min(SCROLL_MAX_STEPS, Math.round(Math.abs(dy) / SCROLL_STEP_PX));
  const vCode = dy >= 0 ? 126 : 125; // natürliches Scrollen: Finger runter -> Pfeil hoch
  const hCount = Math.min(SCROLL_MAX_STEPS, Math.round(Math.abs(dx) / SCROLL_STEP_PX));
  const hCode = dx >= 0 ? 123 : 124;

  if (vCount === 0 && hCount === 0) return Promise.resolve();

  return jxa("scrollKeys.js", [
    String(vCount),
    String(vCode),
    String(hCount),
    String(hCode),
  ]);
}

function openUrl(url) {
  return new Promise((resolve, reject) => {
    execFile("open", [url], (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve();
    });
  });
}

function localIps() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name]) {
      if (i.family === "IPv4" && !i.internal) ips.push(i.address);
    }
  }
  return ips;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/shortcuts", (req, res) => {
  res.json(loadShortcuts());
});

app.put("/api/shortcuts", (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "Erwarte ein Array" });
  }
  const valid = req.body.every(
    (s) =>
      s &&
      typeof s.label === "string" &&
      (s.type === "app" || s.type === "url") &&
      typeof s.value === "string"
  );
  if (!valid) {
    return res.status(400).json({ error: "Ungültiges Shortcut-Format" });
  }
  saveShortcuts(req.body);
  res.json({ ok: true });
});

app.get("/api/screens", async (req, res) => {
  try {
    const out = await jxa("listScreens.js");
    res.json(JSON.parse(out));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/volume", async (req, res) => {
  try {
    const out = await osaInline("get volume settings");
    // "output volume:40, input volume:0, alert volume:100, output muted:false"
    const volume = parseInt(out.match(/output volume:(\d+)/)[1], 10);
    const muted = /output muted:true/.test(out);
    res.json({ volume, muted });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/apps", async (req, res) => {
  try {
    const out = await jxa("listApps.js");
    res.json(JSON.parse(out));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/frontmost", async (req, res) => {
  try {
    const name = await jxa("frontmostApp.js");
    res.json({ name });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Mac Remote läuft auf Port ${PORT}`);
  for (const ip of localIps()) {
    console.log(`  -> http://${ip}:${PORT}`);
  }
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    try {
      switch (msg.type) {
        case "playPause":
          await jxa("playPause.js");
          break;

        case "volume": {
          if (msg.direction === "mute") {
            await osaInline(
              "set volume output muted not (output muted of (get volume settings))"
            );
          }
          break;
        }

        case "setVolume": {
          const v = Math.max(0, Math.min(100, Math.round(msg.value)));
          await osaInline(`set volume output volume ${v}`);
          break;
        }

        case "key":
          await jxa("sendKey.js", [String(msg.code)]);
          break;

        case "openApp":
          await jxa("openApp.js", [msg.name]);
          break;

        case "quitApp":
          await jxa("quitApp.js", [msg.name]);
          break;

        case "systemPower":
          await jxa("systemPower.js", [msg.action]);
          break;

        case "openUrl": {
          await openUrl(msg.url);
          setTimeout(() => {
            jxa("positionFrontmost.js", [
              String(msg.screen ?? 0),
              msg.fullscreen ? "1" : "0",
            ]).catch((e) => console.error("positionFrontmost:", e));
          }, 1200);
          break;
        }

        case "typeText":
          await jxa("typeText.js", [msg.text || "", msg.enter ? "1" : "0"]);
          break;

        case "trackpadMove":
          await cliclick([`m:${signed(msg.dx)},${signed(msg.dy)}`]);
          break;

        case "trackpadDragStart":
          await cliclick(["dd:."]);
          break;

        case "trackpadDragMove":
          await cliclick([`m:${signed(msg.dx)},${signed(msg.dy)}`]);
          break;

        case "trackpadDragEnd":
          await cliclick(["du:."]);
          break;

        case "trackpadClick":
          await cliclick([msg.button === "right" ? "rc:." : "c:."]);
          break;

        case "scroll":
          await scroll(msg.dx, msg.dy);
          break;

        default:
          console.warn("Unbekannter Befehl:", msg.type);
      }
    } catch (e) {
      console.error("Fehler bei", msg.type, e);
    }
  });
});
