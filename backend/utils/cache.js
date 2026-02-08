const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REPORT_TTL = parseInt(process.env.REPORT_CACHE_TTL || "3600", 10); // 1 hour default

let client = null;

function getClient() {
  if (!client) {
    client = new Redis(REDIS_URL);
  }
  return client;
}

async function setReport(jobId, report) {
  const c = getClient();
  const key = `report:${jobId}`;
  await c.setex(key, REPORT_TTL, JSON.stringify(report));
}

async function getReport(jobId) {
  const c = getClient();
  const key = `report:${jobId}`;
  const data = await c.get(key);
  return data ? JSON.parse(data) : null;
}

async function close() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = { setReport, getReport, getClient, close };
