require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { buildReport } = require("./services/githubService");
const { analysisQueue } = require("./queue");
const { getReport } = require("./utils/cache");

const app = express();

app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

if (require.main === module) {
  app.listen(5000, () => { console.log("Server running on port 5000"); });
}

module.exports = app;

// --- Sync route (kept for backward compatibility) ---
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

// --- Async job queue routes ---

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
