/**
 * Google Slides presentation generation: Gemini for slide content, Slides API for deck creation.
 * Option A: clone template (SLIDES_TEMPLATE_ID) then fill. Option B: blank + predefined layouts.
 * Caller can schedule deletion of our copy after user clones via copyUrl.
 */
const {
  GEMINI_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_SERVICE_ACCOUNT_JSON,
  SLIDES_TEMPLATE_ID,
  SLIDES_DRIVE_FOLDER_ID,
  SLIDES_IMPERSONATE_EMAIL,
} = require("../config/env");
const path = require("path");
const fs = require("fs");
const aiService = require("./aiService");

const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_RETRY_ATTEMPTS = 3;
const GEMINI_RETRY_DELAY_MS = 2000;

const SLIDE_CONTENT_PROMPT = `You are creating a short presentation to "sell" a software engineering candidate to a hiring manager.
You will receive a hiring report (overview, scores, strengths/weaknesses, technical highlights, recommendation).
Produce a 5–8 slide deck that presents the candidate in a professional, persuasive way.

Output only valid JSON. No markdown, no commentary. Exact keys:
- "title": string (presentation title, e.g. "Candidate: [Name] — Technical Overview")
- "slides": array of objects, each with:
  - "title": string (short slide title, max 8 words)
  - "bullets": string[] (4–6 concise bullet points, one line each)
  - "speakerNotes": string (optional, 1–2 sentences for the presenter)

Suggested slide flow: Title slide → Overview (repos, languages, score) → Key strengths → Technical highlights → Recommendation / next steps.
Keep tone professional and recruiter-friendly.`;

/**
 * Build prompt for slide content from full report payload.
 * @param {object} fullReport - { report, scores, scoreBreakdown?, strengthsWeaknesses?, technicalHighlights?, improvementSuggestions?, hiringRecommendation? }
 * @returns {string}
 */
function buildSlidePrompt(fullReport) {
  const report = fullReport.report || {};
  const user = report.user || {};
  const username = user.login || user.name || "candidate";
  const displayName = user.name || user.login || username;
  const summary = {
    displayName,
    username,
    repoCount: report.repos?.length ?? 0,
    stats: report.stats || {},
    scores: fullReport.scores,
    scoreBreakdown: fullReport.scoreBreakdown,
    strengthsWeaknesses: fullReport.strengthsWeaknesses,
    technicalHighlights: fullReport.technicalHighlights,
    improvementSuggestions: fullReport.improvementSuggestions,
    hiringRecommendation: fullReport.hiringRecommendation,
  };
  return `${SLIDE_CONTENT_PROMPT}

## Report data
${JSON.stringify(summary)}

Respond with a single JSON object only. Keys: "title", "slides" (array of { "title", "bullets", "speakerNotes" }).`;
}

/**
 * Parse JSON from model response (reuse aiService helper).
 */
function parseJsonResponse(text) {
  return aiService.parseJsonResponse(text);
}

/**
 * Call Gemini generateContent with retries on 503/429 (same model only).
 */
async function callGeminiWithRetry(ai, prompt) {
  let lastErr;
  for (let attempt = 1; attempt <= GEMINI_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      return response;
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? err?.code;
      const isRetryable =
        status === 503 ||
        status === 429 ||
        (err?.message && /overloaded|try again|unavailable/i.test(err.message));
      if (!isRetryable) throw err;
      if (attempt < GEMINI_RETRY_ATTEMPTS) {
        const delay = GEMINI_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error("Gemini is temporarily overloaded. Please try again in a few minutes.");
}

/**
 * Generate structured slide content from full report using Gemini.
 * @param {object} fullReport - Full analysis report (report, scores, strengthsWeaknesses, etc.)
 * @returns {Promise<{ title: string, slides: Array<{ title: string, bullets: string[], speakerNotes?: string }> }>}
 */
async function generateSlideContent(fullReport) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set. Configure to enable slide content generation.");
  }
  const prompt = buildSlidePrompt(fullReport);
  const { GoogleGenAI } = require("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await callGeminiWithRetry(ai, prompt);
  const text = response?.text ?? response?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = parseJsonResponse(text);
  if (!parsed || !Array.isArray(parsed.slides)) {
    throw new Error("Gemini did not return valid slide content (missing or invalid 'slides' array).");
  }
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "Candidate Overview";
  const slides = parsed.slides.map((s) => ({
    title: typeof s.title === "string" ? s.title.trim() : "Slide",
    bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => String(b).trim()).filter(Boolean) : [],
    speakerNotes: typeof s.speakerNotes === "string" ? s.speakerNotes.trim() : undefined,
  }));
  return { title, slides };
}

