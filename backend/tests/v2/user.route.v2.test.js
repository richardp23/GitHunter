/**
 * v2: User route broader cases.
 * - GitHub 404 (nonexistent user) → 500 + error body
 * - GitHub 403 rate limit → 500 + error body containing "rate limit"
 * - Empty username path → 500 or 404 (route still hit, GitHub will fail)
 */
const request = require("supertest");

const mockGet = jest.fn();
jest.mock("axios", () => ({
  create: () => ({ get: (...args) => mockGet(...args) }),
}));

const mockGetReport = jest.fn();
const mockSetReport = jest.fn();
jest.mock("../../src/utils/cache", () => ({
  getReportByUsername: (...args) => mockGetReport(...args),
  setReportByUsername: (...args) => mockSetReport(...args),
  init: () => Promise.resolve(false),
}));

const { app } = require("../../index");

beforeEach(() => {
  mockGetReport.mockResolvedValue(null);
  mockSetReport.mockResolvedValue(undefined);
});

describe("GET /api/user/:username (v2 – error cases)", () => {
  it("returns 500 and error body when GitHub returns 404 (user not found)", async () => {
    mockGet.mockRejectedValue(Object.assign(new Error("Not Found"), { response: { status: 404, data: { message: "Not Found" } } }));

    const res = await request(app).get("/api/user/nonexistent-user-xyz-404");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toBeTruthy();
  });

  it("returns 500 and error body mentioning rate limit when GitHub returns 403 rate limit", async () => {
    const rateLimitMessage = "API rate limit exceeded for 1.2.3.4. (But here's the good news: Authenticated requests get a higher rate limit.)";
    mockGet.mockRejectedValue(
      Object.assign(new Error(rateLimitMessage), {
        response: { status: 403, data: { message: rateLimitMessage, documentation_url: "https://docs.github.com/..." } },
      })
    );

    const res = await request(app).get("/api/user/anyuser");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
    expect(String(res.body.error).toLowerCase()).toMatch(/rate limit/);
  });

  it("returns 404 or 500 when path has no username (Express may not match /api/user/)", async () => {
    mockGet.mockRejectedValue(new Error("Not Found"));

    const res = await request(app).get("/api/user/");

    // Express can return 404 (route not matched) or 500 (route matched, GitHub fails)
    expect([404, 500]).toContain(res.status);
    if (res.status === 500) expect(res.body).toHaveProperty("error");
  });
});
