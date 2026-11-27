module.exports = {
  preset: "jest-puppeteer",
  testMatch: ["**/tests/e2e.test.js", "**/tests/germplasm.test.js", "**/tests/invasive.test.js"],
  testTimeout: 30000
};
