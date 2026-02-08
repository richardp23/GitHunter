const Queue = require("bull");
const { REDIS_URL } = require("../config/env");
const { setReportByJobId, setReportByUsername, setJobStatus } = require("./cache");
const { runAnalysis } = require("../services/analysisService");

const analysisQueue = new Queue("analysis", REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 100,
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

  await setReportByJobId(jobId, result);
  await setReportByUsername(username, result);
  await setJobStatus(jobId, { status: "completed", progress: 100 });
  await job.progress(100);

  return result;
});

analysisQueue.on("failed", (job, err) => {
  const jobId = job ? String(job.id) : null;
  if (jobId) setJobStatus(jobId, { status: "failed", progress: 0 }).catch(() => {});
  console.error(`Job ${jobId} failed:`, err?.message || err);
});

module.exports = { analysisQueue };
