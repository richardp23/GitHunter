/**
 * Integration tests for Google Slides API access (TDD / diagnostic).
 * Run with: npm run test:v2 (or jest tests/v2/slides-api.integration.test.js)
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_JSON in .env
 *
 * These tests call the real Slides and Drive APIs. They help diagnose 403 "caller does not have permission":
 * - If Slides create returns 403 → enable Google Slides API in the GCP project that owns the service account key.
 * - If Drive delete returns 403 → enable Google Drive API in the same project.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const {
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_SERVICE_ACCOUNT_JSON,
} = require("../../src/config/env");
const { getSlidesAuth } = require("../../src/services/slidesService");
const path = require("path");
const fs = require("fs");

const hasCredentials =
  (GOOGLE_APPLICATION_CREDENTIALS && GOOGLE_APPLICATION_CREDENTIALS.length > 0) ||
  (GOOGLE_SERVICE_ACCOUNT_JSON && GOOGLE_SERVICE_ACCOUNT_JSON.length > 0);

function getServiceAccountInfo() {
  if (GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
      return { project_id: creds.project_id, client_email: creds.client_email };
    } catch {
      return {};
    }
  }
  const keyPath = GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) return {};
  const resolved = path.isAbsolute(keyPath)
    ? keyPath
    : path.resolve(process.cwd(), keyPath);
  try {
    const content = fs.readFileSync(resolved, "utf8");
    const creds = JSON.parse(content);
    return { project_id: creds.project_id, client_email: creds.client_email };
  } catch {
    return {};
  }
}

function permissionDeniedHint(apiName, info) {
  const { project_id, client_email } = info;
  let hint = `Enable "${apiName}" in the same GCP project as your service account key.`;
  if (project_id) hint += ` Project ID from key: ${project_id}.`;
  if (client_email) hint += ` Service account: ${client_email}.`;
  return hint;
}

describe("Google Slides API access (integration)", () => {
  let presentationId = null;
  const { google } = require("googleapis");

  beforeAll(() => {
    if (!hasCredentials) {
      console.warn(
        "Slides API tests skipped: set GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_SERVICE_ACCOUNT_KEY) or GOOGLE_SERVICE_ACCOUNT_JSON in .env"
      );
    }
  });

  it("Slides API: service account can create a presentation", async () => {
    if (!hasCredentials) return;
    const auth = getSlidesAuth();
    const slidesApi = google.slides({ version: "v1", auth });
    const info = getServiceAccountInfo();
    try {
      const res = await slidesApi.presentations.create({
        requestBody: { title: "GitHunter API test" },
      });
      expect(res.data).toBeDefined();
      expect(res.data.presentationId).toBeDefined();
      presentationId = res.data.presentationId;
    } catch (err) {
      const code = err.code ?? err.response?.status;
      const message = err.message || err.cause?.message || "";
      const body = err.response?.data;
      if (code === 403 || /permission|PERMISSION_DENIED/i.test(message)) {
        const hint = permissionDeniedHint("Google Slides API", info);
        const bodyJson = body ? `\nGoogle API error body: ${JSON.stringify(body)}` : "";
        throw new Error(
          `Slides API returned 403 (caller does not have permission). ${hint} In GCP Console: APIs & Services → Library → search "Google Slides API" → Enable.${bodyJson}`
        );
      }
      throw err;
    }
  });

  it("Drive API: service account can delete a file (cleanup)", async () => {
    if (!hasCredentials || !presentationId) return;
    const auth = getSlidesAuth();
    const drive = google.drive({ version: "v3", auth });
    const info = getServiceAccountInfo();
    try {
      await drive.files.delete({ fileId: presentationId });
    } catch (err) {
      const code = err?.code ?? err?.response?.status;
      const message = err?.message || err?.cause?.message || "";
      if (code === 403 || /permission|PERMISSION_DENIED/i.test(message)) {
        const hint = permissionDeniedHint("Google Drive API", info);
        throw new Error(
          `Drive API returned 403 (caller does not have permission). ${hint} In GCP Console: APIs & Services → Library → search "Google Drive API" → Enable.`
        );
      }
      throw err;
    }
  });
});
