function run(argv) {
  const text = argv[0] || "";
  const sendReturn = argv[1] === "1";
  const se = Application("System Events");
  se.keystroke(text);
  if (sendReturn) {
    se.keyCode(36); // Return
  }
}
