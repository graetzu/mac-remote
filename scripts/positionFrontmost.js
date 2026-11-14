function run(argv) {
  const screenIndex = parseInt(argv[0], 10) || 0;
  const doFullscreen = argv[1] === "1";

  ObjC.import("AppKit");
  const screens = $.NSScreen.screens;
  const count = screens.count;
  const idx = Math.max(0, Math.min(screenIndex, count - 1));
  const mainFrame = screens.objectAtIndex(0).frame;
  const frame = screens.objectAtIndex(idx).frame;

  // NSScreen hat den Ursprung unten links; Accessibility-Koordinaten
  // (System Events) oben links bezogen auf den Hauptbildschirm.
  const axX = frame.origin.x;
  const axY = mainFrame.size.height - (frame.origin.y + frame.size.height);
  const w = frame.size.width;
  const h = frame.size.height;

  const se = Application("System Events");
  const front = se.processes.whose({ frontmost: true })[0];
  const win = front.windows[0];

  win.position = [axX, axY];
  win.size = [w, h];

  if (doFullscreen) {
    delay(0.4);
    se.keystroke("f", { using: ["command down", "control down"] });
  }
}
