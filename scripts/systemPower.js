function run(argv) {
  const action = argv[0];
  const se = Application("System Events");
  if (action === "sleep") se.sleep();
  else if (action === "restart") se.restart();
  else if (action === "shutdown") se.shutDown();
  else if (action === "logout") se.logOut();
}
