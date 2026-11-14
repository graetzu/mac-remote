const statusEl = document.getElementById("status");
let ws;
let wsOpen = false;

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    wsOpen = true;
    statusEl.textContent = "verbunden";
    statusEl.className = "status ok";
  };
  ws.onclose = () => {
    wsOpen = false;
    statusEl.textContent = "getrennt – erneuter Versuch…";
    statusEl.className = "status err";
    setTimeout(connect, 1500);
  };
  ws.onerror = () => {
    statusEl.textContent = "Verbindungsfehler";
    statusEl.className = "status err";
  };
}
connect();

function send(msg) {
  if (wsOpen) ws.send(JSON.stringify(msg));
}

// Tabs
document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  };
});

// Medien
document.getElementById("playPause").onclick = () => send({ type: "playPause" });
document.getElementById("mute").onclick = () => send({ type: "volume", direction: "mute" });
document.getElementById("seekBack").onclick = () => send({ type: "key", code: 123 }); // Pfeil links
document.getElementById("seekFwd").onclick = () => send({ type: "key", code: 124 }); // Pfeil rechts

// Lautstärke-Slider
const volumeSlider = document.getElementById("volumeSlider");
let sliderBeingDragged = false;

volumeSlider.addEventListener("input", () => {
  sliderBeingDragged = true;
  send({ type: "setVolume", value: parseInt(volumeSlider.value, 10) });
});
volumeSlider.addEventListener("change", () => {
  setTimeout(() => (sliderBeingDragged = false), 500);
});

function pollVolume() {
  if (sliderBeingDragged) return;
  fetch("/api/volume")
    .then((r) => r.json())
    .then((v) => {
      if (!sliderBeingDragged) volumeSlider.value = v.volume;
    })
    .catch(() => {});
}
setInterval(pollVolume, 2000);
pollVolume();

// Fokus-App-Anzeige
const frontAppEl = document.getElementById("frontApp");
function pollFrontmost() {
  fetch("/api/frontmost")
    .then((r) => r.json())
    .then((d) => (frontAppEl.textContent = d.name || "–"))
    .catch(() => {});
}
setInterval(pollFrontmost, 2000);
pollFrontmost();

// Bildschirme laden
const screenSelect = document.getElementById("screenSelect");
fetch("/api/screens")
  .then((r) => r.json())
  .then((screens) => {
    screenSelect.innerHTML = "";
    screens.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.index;
      opt.textContent = `${s.index + 1}${s.main ? " (Haupt)" : ""} – ${s.width}x${s.height}`;
      screenSelect.appendChild(opt);
    });
  })
  .catch(() => {
    screenSelect.innerHTML = '<option value="0">1</option>';
  });

// Shortcuts
const shortcutButtonsEl = document.getElementById("shortcutButtons");
const shortcutEditorEl = document.getElementById("shortcutEditor");
const shortcutRowsEl = document.getElementById("shortcutRows");
const editShortcutsBtn = document.getElementById("editShortcuts");
let currentShortcuts = [];

function renderShortcutButtons() {
  shortcutButtonsEl.innerHTML = "";
  currentShortcuts.forEach((s) => {
    const btn = document.createElement("button");
    btn.textContent = s.label;
    btn.onclick = () => {
      if (s.type === "app") {
        send({ type: "openApp", name: s.value });
      } else {
        send({
          type: "openUrl",
          url: s.value,
          screen: parseInt(screenSelect.value || "0", 10),
          fullscreen: true,
        });
      }
    };
    shortcutButtonsEl.appendChild(btn);
  });
}

