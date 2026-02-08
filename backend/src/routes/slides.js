/**
 * POST /api/slides/generate
 * Body: { username } or { report } (full report object). Returns { url, copyUrl, presentationId }.
 * Resolves report from cache by username (or uses body.report), then Gemini → Slides API.
 * User should open copyUrl to "Make a copy" in their Drive; our copy is deleted after a delay.
 */
const express = require("express");
const { getReportByUsername } = require("../utils/cache");
const { generatePresentation } = require("../services/slidesService");
const { cleanupQueue } = require("../utils/queue");
const { isSlidesConfigured, SLIDES_CLEANUP_DELAY_MS } = require("../config/env");

const router = express.Router();

router.post("/generate", async (req, res) => {
  const username = (req.body?.username || "").trim();
  const reportFromBody = req.body?.report;

  let fullReport = null;
  if (reportFromBody && typeof reportFromBody === "object" && reportFromBody.report) {
    fullReport = reportFromBody;
  } else if (username) {
    fullReport = await getReportByUsername(username);
    if (!fullReport) {
      return res.status(404).json({
        error: "No report found for this username. Run analysis first.",
      });
    }
  }

  if (!fullReport) {
    return res.status(400).json({
      error: "Provide either 'username' (with an existing report) or 'report' (full report object).",
    });
  }

  if (!isSlidesConfigured()) {
    return res.status(503).json({
      error:
        "Google Slides API is not configured. Use OAuth (GOOGLE_OAUTH_*) or service account credentials.",
    });
  }

  try {
    const { presentationId, url, copyUrl } = await generatePresentation(fullReport);
    if (presentationId && SLIDES_CLEANUP_DELAY_MS > 0) {
      cleanupQueue.add({ presentationId }, { delay: SLIDES_CLEANUP_DELAY_MS });
    }
    return res.json({ presentationId, url, copyUrl: copyUrl || url });
  } catch (err) {
    console.error("Slides generate error:", err);
    let message = err.message || "Failed to generate presentation";
    const code = err.code ?? err.status ?? err.response?.status;
    if (code === 403 || /permission|PERMISSION_DENIED/i.test(message)) {
      message =
        "Google Slides API returned permission denied. If using a service account, ensure APIs are enabled and consider using OAuth (obtain-google-oauth-token.js) or SLIDES_DRIVE_FOLDER_ID.";
    }
    const status = message.includes("not set") || code === 503 ? 503 : code === 403 ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

module.exports = router;
