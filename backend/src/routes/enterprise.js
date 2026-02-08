const express = require("express");
const { getReportByUsername, setReportByUsername } = require("../utils/cache");
const { listArchived, getReport } = require("../services/archiveService");

const router = express.Router();

/**
 * GET /api/enterprise/list
 * Returns [{ username, score, avatar_url }] from Supabase. Empty array if unavailable or empty.
 */
router.get("/list", async (req, res) => {
  try {
    const list = await listArchived();
    return res.json(list);
  } catch (err) {
    console.error("[Enterprise] list error:", err?.message);
    return res.status(500).json({ error: "Failed to list archived reports" });
  }
});

/**
 * GET /api/enterprise/ensure/:username
 * If report is in Redis, return 200. Else load from Supabase, write to Redis, return 200. Else 404.
 */
router.get("/ensure/:username", async (req, res) => {
  const username = (req.params.username || "").trim();
  if (!username) return res.status(400).json({ error: "username is required" });

  try {
    const cached = await getReportByUsername(username);
    if (cached) return res.status(200).json({ ok: true });

    const report = await getReport(username);
    if (!report) return res.status(404).json({ error: "Report not found" });

    await setReportByUsername(username, report);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[Enterprise] ensure error for", username, ":", err?.message);
    return res.status(500).json({ error: "Failed to ensure report in cache" });
  }
});

module.exports = router;