function renderShortcutRows() {
  shortcutRowsEl.innerHTML = "";
  currentShortcuts.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "shortcutRow";
    row.innerHTML = `
      <input type="text" class="scLabel" placeholder="Name" value="${escapeAttr(s.label)}">
      <select class="scType">
        <option value="app"${s.type === "app" ? " selected" : ""}>App</option>
        <option value="url"${s.type === "url" ? " selected" : ""}>Website</option>
      </select>
      <input type="text" class="scValue" placeholder="App-Name oder URL" value="${escapeAttr(s.value)}">
      <button class="scRemove">✕</button>
    `;
    row.querySelector(".scLabel").oninput = (e) => (s.label = e.target.value);
    row.querySelector(".scType").onchange = (e) => (s.type = e.target.value);
    row.querySelector(".scValue").oninput = (e) => (s.value = e.target.value);
    row.querySelector(".scRemove").onclick = () => {
      currentShortcuts = currentShortcuts.filter((x) => x !== s);
      renderShortcutRows();
    };
    shortcutRowsEl.appendChild(row);
  });
}

function escapeAttr(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML.replace(/"/g, "&quot;");
}

function loadShortcuts() {
  fetch("/api/shortcuts")
    .then((r) => r.json())
    .then((list) => {
      currentShortcuts = list;
      renderShortcutButtons();
    })
    .catch(() => {
      shortcutButtonsEl.textContent = "Fehler beim Laden";
    });
}
loadShortcuts();

editShortcutsBtn.onclick = () => {
  renderShortcutRows();
  shortcutButtonsEl.classList.add("hidden");
  shortcutEditorEl.classList.remove("hidden");
};

document.getElementById("addShortcutRow").onclick = () => {
  currentShortcuts.push({ id: `sc${Date.now()}`, label: "", type: "app", value: "" });
  renderShortcutRows();
};

document.getElementById("cancelShortcuts").onclick = () => {
  shortcutEditorEl.classList.add("hidden");
  shortcutButtonsEl.classList.remove("hidden");
  loadShortcuts();
};

document.getElementById("saveShortcuts").onclick = () => {
  const cleaned = currentShortcuts.filter((s) => s.label.trim() && s.value.trim());
  fetch("/api/shortcuts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleaned),
  })
    .then((r) => r.json())
    .then(() => {
      currentShortcuts = cleaned;
      renderShortcutButtons();
      shortcutEditorEl.classList.add("hidden");
      shortcutButtonsEl.classList.remove("hidden");
    })
    .catch(() => alert("Speichern fehlgeschlagen"));
};

// Texteingabe
document.getElementById("sendText").onclick = () => {
  const el = document.getElementById("textInput");
  send({ type: "typeText", text: el.value, enter: false });
  el.value = "";
};
document.getElementById("sendTextEnter").onclick = () => {
  const el = document.getElementById("textInput");
  send({ type: "typeText", text: el.value, enter: true });
  el.value = "";
};

// Trackpad
const trackpad = document.getElementById("trackpad");
const SENSITIVITY = 1.6;
const SCROLL_SENSITIVITY = 1.2;
const LONG_PRESS_MS = 350;
const MOVE_THRESHOLD = 4;

let mode = null; // "one" | "two"
let last = null; // letzter Mittelpunkt
let totalMove = 0;
let dragging = false;
let longPressTimer = null;

// gepuffertes Scrollen, damit nicht jedes einzelne Touch-Event einen
// eigenen (langsamen) Prozessaufruf auslöst
let scrollAccX = 0;
let scrollAccY = 0;
let scrollFlushTimer = null;
function queueScroll(dx, dy) {
  scrollAccX += dx;
  scrollAccY += dy;
  if (!scrollFlushTimer) {
    scrollFlushTimer = setInterval(() => {
      if (scrollAccX !== 0 || scrollAccY !== 0) {
        send({ type: "scroll", dx: scrollAccX, dy: scrollAccY });
        scrollAccX = 0;
        scrollAccY = 0;
      }
    }, 150);
  }
}
function stopScrollFlush() {
  if (scrollFlushTimer) {
    clearInterval(scrollFlushTimer);
    scrollFlushTimer = null;
  }
  scrollAccX = 0;
  scrollAccY = 0;
}

