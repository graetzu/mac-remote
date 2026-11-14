function run(argv) {
  const vCount = parseInt(argv[0], 10) || 0;
  const vCode = parseInt(argv[1], 10); // 126 = Pfeil hoch, 125 = Pfeil runter
  const hCount = parseInt(argv[2], 10) || 0;
  const hCode = parseInt(argv[3], 10); // 123 = Pfeil links, 124 = Pfeil rechts

  const se = Application("System Events");
  for (let i = 0; i < vCount; i++) se.keyCode(vCode);
  for (let i = 0; i < hCount; i++) se.keyCode(hCode);
}
