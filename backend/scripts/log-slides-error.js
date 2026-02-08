/**
 * One-shot: test creating a Google Slides presentation.
 * - If SLIDES_DRIVE_FOLDER_ID is set: creates in that folder (same path the app uses), then deletes.
 * - Otherwise: tries Slides API then Drive API and logs any errors.
 * Run: node scripts/log-slides-error.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { getSlidesAuth } = require("../src/services/slidesService");
const { SLIDES_DRIVE_FOLDER_ID, SLIDES_IMPERSONATE_EMAIL, GOOGLE_OAUTH_REFRESH_TOKEN } = require("../src/config/env");
const { google } = require("googleapis");

function logError(label, err) {
  console.log(`=== ${label} ===\n`);
  console.log("err.code:", err.code);
  console.log("err.message:", err.message);
  console.log("err.response?.status:", err.response?.status);
  console.log("err.response?.data:", JSON.stringify(err.response?.data, null, 2));
  console.log();
}

async function run() {
  const auth = getSlidesAuth();
  const drive = google.drive({ version: "v3", auth });
  const slidesApi = google.slides({ version: "v1", auth });
  const folderId = (SLIDES_DRIVE_FOLDER_ID || "").trim();
  const impersonate = (SLIDES_IMPERSONATE_EMAIL || "").trim();
  const useOAuth = !!GOOGLE_OAUTH_REFRESH_TOKEN;

  // OAuth: create as user (no Workspace needed)
  if (useOAuth) {
    console.log("OAuth refresh token is set. Creating presentation as that user ...\n");
    const requestBody = {
      name: "GitHunter log-slides-error test",
      mimeType: "application/vnd.google-apps.presentation",
    };
    if (folderId) requestBody.parents = [folderId];
    try {
      const res = await drive.files.create({
        requestBody,
        supportsAllDrives: true,
      });
      const presentationId = res.data?.id;
      if (!presentationId) throw new Error("No file ID returned");
      console.log("   Success. Presentation ID:", presentationId);
      await drive.files.delete({ fileId: presentationId, supportsAllDrives: true }).catch((e) => {
        console.warn("   Cleanup delete failed:", e.message);
      });
      console.log("   Deleted. OAuth path works.\n");
      return;
    } catch (err) {
      logError("Drive API (OAuth)", err);
      process.exit(1);
    }
  }

  // Impersonation (Workspace)
  if (impersonate) {
    console.log("SLIDES_IMPERSONATE_EMAIL is set. Creating presentation as that user (domain-wide delegation) ...\n");
    const requestBody = {
      name: "GitHunter log-slides-error test",
      mimeType: "application/vnd.google-apps.presentation",
    };
    if (folderId) requestBody.parents = [folderId];
    try {
      const res = await drive.files.create({
        requestBody,
        supportsAllDrives: true,
      });
      const presentationId = res.data?.id;
      if (!presentationId) throw new Error("No file ID returned");
      console.log("   Success. Presentation ID:", presentationId);
      await drive.files.delete({ fileId: presentationId, supportsAllDrives: true }).catch((e) => {
        console.warn("   Cleanup delete failed:", e.message);
      });
      console.log("   Deleted. Impersonation works; files use", impersonate, "quota.\n");
      return;
    } catch (err) {
      logError("Drive API (create as user)", err);
      console.log("Domain-wide delegation must be set in Google Workspace Admin: add the service account Client ID and grant Drive/Slides scopes.\n");
      process.exit(1);
    }
  }

  // If folder is set (no impersonation), test create in folder — note: file still owned by SA, so quota may still fail
  if (folderId) {
    console.log("SLIDES_DRIVE_FOLDER_ID is set (no impersonation). Creating in folder ...\n");
    try {
      const res = await drive.files.create({
        requestBody: {
          name: "GitHunter log-slides-error test",
          mimeType: "application/vnd.google-apps.presentation",
          parents: [folderId],
        },
        supportsAllDrives: true,
      });
      const presentationId = res.data?.id;
      if (!presentationId) throw new Error("No file ID returned");
      console.log("   Success. Presentation ID:", presentationId);
      await drive.files.delete({ fileId: presentationId, supportsAllDrives: true }).catch((e) => {
        console.warn("   Cleanup delete failed:", e.message);
      });
      console.log("   Deleted. Folder-based creation works.\n");
      return;
    } catch (err) {
      logError("Drive API (create in folder)", err);
      if (err.message && err.message.includes("storage quota")) {
        console.log("Files created by the service account are owned by the SA and use its quota (not the folder owner's).\n");
        console.log("Fix: use domain-wide delegation. Set SLIDES_IMPERSONATE_EMAIL to a Google Workspace user email, then in Workspace Admin grant the service account Client ID these scopes: https://www.googleapis.com/auth/drive, https://www.googleapis.com/auth/presentations.\n");
      } else {
        console.log("Check that the folder is shared with the service account (Editor/Content manager).\n");
      }
      process.exit(1);
    }
  }

  // No folder: run legacy diagnostics (Slides API then Drive API in service account Drive)
  console.log("SLIDES_DRIVE_FOLDER_ID not set. Running legacy diagnostics ...\n");

  console.log("1. Trying Slides API: presentations.create ...");
  try {
    const res = await slidesApi.presentations.create({
      requestBody: { title: "GitHunter error log test" },
    });
    console.log("   Success:", res.data?.presentationId);
    await drive.files.delete({ fileId: res.data.presentationId }).catch(() => {});
    console.log("   Done.\n");
    return;
  } catch (err) {
    logError("Slides API error (presentations.create)", err);
  }

  console.log("2. Trying Drive API: files.create (no parent, uses service account Drive) ...");
  try {
    const res = await drive.files.create({
      requestBody: {
        name: "GitHunter error log test (Drive)",
        mimeType: "application/vnd.google-apps.presentation",
      },
    });
    const fileId = res.data?.id;
    console.log("   Success (Drive path):", fileId);
    if (fileId) await drive.files.delete({ fileId }).catch(() => {});
    return;
  } catch (err) {
    logError("Drive API error (files.create presentation)", err);
  }

  console.log("Both paths failed. Set SLIDES_DRIVE_FOLDER_ID to a folder shared with the service account.\n");
  process.exit(1);
}

run();