function midpoint(touches) {
  if (touches.length === 1) return { x: touches[0].clientX, y: touches[0].clientY };
  const x = (touches[0].clientX + touches[1].clientX) / 2;
  const y = (touches[0].clientY + touches[1].clientY) / 2;
  return { x, y };
}

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

trackpad.addEventListener("touchstart", (e) => {
  e.preventDefault();
  mode = e.touches.length >= 2 ? "two" : "one";
  last = midpoint(e.touches);
  totalMove = 0;
  dragging = false;

  if (mode === "one") {
    clearLongPress();
    longPressTimer = setTimeout(() => {
      dragging = true;
      send({ type: "trackpadDragStart" });
    }, LONG_PRESS_MS);
  }
}, { passive: false });

trackpad.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const p = midpoint(e.touches);
  const dx = (p.x - last.x) * SENSITIVITY;
  const dy = (p.y - last.y) * SENSITIVITY;
  last = p;

  if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return;
  totalMove += Math.abs(dx) + Math.abs(dy);

  if (mode === "two") {
    if (totalMove > MOVE_THRESHOLD) {
      queueScroll(dx * SCROLL_SENSITIVITY, dy * SCROLL_SENSITIVITY);
    }
  } else {
    if (totalMove > MOVE_THRESHOLD) clearLongPress();
    if (dragging) {
      send({ type: "trackpadDragMove", dx, dy });
    } else {
      send({ type: "trackpadMove", dx, dy });
    }
  }
}, { passive: false });

trackpad.addEventListener("touchend", (e) => {
  e.preventDefault();
  clearLongPress();
  stopScrollFlush();

  if (mode === "two") {
    if (totalMove <= MOVE_THRESHOLD) {
      send({ type: "trackpadClick", button: "right" });
    }
  } else {
    if (dragging) {
      send({ type: "trackpadDragEnd" });
    } else if (totalMove <= MOVE_THRESHOLD) {
      send({ type: "trackpadClick", button: "left" });
    }
  }
  mode = null;
  dragging = false;
  last = null;
}, { passive: false });

document.getElementById("leftClick").onclick = () => send({ type: "trackpadClick", button: "left" });
document.getElementById("rightClick").onclick = () => send({ type: "trackpadClick", button: "right" });

// Apps: Fokus wechseln / beenden
const appListEl = document.getElementById("appList");
function loadApps() {
  fetch("/api/apps")
    .then((r) => r.json())
    .then((apps) => {
      appListEl.innerHTML = "";
      apps.sort((a, b) => a.localeCompare(b)).forEach((name) => {
        const row = document.createElement("div");
        row.className = "appRow";

        const nameBtn = document.createElement("button");
        nameBtn.className = "appName";
        nameBtn.textContent = name;
        nameBtn.onclick = () => send({ type: "openApp", name });

        const quitBtn = document.createElement("button");
        quitBtn.className = "appQuit";
        quitBtn.textContent = "✕";
        quitBtn.onclick = () => send({ type: "quitApp", name });

        row.appendChild(nameBtn);
        row.appendChild(quitBtn);
        appListEl.appendChild(row);
      });
    })
    .catch(() => {
      appListEl.textContent = "Fehler beim Laden";
    });
}
document.querySelector('[data-tab="apps"]').addEventListener("click", loadApps);

// System
function confirmedSystemAction(action, label) {
  if (confirm(`Mac wirklich ${label}?`)) {
    send({ type: "systemPower", action });
  }
}
document.getElementById("sysSleep").onclick = () => confirmedSystemAction("sleep", "in den Schlaf schicken");
document.getElementById("sysRestart").onclick = () => confirmedSystemAction("restart", "neu starten");
document.getElementById("sysShutdown").onclick = () => confirmedSystemAction("shutdown", "herunterfahren");
document.getElementById("sysLogout").onclick = () => confirmedSystemAction("logout", "abmelden");

// D-Pad & Sondertasten (alle Buttons mit data-key)
document.querySelectorAll("[data-key]").forEach((btn) => {
  btn.onclick = () => send({ type: "key", code: parseInt(btn.dataset.key, 10) });
});