const SLIDES_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive",
];

/**
 * Load service account credentials (from env JSON or key file).
 * @returns {{ client_email: string, private_key: string }}
 */
function getServiceAccountCredentials() {
  if (GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON.");
    }
  }
  const keyPath = GOOGLE_APPLICATION_CREDENTIALS
    ? (path.isAbsolute(GOOGLE_APPLICATION_CREDENTIALS)
        ? GOOGLE_APPLICATION_CREDENTIALS
        : path.resolve(process.cwd(), GOOGLE_APPLICATION_CREDENTIALS))
    : null;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_SERVICE_ACCOUNT_KEY) must point to a service account JSON file.");
  }
  const content = fs.readFileSync(keyPath, "utf8");
  return JSON.parse(content);
}

/**
 * Get Google Auth client for Slides API (service account).
 * If SLIDES_IMPERSONATE_EMAIL is set, uses domain-wide delegation so files use that user's Drive quota.
 */
function getSlidesAuth() {
  const { GoogleAuth, JWT } = require("google-auth-library");
  const subject = (SLIDES_IMPERSONATE_EMAIL || "").trim();

  if (subject) {
    const credentials = getServiceAccountCredentials();
    const jwt = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: SLIDES_AUTH_SCOPES,
      subject,
    });
    return {
      getClient: async () => {
        await jwt.authorize();
        return jwt;
      },
    };
  }

  if (GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
      return new GoogleAuth({ credentials, scopes: SLIDES_AUTH_SCOPES });
    } catch (e) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON.");
    }
  }
  if (GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = GOOGLE_APPLICATION_CREDENTIALS;
  }
  return new GoogleAuth({ scopes: SLIDES_AUTH_SCOPES });
}

/**
 * Copy a Drive file (template) to a new file. Optionally into parentFolderId (avoids service account quota).
 * @param {string} templateId - Drive file ID of the template presentation
 * @param {string} title - Title for the copy
 * @param {string} [parentFolderId] - Optional folder ID to place the copy in (use SLIDES_DRIVE_FOLDER_ID)
 * @returns {Promise<string>} presentationId (same as Drive file ID)
 */
async function copyTemplate(templateId, title, parentFolderId) {
  const auth = getSlidesAuth();
  const { google } = require("googleapis");
  const drive = google.drive({ version: "v3", auth });
  const requestBody = { name: title || "Candidate presentation" };
  if (parentFolderId) requestBody.parents = [parentFolderId];
  const res = await drive.files.copy({
    fileId: templateId,
    requestBody,
    supportsAllDrives: true,
  });
  const id = res.data?.id;
  if (!id) throw new Error("Drive copy did not return a file ID.");
  return id;
}

/**
 * Create a blank presentation via Drive API in the given folder. Use when service account's own Drive has no quota.
 * @param {string} title - Presentation title
 * @param {string} parentFolderId - Drive folder or Shared Drive ID (shared with service account)
 * @returns {Promise<string>} presentationId
 */
