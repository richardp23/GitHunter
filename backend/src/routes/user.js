const express = require("express");
const { buildReport } = require("../services/githubService");
const { getReportByUsername, setReportByUsername } = require("../utils/cache");

const router = express.Router();

/**
 * GET /api/user/:username
 * Cache-first, fallback to GitHub REST. Caches result when Redis is available.
 */
router.get("/:username", async (req, res) => {
  const username = req.params.username;
  console.log(`Request received for user: ${username}`);

  try {
    const cached = await getReportByUsername(username);
    if (cached) {
      console.log(`Cache hit for ${username}`);
      return res.json(cached);
    }

    const result = await buildReport(username);
    await setReportByUsername(username, result);
    res.json(result);
  } catch (err) {
    console.error("Full Error Info:", err.response ? err.response.data : err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
