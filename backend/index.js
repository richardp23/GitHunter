/**
 * GitHunter Backend - Express API server
 * Provides sync and async endpoints for GitHub profile analysis.
 * Requires: Redis (for queue + cache), GITHUB_TOKEN in .env (optional but recommended)
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { buildReport } = require("./services/githubService");
const { analysisQueue } = require("./queue");
const { getReport } = require("./utils/cache");

const app = express();

// Parse JSON request bodies (needed for POST /api/analyze)
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
// SYNC ROUTE - Fetches GitHub data immediately and returns (kept for backward compatibility)
// -----------------------------------------------------------------------------

/**
 * GET /api/user/:username
 * Fetches GitHub profile + repos + stats in a single request. Blocks until complete.
 * Use this for quick lookups or when you don't need the async queue flow.
 */
app.get("/api/user/:username", async (req, res) => {
  const username = req.params.username;
  console.log(`Request received for user: ${username}`);

  try {
    const result = await buildReport(username);
    res.json(result);
  } catch (err) {
    console.error("Full Error Info:", err.response ? err.response.data : err.message);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ASYNC JOB QUEUE ROUTES - Uses Bull + Redis for long-running analysis
// Flow: POST /api/analyze -> poll GET /api/status/:jobId -> GET /api/report/:jobId
// -----------------------------------------------------------------------------

/**
 * POST /api/analyze
 * Body: { username: string }
 * Creates a background job to fetch GitHub data. Returns jobId immediately.
 * Client should poll GET /api/status/:jobId until status is "complete", then fetch report.
 */
app.post("/api/analyze", async (req, res) => {
  const username = req.body?.username;
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username is required" });
  }

  try {
    const job = await analysisQueue.add({ username }, { jobId: undefined });
    res.json({ jobId: job.id.toString() });
  } catch (err) {
    console.error("Queue add failed:", err.message);
    res.status(503).json({ error: "Service unavailable" });
  }
});

/**
 * GET /api/status/:jobId
 * Returns job status and progress. If complete, includes the cached report.
 * Status values: "pending" | "processing" | "complete" | "failed"
 */
app.get("/api/status/:jobId", async (req, res) => {
  const { jobId } = req.params;
  if (!jobId) return res.status(400).json({ error: "jobId is required" });

  try {
    const job = await analysisQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job.progress();

    if (state === "completed") {
      const report = await getReport(jobId);
      return res.json({
        status: "complete",
        progress: 100,
        report: report ?? null
      });
    }

    if (state === "failed") {
      return res.json({
        status: "failed",
        progress: 0,
        error: job.failedReason || "Analysis failed"
      });
    }

    res.json({
      status: state === "active" ? "processing" : "pending",
      progress: typeof progress === "number" ? progress : 0
    });
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /api/report/:jobId
 * Returns the cached report for a completed job. Reports expire after REPORT_CACHE_TTL (default 1 hour).
 * Returns 202 if job is still processing; 404 if job not found or report expired.
 */
app.get("/api/report/:jobId", async (req, res) => {
  const { jobId } = req.params;
  if (!jobId) return res.status(400).json({ error: "jobId is required" });

  try {
    const report = await getReport(jobId);
    if (!report) {
      const job = await analysisQueue.getJob(jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      const state = await job.getState();
      if (state !== "completed") {
        return res.status(202).json({
          error: "Report not ready",
          status: state === "active" ? "processing" : "pending"
        });
      }
      return res.status(404).json({ error: "Report expired or not found" });
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Internal error" });
  }
});
