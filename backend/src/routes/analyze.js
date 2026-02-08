const express = require("express");
const { analysisQueue } = require("../utils/queue");
const { getReportByJobId, getReportByUsername, getJobStatus, setJobStatus } = require("../utils/cache");

const router = express.Router();

/**
 * GET /api/analyze?username=torvalds
 * Start analysis from browser; redirects to status page for that job.
 */
router.get("/analyze", async (req, res) => {
  const username = (req.query?.username || "").trim();
  if (!username) {
    return res.status(400).send("Add ?username=... to the URL, e.g. /api/analyze?username=torvalds");
  }
  const view = req.query?.view === "developer" ? "developer" : "recruiter";

  try {
    const job = await analysisQueue.add({ username, view });
    const jobId = String(job.id);
    await setJobStatus(jobId, { status: "queued", progress: 0 });
    return res.redirect(302, `/api/status/${jobId}`);
  } catch (err) {
    console.error("Analyze enqueue error:", err);
    return res.status(500).send("Failed to start analysis");
  }
});

/**
 * POST /api/analyze
 * Body: { username, view?: "recruiter" | "developer" }
 * Returns { jobId }. Frontend polls GET /api/status/:jobId then GET /api/report/:jobId
 */
router.post("/analyze", async (req, res) => {
  const username = (req.body?.username || "").trim();
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }
  const view = req.body?.view === "developer" ? "developer" : "recruiter";

  try {
    const job = await analysisQueue.add({ username, view });
    const jobId = String(job.id);
    await setJobStatus(jobId, { status: "queued", progress: 0 });
    return res.status(202).json({ jobId });
  } catch (err) {
    console.error("Analyze enqueue error:", err);
    return res.status(500).json({ error: "Failed to start analysis" });
  }
});

/**
 * GET /api/status/:jobId
 * Returns { status, progress } (status: queued | processing | completed | failed)
 */
router.get("/status/:jobId", async (req, res) => {
  const jobId = (req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "jobId is required" });

  const statusPayload = await getJobStatus(jobId);
  if (!statusPayload) {
    return res.status(404).json({ error: "Job not found or expired" });
  }
  return res.json(statusPayload);
});

/**
 * GET /api/report/latest/:username
 * Returns latest full report for username (same shape as /api/report/:jobId). Use for PDF/PowerPoint when you have username only.
 */
router.get("/report/latest/:username", async (req, res) => {
  const username = (req.params.username || "").trim();
  if (!username) return res.status(400).json({ error: "username is required" });

  const report = await getReportByUsername(username);
  if (!report) {
    return res.status(404).json({ error: "No report found for this username. Run analysis first." });
  }
  return res.json(report);
});

/**
 * GET /api/report/:jobId
 * Returns full report when status is completed: report, scores, strengthsWeaknesses, technicalHighlights, improvementSuggestions, hiringRecommendation
 */
router.get("/report/:jobId", async (req, res) => {
  const jobId = (req.params.jobId || "").trim();
  if (!jobId) return res.status(400).json({ error: "jobId is required" });

  const statusPayload = await getJobStatus(jobId);
  if (!statusPayload) {
    return res.status(404).json({ error: "Job not found or expired" });
  }
  if (statusPayload.status !== "completed") {
    return res.status(202).json({ error: "Report not ready", status: statusPayload.status });
  }

  const report = await getReportByJobId(jobId);
  if (!report) {
    return res.status(404).json({ error: "Report not found" });
  }
  return res.json(report);
});

module.exports = router;
