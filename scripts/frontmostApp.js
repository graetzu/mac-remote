function run(argv) {
  const se = Application("System Events");
  const front = se.processes.whose({ frontmost: true })[0];
  return front.name();
}
