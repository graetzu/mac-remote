function run(argv) {
  const code = parseInt(argv[0], 10);
  Application("System Events").keyCode(code);
}
