const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REPORT_TTL = parseInt(process.env.REPORT_CACHE_TTL || "3600", 10); // 1 hour default

let client = null;

function getClient() {
  if (!client) {
    client = new Redis(REDIS_URL, {
      retryStrategy: (times) => {
        if (times >= 3) return null; // Stop after 3 retries
        return 1000; // Retry every second
      },
      maxRetriesPerRequest: 3,
    });

    client.on("error", (err) => {
      throw new Error("Redis unavailable, falling back to REST.");
    });
  }
  return client;
}

/**
 * Get cached report by username. Returns null if Redis unavailable or cache miss.
 */
async function getReportByUsername(username) {
  try {
    const c = getClient();
    const key = `report:user:${username}`;
    const data = await c.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    // Redis unavailable - fallback to REST
    return null;
  }
}

/**
 * Cache report by username. No-op if Redis unavailable.
 */
async function setReportByUsername(username, report) {
  try {
    const c = getClient();
    const key = `report:user:${username}`;
    await c.setex(key, REPORT_TTL, JSON.stringify(report));
  } catch (err) {
    // Redis unavailable - skip cache, report still returned
  }
}

async function close() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = { getReportByUsername, setReportByUsername, getClient, close };
