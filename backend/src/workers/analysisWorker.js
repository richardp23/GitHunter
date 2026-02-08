/**
 * Bull queue processor for long-running analysis jobs.
 * Optional: require this from server.js to start workers when running the app.
 * Alternatively run as a separate process for scale.
 */
const { analysisQueue } = require("../utils/queue");

// Queue is already processing in utils/queue.js.
// This file can hold job-specific logic or be the entry for a worker-only process.
module.exports = { analysisQueue };
