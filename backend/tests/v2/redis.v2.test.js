/**
 * v2: Redis unavailable at startup.
 * Bootstrap runs (Redis may or may not connect); GET /api/user/:username still returns 200
 * when cache misses and GitHub is mocked (app does not crash, cache-miss path works).
 */
const request = require("supertest");

const mockGet = jest.fn();
jest.mock("axios", () => ({
  create: () => ({ get: (...args) => mockGet(...args) }),
}));

// Real cache (no mock) so bootstrap() runs real init(); we don't require Redis to be up
const { app, bootstrap } = require("../../index");

const TEST_USER = "redis-v2-test-user";
const mockUser = {
  login: TEST_USER,
  name: "Redis V2 Test",
  repos_url: `https://api.github.com/users/${TEST_USER}/repos`,
};
const mockRepos = [{ name: "r1", fork: false, language: "JS", owner: { login: TEST_USER } }];

beforeAll(async () => {
  await bootstrap();
});

beforeEach(() => {
  mockGet.mockImplementation((url) => {
    if (url.includes(`/users/${TEST_USER}`) && !url.includes("/repos")) {
      return Promise.resolve({ data: { ...mockUser, repos_url: `https://api.github.com/users/${TEST_USER}/repos` } });
    }
    if (url.includes(`/users/${TEST_USER}/repos`)) return Promise.resolve({ data: mockRepos });
    if (url.includes("/repos/") && url.includes("/commits")) return Promise.resolve({ data: [] });
    if (url.includes("/repos/") && url.includes("/pulls")) return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`Unknown URL: ${url}`));
  });
});

afterAll(async () => {
  const cache = require("../../src/utils/cache");
  await cache.close();
});

describe("Redis unavailable at startup (v2)", () => {
  it("GET /api/user/:username still returns 200 when cache miss (bootstrap ran, Redis may be down)", async () => {
    const res = await request(app).get(`/api/user/${TEST_USER}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("report");
    expect(res.body.report).toHaveProperty("user");
    expect(res.body.report.user.login).toBe(TEST_USER);
    expect(res.body.report).toHaveProperty("repos");
    expect(res.body.report).toHaveProperty("stats");
  });
});
