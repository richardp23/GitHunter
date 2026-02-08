/**
 * v2: Placeholder routes return 501 until implemented.
 * - POST /api/analyze
 * - GET /api/status/:jobId
 * - GET /api/report/:jobId
 * - GET /api/matchmaker
 */
const request = require("supertest");

jest.mock("../../src/utils/cache", () => ({
  getReportByUsername: () => null,
  setReportByUsername: () => {},
  init: () => Promise.resolve(false),
}));

const { app } = require("../../index");

describe("Placeholder routes (v2)", () => {
  it("POST /api/analyze returns 501 with message", async () => {
    const res = await request(app).post("/api/analyze").send({ username: "test", view: "recruiter" });

    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/not implemented/i);
  });

  it("GET /api/status/:jobId returns 501", async () => {
    const res = await request(app).get("/api/status/some-job-id");

    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/report/:jobId returns 501", async () => {
    const res = await request(app).get("/api/report/some-job-id");

    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/matchmaker returns 501 with message", async () => {
    const res = await request(app).get("/api/matchmaker").query({ role: "frontend", skills: "react" });

    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/matchmaker/i);
  });
});
