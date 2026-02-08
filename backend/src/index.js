/**
 * GitHunter Backend - Express app
 * Routes: /api/user/:username, /api/analyze, /api/matchmaker
 * Requires: GITHUB_TOKEN (optional), REDIS_URL (optional, for cache)
 */

const express = require("express");
const cors = require("cors");
const { mountRoutes } = require("./routes");

const app = express();

app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));

mountRoutes(app);

module.exports = app;
