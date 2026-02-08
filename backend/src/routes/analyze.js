const express = require("express");
// const { analysisQueue } = require("../utils/queue");
// const { getReportByJobId } = require("../utils/cache"); // when job-based cache exists

const router = express.Router();

/**
 * POST /api/analyze
 * Body: { username, view: "recruiter" | "developer" }
 * Returns jobId; frontend polls GET /api/status/:jobId then GET /api/report/:jobId
 * Placeholder until queue + job-based cache are wired.
 */
router.post("/analyze", (req, res) => {
  res.status(501).json({ error: "Not implemented yet. Use GET /api/user/:username for now." });
});

/**
 * GET /api/status/:jobId
 * Placeholder.
 */
router.get("/status/:jobId", (req, res) => {
  res.status(501).json({ error: "Not implemented yet." });
});

/**
 * GET /api/report/:jobId
 * Placeholder.
 */
router.get("/report/:jobId", (req, res) => {
  res.status(501).json({ error: "Not implemented yet." });
});

module.exports = router;
