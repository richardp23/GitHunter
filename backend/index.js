/**
 * GitHunter Backend - Express API server
 * Single route: GET /api/user/:username
 * Uses Redis cache when available; falls back to GitHub REST API if cache miss or Redis down.
 * Requires: GITHUB_TOKEN in .env (optional but recommended)
 * Optional: Redis (REDIS_URL) for caching - if unavailable, always fetches from GitHub
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { buildReport } = require("./services/githubService");
const { getReportByUsername, setReportByUsername } = require("./utils/cache");

const app = express();

// Parse JSON request bodies (for future routes)
app.use(express.json());

// Allow cross-origin requests from any origin (e.g. frontend on different port)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

// Only start HTTP server when this file is run directly (not when required by tests)
if (require.main === module) {
  app.listen(5000, () => { console.log("Server running on port 5000"); });
}

module.exports = app;

// -----------------------------------------------------------------------------
// SINGLE ROUTE - Cache-first, fallback to REST
// -----------------------------------------------------------------------------

/**
 * GET /api/user/:username
 * 1. If Redis is available: check cache for username. If hit, return cached report.
 * 2. If cache miss or Redis unavailable: fetch from GitHub REST API, build report.
 * 3. If Redis is available: cache the report for future requests.
 * 4. Return report.
 */
app.get("/api/user/:username", async (req, res) => {
  const username = req.params.username;
  console.log(`Request received for user: ${username}`);

  try {
    // 1. Try cache first (if Redis is listening)
    const cached = await getReportByUsername(username);
    if (cached) {
      console.log(`Cache hit for ${username}`);
      return res.json(cached);
    }

    // 2. Cache miss or Redis down - fetch from GitHub REST API
    const result = await buildReport(username);

    // 3. Cache for next time (if Redis is available)
    await setReportByUsername(username, result);

    // 4. Return
    res.json(result);
  } catch (err) {
    console.error("Full Error Info:", err.response ? err.response.data : err.message);
    res.status(500).json({ error: err.message });
  }
});
