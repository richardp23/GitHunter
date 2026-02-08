/**
 * API tests for GET /api/user/:username
 * Two suites: REST fallback (cache miss) and Redis cache hit.
 * Uses mocked GitHub API and cache - no real network or Redis.
 */
const request = require("supertest");

// Mock axios before app loads
const mockGet = jest.fn();
jest.mock("axios", () => ({
  create: () => ({ get: (...args) => mockGet(...args) }),
}));

// Mock cache - return value configured per suite
const mockGetReport = jest.fn();
const mockSetReport = jest.fn();
jest.mock("./utils/cache", () => ({
  getReportByUsername: (...args) => mockGetReport(...args),
  setReportByUsername: (...args) => mockSetReport(...args),
}));

const app = require("./index");

const mockUser = {
  login: "torvalds",
  id: 1024025,
  avatar_url: "https://avatars.githubusercontent.com/u/1024025?v=4",
  html_url: "https://github.com/torvalds",
  name: "Linus Torvalds",
  company: "Linux Foundation",
  location: "Portland, OR",
  public_repos: 11,
  followers: 283195,
  repos_url: "https://api.github.com/users/torvalds/repos",
};

const mockRepos = [
  {
    name: "linux",
    full_name: "torvalds/linux",
    html_url: "https://github.com/torvalds/linux",
    description: "Linux kernel source tree",
    fork: false,
    language: "C",
    topics: [],
    stargazers_count: 216565,
    forks_count: 60359,
    open_issues_count: 3,
    created_at: "2011-09-04T22:48:12Z",
    updated_at: "2026-02-08T00:16:51Z",
    pushed_at: "2026-02-07T17:44:17Z",
    owner: { login: "torvalds" },
  },
  {
    name: "uemacs",
    full_name: "torvalds/uemacs",
    html_url: "https://github.com/torvalds/uemacs",
    description: "microemacs",
    fork: false,
    language: "C",
    topics: [],
    stargazers_count: 1865,
    forks_count: 296,
    open_issues_count: 7,
    created_at: "2018-01-17T22:32:21Z",
    updated_at: "2026-02-06T20:50:02Z",
    pushed_at: "2026-01-26T18:25:58Z",
    owner: { login: "torvalds" },
  },
  {
    name: "libgit2",
    full_name: "torvalds/libgit2",
    description: "libgit2 fork",
    fork: true,
    language: "C",
    stargazers_count: 333,
    owner: { login: "torvalds" },
  },
];

const mockCommits = Array(30).fill({ sha: "abc123", commit: { message: "fix" } });
const mockPulls = Array(10).fill({ number: 1, state: "closed" });

const cachedReport = {
  report: {
    user: { login: "torvalds", name: "Linus Torvalds" },
    repos: mockRepos,
    stats: {
      language: { C: 2 },
      commits: 30,
      pulls: 10,
      stars: 218430,
      fork_count: 1,
      user_forked_projects: 60359,
      watchers: 218430,
    },
  },
};

function setupGitHubMock() {
  mockGet.mockImplementation((url) => {
    if (url === "https://api.github.com/users/torvalds/repos") return Promise.resolve({ data: mockRepos });
    if (url.includes("/users/") && !url.includes("/repos")) return Promise.resolve({ data: { ...mockUser, repos_url: "https://api.github.com/users/torvalds/repos" } });
    if (url.includes("/repos/") && url.includes("/commits")) return Promise.resolve({ data: mockCommits });
    if (url.includes("/repos/") && url.includes("/pulls")) return Promise.resolve({ data: mockPulls });
    return Promise.reject(new Error(`Unknown URL: ${url}`));
  });
}

// -----------------------------------------------------------------------------
// Suite 1: REST fallback (cache miss / Redis unavailable)
// -----------------------------------------------------------------------------
describe("GET /api/user/:username - REST fallback (cache miss)", () => {
  beforeEach(() => {
    mockGetReport.mockResolvedValue(null);
    mockSetReport.mockResolvedValue(undefined);
    setupGitHubMock();
  });

  it("returns 200 and report with user, repos, stats for valid username", async () => {
    const res = await request(app).get("/api/user/torvalds");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("report");
    expect(res.body.report).toHaveProperty("user");
    expect(res.body.report).toHaveProperty("repos");
    expect(res.body.report).toHaveProperty("stats");
  });

  it("stats include language, commits, pulls", async () => {
    const res = await request(app).get("/api/user/torvalds");

    expect(res.body.report.stats).toHaveProperty("language");
    expect(res.body.report.stats).toHaveProperty("commits");
    expect(res.body.report.stats).toHaveProperty("pulls");
    expect(typeof res.body.report.stats.commits).toBe("number");
    expect(typeof res.body.report.stats.pulls).toBe("number");
  });

  it("stats.language is object mapping language to repo count", async () => {
    const res = await request(app).get("/api/user/torvalds");

    expect(res.body.report.stats.language).toBeDefined();
    expect(typeof res.body.report.stats.language).toBe("object");
    expect(res.body.report.stats.language.C).toBeGreaterThanOrEqual(1);
  });

  it("stats include stars, fork_count, user_forked_projects, watchers", async () => {
    const res = await request(app).get("/api/user/torvalds");

    expect(res.body.report.stats).toHaveProperty("stars");
    expect(res.body.report.stats).toHaveProperty("fork_count");
    expect(res.body.report.stats).toHaveProperty("user_forked_projects");
    expect(res.body.report.stats).toHaveProperty("watchers");
  });

  it("returns 500 and error message for nonexistent user", async () => {
    mockGet.mockRejectedValue(new Error("Not Found"));

    const res = await request(app).get("/api/user/nonexistent-user-xyz-12345");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });

  it("user object includes login and name", async () => {
    const res = await request(app).get("/api/user/torvalds");

    expect(res.body.report.user.login).toBe("torvalds");
    expect(res.body.report.user.name).toBe("Linus Torvalds");
  });

  it("repos is an array", async () => {
    const res = await request(app).get("/api/user/torvalds");

    expect(Array.isArray(res.body.report.repos)).toBe(true);
    expect(res.body.report.repos.length).toBeGreaterThan(0);
  });

  it("calls setReportByUsername after fetch on cache miss", async () => {
    await request(app).get("/api/user/torvalds");

    expect(mockSetReport).toHaveBeenCalledWith("torvalds", expect.objectContaining({ report: expect.any(Object) }));
  });
});

// -----------------------------------------------------------------------------
// Suite 2: Redis cache hit (cache returns report, no GitHub call)
// -----------------------------------------------------------------------------
describe("GET /api/user/:username - Redis cache hit", () => {
  beforeEach(() => {
    mockGetReport.mockResolvedValue(cachedReport);
    mockSetReport.mockResolvedValue(undefined);
    mockGet.mockReset();
  });

  it("returns cached report without calling GitHub", async () => {
    const res = await request(app).get("/api/user/torvalds");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedReport);
    expect(res.body.report.user.login).toBe("torvalds");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("does not call setReportByUsername on cache hit", async () => {
    mockSetReport.mockClear();
    await request(app).get("/api/user/torvalds");

    expect(mockSetReport).not.toHaveBeenCalled();
  });
});
