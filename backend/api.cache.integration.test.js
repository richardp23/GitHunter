/**
 * Redis cache integration tests for GET /api/user/:username
 * Uses real Redis (no cache mock), mocked GitHub API.
 * Skips all tests if Redis is unavailable (e.g. not running locally).
 *
 * Run: npm run test:cache:integration
 */
const request = require("supertest");

// Mock GitHub API so we don't hit real GitHub
const mockGet = jest.fn();
jest.mock("axios", () => ({
  create: () => ({ get: (...args) => mockGet(...args) }),
}));

// Do NOT mock cache - use real Redis
const { close } = require("./utils/cache");
const app = require("./index");

const TEST_USERNAME = "cache-integration-test";
const mockUser = {
  login: TEST_USERNAME,
  name: "Cache Test User",
  repos_url: "https://api.github.com/users/cache-integration-test/repos",
};
const mockRepos = [
  { name: "repo1", fork: false, language: "JavaScript", owner: { login: TEST_USERNAME } },
];

// Skip decision must happen at load time; beforeAll runs too late.
// Run with RUN_CACHE_TESTS=1 when Redis is up: RUN_CACHE_TESTS=1 npm run test:cache:integration
const redisAvailable = process.env.RUN_CACHE_TESTS === "1";

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
  await close();
});

const describeRedis = redisAvailable ? describe : describe.skip;
describeRedis("GET /api/user/:username - Redis cache (integration)", () => {
  it("cache miss: fetches from GitHub, then cache hit returns same report without GitHub call", async () => {
    // Clear cache for test user
    const Redis = require("ioredis");
    const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await client.del(`report:user:${TEST_USERNAME}`);
    await client.quit();

    mockGet.mockClear();

    // First request: cache miss -> fetches from GitHub
    const res1 = await request(app).get(`/api/user/${TEST_USERNAME}`);
    expect(res1.status).toBe(200);
    expect(res1.body.report.user.login).toBe(TEST_USERNAME);
    const githubCallsFirst = mockGet.mock.calls.length;
    expect(githubCallsFirst).toBeGreaterThan(0);

    mockGet.mockClear();

    // Second request: cache hit -> no GitHub call
    const res2 = await request(app).get(`/api/user/${TEST_USERNAME}`);
    expect(res2.status).toBe(200);
    expect(res2.body.report.user.login).toBe(TEST_USERNAME);
    expect(res2.body).toEqual(res1.body);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
