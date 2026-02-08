const Redis = require("ioredis");
const { REDIS_URL, REPORT_CACHE_TTL } = require("../config/env");

const STARTUP_CONNECT_TIMEOUT_MS = 3000;

let client = null;
/** True only after a successful init() ping. False if startup check failed or connection was lost. */
let redisAvailable = false;

function getClient() {
  return client;
}

/**
 * Try to connect to Redis at startup. Call once from the entry point.
 * Sets redisAvailable so request handlers can skip cache without touching Redis when no instance exists.
 */
async function init() {
  if (client) {
    return redisAvailable;
  }
  const c = new Redis(REDIS_URL, {
    connectTimeout: STARTUP_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    await c.ping();
    client = c;
    redisAvailable = true;
    client.on("error", (err) => {
      redisAvailable = false;
      console.error("Redis connection lost (using REST fallback):", err.message || err);
    });
    console.log("Redis connected (cache enabled).");
    return true;
  } catch (err) {
    await c.quit().catch(() => {});
    client = null;
    redisAvailable = false;
    console.log("Redis not available at startup (cache disabled). Using REST fallback.");
    return false;
  }
}

/**
 * Get cached report by username. Returns null if Redis unavailable or cache miss.
 * Skips Redis entirely when startup check failed; only uses try/catch for connection loss.
 */
async function getReportByUsername(username) {
  if (!redisAvailable) {
    console.log("[Redis] getReportByUsername: Redis unavailable, skipping lookup for", username);
    return null;
  }
  const c = getClient();
  if (!c) return null;
  try {
    const key = `report:user:${username}`;
    const data = await c.get(key);
    const found = !!data;
    console.log("[Redis] getReportByUsername:", username, "key:", key, "found:", found);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    redisAvailable = false;
    console.error("[Redis] getReportByUsername error for", username, ":", err?.message);
    return null;
  }
}

/**
 * Cache report by username. No-op if Redis unavailable.
 */
async function setReportByUsername(username, report) {
  if (!redisAvailable) {
    console.log("[Redis] setReportByUsername: Redis unavailable, skipping save for", username);
    return;
  }
  const c = getClient();
  if (!c) return;
  try {
    const key = `report:user:${username}`;
    await c.setex(key, REPORT_CACHE_TTL, JSON.stringify(report));
    console.log("[Redis] setReportByUsername: saved report for", username, "key:", key, "TTL:", REPORT_CACHE_TTL, "s");
  } catch (err) {
    redisAvailable = false;
    console.error("[Redis] setReportByUsername error for", username, ":", err?.message);
  }
}

const JOB_STATUS_TTL = 86400; // 24h for job status/report

/**
 * Set job status. { status: 'queued'|'processing'|'completed'|'failed', progress?: 0-100 }
 */
async function setJobStatus(jobId, statusPayload) {
  if (!redisAvailable) return;
  const c = getClient();
  if (!c) return;
  try {
    const key = `report:job:${jobId}:status`;
    await c.setex(key, JOB_STATUS_TTL, JSON.stringify(statusPayload));
  } catch (err) {
    redisAvailable = false;
  }
}

/**
 * Get job status. Returns null if miss or Redis unavailable.
 */
async function getJobStatus(jobId) {
  if (!redisAvailable) return null;
  const c = getClient();
  if (!c) return null;
  try {
    const key = `report:job:${jobId}:status`;
    const data = await c.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    redisAvailable = false;
    return null;
  }
}

/**
 * Cache full report by jobId (when analysis completed).
 */
async function setReportByJobId(jobId, report) {
  if (!redisAvailable) return;
  const c = getClient();
  if (!c) return;
  try {
    const key = `report:job:${jobId}`;
    await c.setex(key, REPORT_CACHE_TTL, JSON.stringify(report));
  } catch (err) {
    redisAvailable = false;
  }
}

/**
 * Get cached report by jobId. Returns null if miss or Redis unavailable.
 */
async function getReportByJobId(jobId) {
  if (!redisAvailable) return null;
  const c = getClient();
  if (!c) return null;
  try {
    const key = `report:job:${jobId}`;
    const data = await c.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    redisAvailable = false;
    return null;
  }
}

async function close() {
  if (client) {
    await client.quit();
    client = null;
  }
  redisAvailable = false;
}

function isRedisAvailable() {
  return redisAvailable;
}

module.exports = {
  init,
  getReportByUsername,
  setReportByUsername,
  setJobStatus,
  getJobStatus,
  setReportByJobId,
  getReportByJobId,
  getClient,
  close,
  isRedisAvailable,
};
