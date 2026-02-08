/**
 * Integration tests for Google Slides API access (TDD / diagnostic).
 * Run with: npm run test:slides-api (or jest tests/v2/slides-api.integration.test.js)
 * Requires: OAuth (GOOGLE_OAUTH_*) or service account (GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_SERVICE_ACCOUNT_JSON) in .env
 *
 * These tests call the real Slides and Drive APIs. They help diagnose 403 "caller does not have permission":
 * - OAuth: creates in user Drive via Drive API, then deletes.
 * - Service account: creates via Slides API, then deletes (may fail with storage quota).
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const {
  isSlidesConfigured,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_SERVICE_ACCOUNT_JSON,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
} = require("../../src/config/env");
const { getSlidesAuth } = require("../../src/services/slidesService");
const path = require("path");
const fs = require("fs");

const hasCredentials = isSlidesConfigured();
const useOAuth = !!(
  GOOGLE_OAUTH_CLIENT_ID &&
  GOOGLE_OAUTH_CLIENT_SECRET &&
  GOOGLE_OAUTH_REFRESH_TOKEN
);

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
        "Slides API tests skipped: set OAuth (GOOGLE_OAUTH_*) or service account (GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_SERVICE_ACCOUNT_JSON) in .env"
      );
    }
  });

  it(useOAuth ? "Drive API: OAuth user can create a presentation" : "Slides API: service account can create a presentation", async () => {
    if (!hasCredentials) return;
    const auth = getSlidesAuth();
    const drive = google.drive({ version: "v3", auth });
    const info = getServiceAccountInfo();

    if (useOAuth) {
      try {
        const res = await drive.files.create({
          requestBody: {
            name: "GitHunter API test",
            mimeType: "application/vnd.google-apps.presentation",
          },
          supportsAllDrives: true,
        });
        expect(res.data?.id).toBeDefined();
        presentationId = res.data.id;
      } catch (err) {
        const code = err.code ?? err.response?.status;
        const message = err.message || err.cause?.message || "";
        const body = err.response?.data;
        if (code === 403 || /permission|PERMISSION_DENIED/i.test(message)) {
          const bodyJson = body ? `\nGoogle API error body: ${JSON.stringify(body)}` : "";
          throw new Error(
            `Drive API returned 403 (caller does not have permission). Check OAuth scopes include drive and presentations.${bodyJson}`
          );
        }
        throw err;
      }
    } else {
      const slidesApi = google.slides({ version: "v1", auth });
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
    }
  });

  it("Drive API: can delete a file (cleanup)", async () => {
    if (!hasCredentials || !presentationId) return;
    const auth = getSlidesAuth();
    const drive = google.drive({ version: "v3", auth });
    const info = getServiceAccountInfo();
    try {
      await drive.files.delete({ fileId: presentationId, supportsAllDrives: true });
    } catch (err) {
      const code = err?.code ?? err?.response?.status;
      const message = err?.message || err?.cause?.message || "";
      if (code === 403 || /permission|PERMISSION_DENIED/i.test(message)) {
        const hint = useOAuth
          ? "Check OAuth scopes include drive."
          : permissionDeniedHint("Google Drive API", info);
        throw new Error(
          `Drive API returned 403 (caller does not have permission). ${hint} In GCP Console: APIs & Services → Library → search "Google Drive API" → Enable.`
        );
      }
      throw err;
    }
  });
});
