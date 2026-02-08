# Backend tests

All tests use the same **entry point** as the server: `require("../index")` or `require("../../index")` for `{ app, bootstrap }`. That keeps env (dotenv) and startup (Redis init) consistent with production.

## v1 suites (current)

| Suite | File | What it does |
|-------|------|---------------|
| **Unit** | `api.test.js` | Mocks axios + cache. Asserts GET /api/user/:username: cache miss → REST + set cache; cache hit → no GitHub, no set. Error (404) → 500 + error body. |
| **Integration** | `api.integration.test.js` | Real GitHub API, mocked cache. Runs `bootstrap()` in beforeAll. Asserts 200 + report shape for 4 usernames. Needs network + GITHUB_TOKEN in .env for rate limit. |
| **Cache integration** | `api.cache.integration.test.js` | Real Redis, mocked GitHub. Runs `bootstrap()` when RUN_CACHE_TESTS=1. One test: cache miss then hit, no second GitHub call. Run with `npm run test:cache:integration`. |

**Scripts:** `npm run test` (all), `npm run test:unit`, `npm run test:integration`, `npm run test:cache:integration`, `npm run test:v2`.

## v2 suites (broader cases)

| Suite | File | What it does |
|-------|------|---------------|
| **User route v2** | `v2/user.route.v2.test.js` | GitHub 404 → 500 + error body; GitHub 403 rate limit → 500 + error containing "rate limit"; empty username → 500. |
| **Placeholder routes** | `v2/placeholder-routes.v2.test.js` | POST /api/analyze, GET /api/status/:jobId, GET /api/report/:jobId, GET /api/matchmaker → 501 with error body. |
| **Redis v2** | `v2/redis.v2.test.js` | Bootstrap runs (real cache init); GET /api/user/:username still returns 200 with mocked GitHub (Redis up or down, cache-miss path works). |

Run v2 only: `npm run test:v2`. Run everything: `npm test` (includes v2).

## v2+ / future cases

- **Redis**: Connection lost at runtime → first error sets `redisAvailable = false`; could add test that simulates drop if possible.
- **User route**: Org vs user, private profile (when supported).
- **Analyze / matchmaker**: When implemented, add success and error paths.
- **Env**: Assert `isRedisAvailable()` false when REDIS_URL unreachable; skip or assert when GITHUB_TOKEN missing.
