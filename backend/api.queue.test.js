/**
 * Unit tests for job queue API (POST /api/analyze, GET /api/status/:jobId, GET /api/report/:jobId)
 * Mocks Bull queue and Redis cache - no real Redis required.
 */
const request = require("supertest");

const mockAdd = jest.fn();
const mockGetJob = jest.fn();
const mockGetReport = jest.fn();

jest.mock("./queue", () => ({
  analysisQueue: {
    add: (...args) => mockAdd(...args),
    getJob: (id) => mockGetJob(id),
  },
}));
jest.mock("./utils/cache", () => ({
  getReport: (id) => mockGetReport(id),
}));

const app = require("./index");

beforeEach(() => {
  mockAdd.mockReset();
  mockGetJob.mockReset();
  mockGetReport.mockReset();
});

describe("POST /api/analyze", () => {
  it("returns 400 when username is missing", async () => {
    const res = await request(app).post("/api/analyze").send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "username is required");
  });

  it("returns 400 when username is not a string", async () => {
    const res = await request(app).post("/api/analyze").send({ username: 123 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "username is required");
  });

  it("returns 200 and jobId when username is provided", async () => {
    mockAdd.mockResolvedValue({ id: "job-123" });

    const res = await request(app).post("/api/analyze").send({ username: "torvalds" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("jobId", "job-123");
    expect(mockAdd).toHaveBeenCalledWith({ username: "torvalds" }, expect.any(Object));
  });

  it("returns 503 when queue add fails", async () => {
    mockAdd.mockRejectedValue(new Error("Redis connection failed"));

    const res = await request(app).post("/api/analyze").send({ username: "torvalds" });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("error", "Service unavailable");
  });
});

describe("GET /api/status/:jobId", () => {
  it("returns 404 when job does not exist", async () => {
    mockGetJob.mockResolvedValue(null);

    const res = await request(app).get("/api/status/missing-job");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Job not found");
  });

  it("returns status pending when job is waiting", async () => {
    mockGetJob.mockResolvedValue({
      getState: () => Promise.resolve("waiting"),
      progress: () => 0,
    });

    const res = await request(app).get("/api/status/job-123");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "pending");
    expect(res.body).toHaveProperty("progress", 0);
  });

  it("returns status processing and progress when job is active", async () => {
    mockGetJob.mockResolvedValue({
      getState: () => Promise.resolve("active"),
      progress: () => 45,
    });

    const res = await request(app).get("/api/status/job-123");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "processing");
    expect(res.body).toHaveProperty("progress", 45);
  });

  it("returns status complete with report when job is completed", async () => {
    const cachedReport = { report: { user: { login: "torvalds" }, stats: {} } };
    mockGetJob.mockResolvedValue({
      getState: () => Promise.resolve("completed"),
      progress: () => 100,
      failedReason: null,
    });
    mockGetReport.mockResolvedValue(cachedReport);

    const res = await request(app).get("/api/status/job-123");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "complete");
    expect(res.body).toHaveProperty("progress", 100);
    expect(res.body).toHaveProperty("report", cachedReport);
  });

  it("returns status failed when job failed", async () => {
    mockGetJob.mockResolvedValue({
      getState: () => Promise.resolve("failed"),
      progress: () => 0,
      failedReason: "User not found",
    });

    const res = await request(app).get("/api/status/job-123");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "failed");
    expect(res.body).toHaveProperty("error", "User not found");
  });
});

describe("GET /api/report/:jobId", () => {
  it("returns cached report when available", async () => {
    const cachedReport = { report: { user: { login: "torvalds" }, repos: [], stats: {} } };
    mockGetReport.mockResolvedValue(cachedReport);

    const res = await request(app).get("/api/report/job-123");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedReport);
  });

  it("returns 404 when report not found and job does not exist", async () => {
    mockGetReport.mockResolvedValue(null);
    mockGetJob.mockResolvedValue(null);

    const res = await request(app).get("/api/report/job-123");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Job not found");
  });

  it("returns 202 when job exists but not yet complete", async () => {
    mockGetReport.mockResolvedValue(null);
    mockGetJob.mockResolvedValue({
      getState: () => Promise.resolve("active"),
    });

    const res = await request(app).get("/api/report/job-123");

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty("error", "Report not ready");
    expect(res.body).toHaveProperty("status", "processing");
  });
});
