/**
 * Integration tests for GET /api/user/:username
 * Hits the real GitHub API - requires network. Rate limits apply.
 * Update USERNAMES if usernames change or use different casing.
 */
const request = require("supertest");

// Mock queue and cache so index loads without Redis
jest.mock("./queue", () => ({ analysisQueue: { add: () => {}, getJob: () => {} } }));
jest.mock("./utils/cache", () => ({ getReport: () => null, setReport: () => {} }));

const app = require("./index");

const USERNAMES = ["torvalds", "richardp23", "JustinCracchiolo", "faizancodes"];

describe.each(USERNAMES)("GET /api/user/%s (integration)", (username) => {
  it("returns 200 and report with user, repos, stats", async () => {
    const res = await request(app).get(`/api/user/${username}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("report");
    expect(res.body.report).toHaveProperty("user");
    expect(res.body.report).toHaveProperty("repos");
    expect(res.body.report).toHaveProperty("stats");
  }, 15000);

  it("stats include language, commits, pulls", async () => {
    const res = await request(app).get(`/api/user/${username}`);

    expect(res.body.report.stats).toHaveProperty("language");
    expect(res.body.report.stats).toHaveProperty("commits");
    expect(res.body.report.stats).toHaveProperty("pulls");
    expect(typeof res.body.report.stats.commits).toBe("number");
    expect(typeof res.body.report.stats.pulls).toBe("number");
  }, 15000);

  it("stats.language is object mapping language to repo count", async () => {
    const res = await request(app).get(`/api/user/${username}`);

    expect(res.body.report.stats.language).toBeDefined();
    expect(typeof res.body.report.stats.language).toBe("object");
  }, 15000);

  it("stats include stars, fork_count, user_forked_projects, watchers", async () => {
    const res = await request(app).get(`/api/user/${username}`);

    expect(res.body.report.stats).toHaveProperty("stars");
    expect(res.body.report.stats).toHaveProperty("fork_count");
    expect(res.body.report.stats).toHaveProperty("user_forked_projects");
    expect(res.body.report.stats).toHaveProperty("watchers");
  }, 15000);

  it("user object includes login", async () => {
    const res = await request(app).get(`/api/user/${username}`);

    expect(res.body.report.user.login).toBe(username);
  }, 15000);

  it("repos is an array", async () => {
    const res = await request(app).get(`/api/user/${username}`);

    expect(Array.isArray(res.body.report.repos)).toBe(true);
  }, 15000);
});