async function createPresentationInFolder(title, parentFolderId) {
  const auth = getSlidesAuth();
  const { google } = require("googleapis");
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.create({
    requestBody: {
      name: title || "Candidate presentation",
      mimeType: "application/vnd.google-apps.presentation",
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    supportsAllDrives: true,
  });
  const id = res.data?.id;
  if (!id) throw new Error("Drive create did not return a file ID.");
  return id;
}

/**
 * Delete a presentation (Drive file) by ID. Used to clean up our copy after user has cloned.
 * @param {string} presentationId - Drive file ID of the presentation
 */
async function deletePresentation(presentationId) {
  if (!presentationId) return;
  const auth = getSlidesAuth();
  const { google } = require("googleapis");
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({ fileId: presentationId }).catch((err) => {
    console.warn("Slides cleanup delete failed:", err?.message || err);
  });
}

/**
 * Find placeholder shape objectIds on a page (TITLE, BODY, SUBTITLE, etc.).
 * @param {object} page - Page from presentation.slides[].pageElements
 * @returns {{ titleId?: string, bodyId?: string, subtitleId?: string }}
 */
function getPlaceholderIds(page) {
  const elements = page.pageElements || [];
  const out = {};
  for (const el of elements) {
    const type = el.shape?.placeholder?.type;
    if (!type) continue;
    if (type === "TITLE" || type === "CENTERED_TITLE") out.titleId = out.titleId || el.objectId;
    if (type === "BODY") out.bodyId = el.objectId;
    if (type === "SUBTITLE") out.subtitleId = el.objectId;
  }
  return out;
}

/**
 * Create a Google Slides presentation from structured content.
 * If SLIDES_TEMPLATE_ID is set, clones that Drive file then fills; otherwise creates blank + predefined layouts.
 * @param {{ title: string, slides: Array<{ title: string, bullets: string[], speakerNotes?: string }> }} content
 * @returns {Promise<{ presentationId: string, url: string, copyUrl: string }>}
 */
async function createPresentationFromContent(content) {
  const auth = getSlidesAuth();
  const { google } = require("googleapis");
  const slidesApi = google.slides({ version: "v1", auth });

  const title = content.title || "Candidate Overview";
  let presentationId;
  const parentFolderId = SLIDES_DRIVE_FOLDER_ID || null;

  if (SLIDES_TEMPLATE_ID) {
    presentationId = await copyTemplate(SLIDES_TEMPLATE_ID, title, parentFolderId);
  } else if (parentFolderId) {
    // Create in shared folder to avoid service account Drive quota exceeded
    presentationId = await createPresentationInFolder(title, parentFolderId);
  } else {
    const createRes = await slidesApi.presentations.create({
      requestBody: { title },
    });
    presentationId = createRes.data.presentationId;
  }
  if (!presentationId) throw new Error("Slides API did not return a presentation ID.");

  const baseUrl = `https://docs.google.com/presentation/d/${presentationId}`;
  const slides = content.slides || [];
  if (slides.length === 0) {
    return {
      presentationId,
      url: `${baseUrl}/edit`,
      copyUrl: `${baseUrl}/copy`,
    };
  }

  const getPres = () => slidesApi.presentations.get({ presentationId });
  let pres = (await getPres()).data;
  const pageIds = (pres.slides || []).map((s) => s.objectId);

  const requests = [];

  // First slide: title (and optionally subtitle). Default blank deck has one slide with TITLE + SUBTITLE.
  const firstPlaceholders = getPlaceholderIds(pres.slides[0]);
  const firstSlideContent = slides[0];
  if (firstPlaceholders.titleId && firstSlideContent) {
    requests.push(
      { deleteText: { objectId: firstPlaceholders.titleId, textRange: { type: "ALL" } } },
      { insertText: { objectId: firstPlaceholders.titleId, insertionIndex: 0, text: firstSlideContent.title || title } }
    );
    if (firstPlaceholders.subtitleId) {
      const subText = firstSlideContent.bullets && firstSlideContent.bullets[0] ? firstSlideContent.bullets[0] : "";
      requests.push(
        { deleteText: { objectId: firstPlaceholders.subtitleId, textRange: { type: "ALL" } } },
        { insertText: { objectId: firstPlaceholders.subtitleId, insertionIndex: 0, text: subText } }
      );
    }
  }

  // Add remaining slides with TITLE_AND_BODY layout
  for (let i = 1; i < slides.length; i++) {
    requests.push({
      createSlide: {
        insertionIndex: i,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
      },
    });
  }

  if (requests.length > 0) {
    await slidesApi.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
  }

  pres = (await getPres()).data;
  const allSlides = pres.slides || [];
  const textRequests = [];

  for (let i = 1; i < slides.length && i < allSlides.length; i++) {
    const placeholders = getPlaceholderIds(allSlides[i]);
    const slideContent = slides[i];
    if (!slideContent) continue;
    if (placeholders.titleId) {
      textRequests.push(
        { deleteText: { objectId: placeholders.titleId, textRange: { type: "ALL" } } },
        { insertText: { objectId: placeholders.titleId, insertionIndex: 0, text: slideContent.title || "" } }
      );
    }
    if (placeholders.bodyId && slideContent.bullets && slideContent.bullets.length > 0) {
      const bodyText = slideContent.bullets.map((b) => `• ${b}`).join("\n");
      textRequests.push(
        { deleteText: { objectId: placeholders.bodyId, textRange: { type: "ALL" } } },
        { insertText: { objectId: placeholders.bodyId, insertionIndex: 0, text: bodyText } }
      );
    }
  }

  if (textRequests.length > 0) {
    await slidesApi.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: textRequests },
    });
  }

  return {
    presentationId,
    url: `${baseUrl}/edit`,
    copyUrl: `${baseUrl}/copy`,
  };
}

/**
 * Generate a presentation from a full report: Gemini for content, then Slides API to create deck.
 * @param {object} fullReport - Full analysis report
 * @returns {Promise<{ presentationId: string, url: string, copyUrl: string }>}
 */
async function generatePresentation(fullReport) {
  const content = await generateSlideContent(fullReport);
  return createPresentationFromContent(content);
}

module.exports = {
  generateSlideContent,
  createPresentationFromContent,
  generatePresentation,
  buildSlidePrompt,
  copyTemplate,
  deletePresentation,
  getSlidesAuth,
};
