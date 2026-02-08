/**
 * Single entry point for server and tests.
 * - When run directly: loads env, runs bootstrap (Redis init), then starts HTTP server.
 * - When required by tests: exports { app, bootstrap }. Tests call bootstrap() when they need env/Redis.
 */
require("dotenv").config();

const app = require("./src");
const { PORT } = require("./src/config/env");
const { init: initCache } = require("./src/utils/cache");

async function bootstrap() {
  await initCache();
}

if (require.main === module) {
  bootstrap().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

module.exports = { app, bootstrap };
