const Queue = require("bull");
const { REDIS_URL, SLIDES_CLEANUP_DELAY_MS } = require("../config/env");
const { setReportByJobId, setReportByUsername, setJobStatus } = require("./cache");
const { runAnalysis } = require("../services/analysisService");
const { deletePresentation } = require("../services/slidesService");
const { saveReport: archiveSaveReport } = require("../services/archiveService");

const analysisQueue = new Queue("analysis", REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 100,
    attempts: 1,
  },
});

const cleanupQueue = new Queue("slides-cleanup", REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 200,
    attempts: 1,
  },
});

analysisQueue.process(async (job) => {
  const jobId = String(job.id);
  const { username, view = "recruiter" } = job.data;

  await setJobStatus(jobId, { status: "processing", progress: 5 });
  await job.progress(5);

  const result = await runAnalysis(username, view, { useClone: false });
  await job.progress(85);

  // Use canonical login from GitHub API (report.user.login) for Redis key.
  // Frontend uses this for PDF download; Redis keys are case-sensitive, so "Brianmf7" vs "brianmf7" would miss.
  const canonicalUsername = result.report?.user?.login || username;
  if (canonicalUsername !== username) {
    console.log("[Analysis] Job", jobId, "username mismatch: input", username, "-> canonical", canonicalUsername);
  }
  console.log("[Analysis] Job", jobId, "saving report to Redis for", canonicalUsername);

  await setReportByJobId(jobId, result);
  await setReportByUsername(canonicalUsername, result);
  await archiveSaveReport(canonicalUsername, result);
  await setJobStatus(jobId, { status: "completed", progress: 100 });
  await job.progress(100);

  return result;
});

analysisQueue.on("failed", (job, err) => {
  const jobId = job ? String(job.id) : null;
  if (jobId) setJobStatus(jobId, { status: "failed", progress: 0 }).catch(() => {});
  console.error(`Job ${jobId} failed:`, err?.message || err);
});

cleanupQueue.process(async (job) => {
  const { presentationId } = job.data || {};
  if (presentationId) await deletePresentation(presentationId);
});

module.exports = { analysisQueue, cleanupQueue };
