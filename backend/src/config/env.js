/**
 * Central config from environment. Use these instead of process.env in app code
 * so defaults and validation live in one place.
 */
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REPORT_CACHE_TTL = parseInt(process.env.REPORT_CACHE_TTL || "3600", 10);
const PORT = parseInt(process.env.PORT || "5000", 10);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
/** Path to service account JSON file, or leave empty if using GOOGLE_SERVICE_ACCOUNT_JSON. */
const GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
/** Inline service account JSON string (optional; used when file path is not available). */
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
/** Optional Google Slides template file ID (Drive). If set, clone template then fill; otherwise create blank. */
const SLIDES_TEMPLATE_ID = (process.env.SLIDES_TEMPLATE_ID || "").trim();
/** Optional Drive folder or Shared Drive ID. When using impersonation (SLIDES_IMPERSONATE_EMAIL), files use that user's quota; folder is optional. */
const SLIDES_DRIVE_FOLDER_ID = (process.env.SLIDES_DRIVE_FOLDER_ID || "").trim();
/** Optional Google Workspace user email for domain-wide delegation. When set, the service account acts as this user and files use their Drive quota. Requires Workspace admin to grant the SA's Client ID the Drive/Slides scopes. */
const SLIDES_IMPERSONATE_EMAIL = (process.env.SLIDES_IMPERSONATE_EMAIL || "").trim();
/** OAuth: use a user's Drive quota (no Workspace needed). Set with GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN. Get the refresh token once via scripts/obtain-google-oauth-token.js */
const GOOGLE_OAUTH_CLIENT_ID = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
const GOOGLE_OAUTH_CLIENT_SECRET = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
const GOOGLE_OAUTH_REFRESH_TOKEN = (process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "").trim();
/** Delay in ms before deleting our copy of the generated deck (user gets copy link). Default 5 min. */
const SLIDES_CLEANUP_DELAY_MS = parseInt(process.env.SLIDES_CLEANUP_DELAY_MS || "300000", 10);

module.exports = {
  REDIS_URL,
  REPORT_CACHE_TTL,
  PORT,
  GITHUB_TOKEN,
  GEMINI_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_SERVICE_ACCOUNT_JSON,
  SLIDES_TEMPLATE_ID,
  SLIDES_DRIVE_FOLDER_ID,
  SLIDES_IMPERSONATE_EMAIL,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
  SLIDES_CLEANUP_DELAY_MS,
};
