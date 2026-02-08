/**
 * Central config from environment. Use these instead of process.env in app code
 * so defaults and validation live in one place.
 */
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REPORT_CACHE_TTL = parseInt(process.env.REPORT_CACHE_TTL || "3600", 10);
const PORT = parseInt(process.env.PORT || "5000", 10);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

module.exports = {
  REDIS_URL,
  REPORT_CACHE_TTL,
  PORT,
  GITHUB_TOKEN,
};
