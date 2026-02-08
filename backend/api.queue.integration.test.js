/**
 * Integration tests for job queue API.
 * Requires Redis running (redis://localhost:6379).
 * Hits real GitHub API - rate limits apply.
 * Run: npm run test:queue:integration
 */
const request = require("supertest");
const Redis = require("ioredis");
const app = require("./index");

let redisAvailable = false;
beforeAll(async () => {
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  try {
    await redis.ping();
    redisAvailable = true;
  } catch {
    redisAvailable = false;
  } finally {
    redis.disconnect();
  }
});

const TEST_USER = "torvalds";
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 60000;

async function waitForComplete(jobId) {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const res = await request(app).get(`/api/status/${jobId}`);
    expect(res.status).toBe(200);
    const { status } = res.body;
    if (status === "complete") return res.body;
    if (status === "failed") throw new Error(res.body.error || "Job failed");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Timeout waiting for job");
}

describe("Job queue integration (requires Redis)", () => {
  it("POST /api/analyze creates job, worker processes it, report is cached", async () => {
    if (!redisAvailable) {
      console.warn("Skipping: Redis not available. Run Redis and try again.");
      return;
    }
    const addRes = await request(app).post("/api/analyze").send({ username: TEST_USER });
    expect(addRes.status).toBe(200);
    expect(addRes.body).toHaveProperty("jobId");
    const { jobId } = addRes.body;

    const statusRes = await waitForComplete(jobId);
    expect(statusRes.status).toBe("complete");
    expect(statusRes.report).toHaveProperty("report");
    expect(statusRes.report.report).toHaveProperty("user");
    expect(statusRes.report.report).toHaveProperty("repos");
    expect(statusRes.report.report).toHaveProperty("stats");
    expect(statusRes.report.report.user.login).toBe(TEST_USER);
  }, 70000);

  it("GET /api/report/:jobId returns cached report after job completes", async () => {
    if (!redisAvailable) {
      console.warn("Skipping: Redis not available. Run Redis and try again.");
      return;
    }
    const addRes = await request(app).post("/api/analyze").send({ username: TEST_USER });
    const { jobId } = addRes.body;
    await waitForComplete(jobId);

    const reportRes = await request(app).get(`/api/report/${jobId}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body).toHaveProperty("report");
    expect(reportRes.body.report.user.login).toBe(TEST_USER);
    expect(reportRes.body.report.stats).toHaveProperty("language");
    expect(reportRes.body.report.stats).toHaveProperty("commits");
    expect(reportRes.body.report.stats).toHaveProperty("pulls");
  }, 70000);
});
