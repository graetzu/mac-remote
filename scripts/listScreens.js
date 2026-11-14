function run(argv) {
  ObjC.import("AppKit");
  const screens = $.NSScreen.screens;
  const count = screens.count;
  const result = [];
  for (let i = 0; i < count; i++) {
    const f = screens.objectAtIndex(i).frame;
    result.push({
      index: i,
      width: f.size.width,
      height: f.size.height,
      main: i === 0,
    });
  }
  return JSON.stringify(result);
}
