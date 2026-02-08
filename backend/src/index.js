/**
 * GitHunter Backend - Express app
 * Routes: /api/user/:username, /api/analyze, /api/matchmaker
 * Requires: GITHUB_TOKEN (optional), REDIS_URL (optional, for cache)
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { mountRoutes } = require("./routes");

const app = express();

app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));

const publicDir = path.join(__dirname, "..", "public");
const hasPublic = fs.existsSync(publicDir);
const hasIndex = hasPublic && fs.existsSync(path.join(publicDir, "index.html"));

// Health check for Railway and load balancers; serve index if frontend is in public
app.get("/", (req, res) => {
  if (hasIndex) return res.sendFile(path.join(publicDir, "index.html"));
  res.json({ ok: true, service: "git-hunter-api" });
});

if (hasPublic) app.use(express.static(publicDir));

mountRoutes(app);

module.exports = app;
