function run(argv) {
  const se = Application("System Events");
  const procs = se.processes.whose({ backgroundOnly: false });
  const names = procs.name();
  const unique = [...new Set(names)].filter((n) => n !== "MacRemote");
  return JSON.stringify(unique);
}
