/**
 * Redis cache integration tests for GET /api/user/:username (v1)
 * Uses real Redis (no cache mock), mocked GitHub API. Uses same entry point as server.
 * Skips all tests if Redis is unavailable or RUN_CACHE_TESTS not set.
 *
 * Run: npm run test:cache:integration  (sets RUN_CACHE_TESTS=1)
 */
const request = require("supertest");

const mockGet = jest.fn();
jest.mock("axios", () => ({
  create: () => ({ get: (...args) => mockGet(...args) }),
}));

const { app, bootstrap } = require("../../index");
const cache = require("../../src/utils/cache");
const { close, isRedisAvailable } = cache;

const TEST_USERNAME = "cache-integration-test";
const mockUser = {
  login: TEST_USERNAME,
  name: "Cache Test User",
  repos_url: "https://api.github.com/users/cache-integration-test/repos",
};
const mockRepos = [
  { name: "repo1", fork: false, language: "JavaScript", owner: { login: TEST_USERNAME } },
];

const redisRequested = process.env.RUN_CACHE_TESTS === "1";
let redisAvailable = false;

beforeAll(async () => {
  if (redisRequested) {
    await bootstrap();
    redisAvailable = isRedisAvailable();
  }
});

beforeEach(() => {
  mockGet.mockImplementation((url) => {
    if (url.includes(`/users/${TEST_USERNAME}`) && !url.includes("/repos")) {
      return Promise.resolve({ data: { ...mockUser, repos_url: `https://api.github.com/users/${TEST_USERNAME}/repos` } });
    }
    if (url.includes(`/users/${TEST_USERNAME}/repos`)) {
      return Promise.resolve({ data: mockRepos });
    }
    if (url.includes("/repos/") && url.includes("/commits")) return Promise.resolve({ data: [] });
    if (url.includes("/repos/") && url.includes("/pulls")) return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`Unknown URL: ${url}`));
  });
});

afterAll(async () => {
  await cache.close();
});

describe("GET /api/user/:username - Redis cache (integration)", () => {
  it("cache miss: fetches from GitHub, then cache hit returns same report without GitHub call", async function () {
    if (!redisRequested || !redisAvailable) {
      console.warn("Skipped: set RUN_CACHE_TESTS=1 and ensure Redis is running (REDIS_URL in .env).");
      return; // pass without running when Redis not requested or unavailable
    }
    const Redis = require("ioredis");
    const { REDIS_URL } = require("../../src/config/env");
    const client = new Redis(REDIS_URL || "redis://localhost:6379");
    await client.del(`report:user:${TEST_USERNAME}`);
    await client.quit();

    mockGet.mockClear();

    const res1 = await request(app).get(`/api/user/${TEST_USERNAME}`);
    expect(res1.status).toBe(200);
    expect(res1.body.report.user.login).toBe(TEST_USERNAME);
    const githubCallsFirst = mockGet.mock.calls.length;
    expect(githubCallsFirst).toBeGreaterThan(0);

    mockGet.mockClear();

    const res2 = await request(app).get(`/api/user/${TEST_USERNAME}`);
    expect(res2.status).toBe(200);
    expect(res2.body.report.user.login).toBe(TEST_USERNAME);
    expect(res2.body).toEqual(res1.body);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
