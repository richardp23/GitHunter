/**
 * AI scoring and recommendations via Gemini 3 Flash (paid).
 * Output sections as variables: scores, strengthsWeaknesses, technicalHighlights, improvementSuggestions, hiringRecommendation.
 */
const { GEMINI_API_KEY } = require("../config/env");

const GEMINI_MODEL = "gemini-3-flash-preview";

const RUBRIC = `
Scoring rubric (total 100%):
- Code Quality: 30%
- Project Complexity: 20%
- Documentation: 15%
- Consistency: 15%
- Technical Breadth: 20%
`;

function buildPrompt(report, codeSamples, view) {
  const reportSummary = JSON.stringify(
    {
      user: report?.user?.login || report?.user?.name,
      repoCount: report?.repos?.length || 0,
      stats: report?.stats,
      topRepos: (report?.repos || [])
        .filter((r) => !r.fork)
        .slice(0, 10)
        .map((r) => ({ name: r.name, language: r.language, stars: r.stargazers_count })),
    },
    null,
    2
  );

  const codeSummary = (codeSamples?.repos || []).map((repo) => ({
    name: repo.name,
    files: (repo.files || []).map((f) => ({ path: f.path, language: f.language, preview: (f.content || "").slice(0, 800) })),
  }));

  return `You are a senior engineer evaluating a candidate's GitHub profile for a hiring-grade report. View: ${view || "recruiter"}.

${RUBRIC}

## GitHub profile summary
${reportSummary}

## Code samples (path + language + preview)
${JSON.stringify(codeSummary, null, 2)}

Respond with a single JSON object only, no markdown or extra text, with these exact keys:
- "scores": { "overallScore": number 0-100, "categoryScores": { "codeQuality": number, "projectComplexity": number, "documentation": number, "consistency": number, "technicalBreadth": number } }
- "strengthsWeaknesses": { "strengths": string[], "weaknesses": string[] }
- "technicalHighlights": string[] (3-7 bullet-style highlights)
- "improvementSuggestions": string[] (3-6 concrete suggestions)
- "hiringRecommendation": string (one short paragraph: recommend yes/no/maybe and why)
`;
}

/**
 * Parse JSON from model response (strip markdown code block if present).
 */
function parseJsonResponse(text) {
  if (!text || typeof text !== "string") return null;
  let raw = text.trim();
  const codeBlock = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (codeBlock) raw = codeBlock[1].trim();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Normalize AI output into report section variables.
 */
function normalizeOutput(parsed) {
  return {
    scores: {
      overallScore: Number(parsed?.scores?.overallScore) || 0,
      categoryScores: {
        codeQuality: Number(parsed?.scores?.categoryScores?.codeQuality) || 0,
        projectComplexity: Number(parsed?.scores?.categoryScores?.projectComplexity) || 0,
        documentation: Number(parsed?.scores?.categoryScores?.documentation) || 0,
        consistency: Number(parsed?.scores?.categoryScores?.consistency) || 0,
        technicalBreadth: Number(parsed?.scores?.categoryScores?.technicalBreadth) || 0,
      },
    },
    strengthsWeaknesses: {
      strengths: Array.isArray(parsed?.strengthsWeaknesses?.strengths) ? parsed.strengthsWeaknesses.strengths : [],
      weaknesses: Array.isArray(parsed?.strengthsWeaknesses?.weaknesses) ? parsed.strengthsWeaknesses.weaknesses : [],
    },
    technicalHighlights: Array.isArray(parsed?.technicalHighlights) ? parsed.technicalHighlights : [],
    improvementSuggestions: Array.isArray(parsed?.improvementSuggestions) ? parsed.improvementSuggestions : [],
    hiringRecommendation: typeof parsed?.hiringRecommendation === "string" ? parsed.hiringRecommendation : "",
  };
}

/**
 * @param {object} report - full report from buildReport (report.report = userReport)
 * @param {object} codeSamples - { repos: [{ name, files: [{ path, content, language }] }] }
 * @param {string} [view] - "recruiter" | "developer"
 * @returns {Promise<{ scores, strengthsWeaknesses, technicalHighlights, improvementSuggestions, hiringRecommendation }>}
 */
async function analyze(report, codeSamples, view = "recruiter") {
  const payload = report?.report ? report.report : report;
  const prompt = buildPrompt(payload, codeSamples, view);

  if (!GEMINI_API_KEY) {
    return {
      scores: { overallScore: 0, categoryScores: { codeQuality: 0, projectComplexity: 0, documentation: 0, consistency: 0, technicalBreadth: 0 } },
      strengthsWeaknesses: { strengths: [], weaknesses: [] },
      technicalHighlights: [],
      improvementSuggestions: [],
      hiringRecommendation: "GEMINI_API_KEY not set. Configure to enable AI analysis.",
    };
  }

  const { GoogleGenAI } = require("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  const text = response?.text ?? (response?.candidates?.[0]?.content?.parts?.[0]?.text);
  const parsed = parseJsonResponse(text);
  return normalizeOutput(parsed);
}

module.exports = { analyze, parseJsonResponse, normalizeOutput, buildPrompt };
