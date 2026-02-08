const Queue = require("bull");
const { REDIS_URL } = require("../config/env");
const { buildReport } = require("../services/githubService");
const { setReportByUsername } = require("./cache");

const analysisQueue = new Queue("analysis", REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 100,
    attempts: 1,
  },
});

analysisQueue.process(async (job) => {
  const { username } = job.data;
  await job.updateProgress(10);
  const result = await buildReport(username);
  await job.updateProgress(90);
  await setReportByUsername(username, result);
  await job.updateProgress(100);
  return result;
});

analysisQueue.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

module.exports = { analysisQueue };
