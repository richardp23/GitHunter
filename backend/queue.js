const Queue = require("bull");
const { buildReport } = require("./services/githubService");
const { setReport } = require("./utils/cache");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

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
  await setReport(job.id.toString(), result);
  await job.updateProgress(100);
  return result;
});

analysisQueue.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

module.exports = { analysisQueue };
