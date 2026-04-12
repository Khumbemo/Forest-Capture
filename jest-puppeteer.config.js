module.exports = {
  server: {
    command: 'npx serve -l 8080',
    port: 8080,
    launchTimeout: 10000,
    debug: true,
  },
  launch: {
    headless: true, // run invisibly
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
  },
};
