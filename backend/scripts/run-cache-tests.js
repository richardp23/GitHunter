#!/usr/bin/env node
process.env.RUN_CACHE_TESTS = "1";
require("child_process").execSync("node node_modules/jest/bin/jest.js api.cache.integration.test.js --forceExit", {
  stdio: "inherit",
  cwd: require("path").join(__dirname, ".."),
});
