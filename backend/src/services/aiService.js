/**
 * AI scoring and recommendations via Gemini 3 Flash (paid).
 * Output sections as variables: scores, strengthsWeaknesses, technicalHighlights, improvementSuggestions, hiringRecommendation.
 */
const { GEMINI_API_KEY } = require("../config/env");

const GEMINI_MODEL = "gemini-3-flash-preview";

/** Chars of code per file in prompt (~20–25 lines). apiSource already caps at 150 lines/file. */
const PREVIEW_CHAR_LIMIT = 800;
/** Repos in prompt (order from backend: pinned, then stars/forks/activity). */
const MAX_REPOS_IN_PROMPT = 12;
/** Files per repo in prompt; match apiSource cap so we don't drop fetched files. */
const MAX_FILES_IN_PROMPT_PER_REPO = 18;
/** README chars per repo in prompt (for Documentation scoring). */
const README_CHAR_LIMIT = 1200;
/** Recent commit messages per repo to include. */
const COMMITS_IN_PROMPT = 5;

const SCORING_GUIDE_BASE = `
You are a senior engineer producing a hiring-grade report. Evaluate fairly; weight the following categories as specified. Each category score is 0–100; overallScore should reflect the weighted mix.

**Default weights (must sum to 100%):**
1. **Code Quality (30%)** – Readability, structure, error handling, naming. Prefer clear patterns over cleverness. Penalize obvious bugs or security issues in snippets.
2. **Project Complexity (20%)** – Architecture, separation of concerns, use of tests/CI. Reward non-trivial projects and sensible tooling.
3. **Documentation (15%)** – README, comments, setup instructions. Weight README and in-code clarity; missing docs hurt this score.
4. **Consistency (15%)** – Style, formatting, and patterns across repos. Same stack and conventions across projects score higher.
5. **Technical Breadth (20%)** – Languages, frameworks, and domains (e.g. full-stack, DevOps, tooling). Breadth without depth scores moderately; depth in one area can still score well.
`;

const JOB_DESCRIPTION_GUIDE = `
**IMPORTANT – Job-specific weights:** A job description has been provided below. Use it to adjust the category weights so they align with the role's requirements. The weights must still sum to 100%. Examples:
- Role emphasizes documentation or onboarding → increase Documentation weight, decrease others proportionally.
- Senior/architect role → increase Project Complexity and Code Quality.
- Full-stack or multi-language role → increase Technical Breadth.
- Role stresses consistency, style guides, or team standards → increase Consistency.
- Startup or fast iteration → Code Quality and Consistency may matter more.
Tailor the weights to what the job listing prioritizes, then score accordingly. In hiringRecommendation, explicitly reference fit for this specific role.
`;

function buildPrompt(report, codeSamples, view, enhancedRepos = [], jobDescription = "") {
  const stats = report?.stats || {};
  const projectType = stats.project_type;
  const descriptionsTrimmed = Array.isArray(projectType)
    ? projectType
        .filter((d) => d && typeof d === "string")
        .slice(0, 6)
        .map((d) => (d.length > 80 ? d.slice(0, 77) + "…" : d))
    : [];

  const reportSummary = {
    user: report?.user?.login || report?.user?.name,
    repoCount: report?.repos?.length || 0,
    language: stats.language || {},
    stars: stats.stars,
    forks: stats.fork_count,
    commits: stats.commits,
    pulls: stats.pulls,
    projectDescriptions: descriptionsTrimmed,
    topRepos: (report?.repos || [])
      .filter((r) => !r.fork)
      .slice(0, MAX_REPOS_IN_PROMPT)
      .map((r) => ({ name: r.name, lang: r.language, stars: r.stargazers_count })),
  };

  const reposForPrompt = (codeSamples?.repos || []).slice(0, MAX_REPOS_IN_PROMPT);
  const codeSummary = reposForPrompt.map((repo) => ({
    name: repo.name,
    files: (repo.files || [])
      .slice(0, MAX_FILES_IN_PROMPT_PER_REPO)
      .map((f) => ({
        path: f.path,
        lang: f.language,
        preview: (f.content || "").slice(0, PREVIEW_CHAR_LIMIT),
      })),
  }));

  const overviewByRepo = (enhancedRepos || [])
    .slice(0, MAX_REPOS_IN_PROMPT)
    .map((e) => ({
      repo: e.repo,
      readme: (e.readme || "").slice(0, README_CHAR_LIMIT),
      commit_count: e.commits?.commit_count ?? 0,
      recent_commits: (e.commits?.commits || []).slice(0, COMMITS_IN_PROMPT).map((c) => c.message),
      pull_count: e.pulls?.pull_count ?? 0,
      merged_count: e.pulls?.merged_count ?? 0,
    }));

  const overviewSection =
    overviewByRepo.length > 0
      ? `
## Repo overview (README + activity)
${JSON.stringify(overviewByRepo)}
`
      : "";

  const jobSection =
    jobDescription && jobDescription.trim()
      ? `
${JOB_DESCRIPTION_GUIDE}
## Job description (use to tune weights and hiring recommendation)
${jobDescription.trim().slice(0, 4000)}
`
      : "";

  return `${SCORING_GUIDE_BASE}${jobSection}
View: ${view || "recruiter"}.

## Profile
${JSON.stringify(reportSummary)}
${overviewSection}
## Code samples
${JSON.stringify(codeSummary)}

Respond with a single JSON object only. No markdown or extra text. Exact keys:
- "scores": { "overallScore": number 0-100, "categoryScores": { "codeQuality": number, "projectComplexity": number, "documentation": number, "consistency": number, "technicalBreadth": number } }
- "scoreBreakdown": string (2-4 sentences explaining why this overall score: which categories drove it up or down and a one-line summary)
- "strengthsWeaknesses": { "strengths": string[], "weaknesses": string[] }
- "technicalHighlights": string[] (4-8 concrete bullets: frameworks, patterns, notable repos, tech stack)
- "improvementSuggestions": string[] (3-6 concrete items)
- "hiringRecommendation": string (2-4 sentences: clear recommend yes/no/maybe, level if applicable, and why in 1-2 sentences)
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
    scoreBreakdown: typeof parsed?.scoreBreakdown === "string" ? parsed.scoreBreakdown.trim() : "",
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
 * @param {Array<{ repo: string, readme: string, commits: object, pulls: object }>} [enhancedRepos] - from getOverview (README, commits, pulls per repo)
 * @param {string} [jobDescription] - optional job listing text; when provided, adjusts weights to match role criteria
 * @returns {Promise<{ scores, strengthsWeaknesses, technicalHighlights, improvementSuggestions, hiringRecommendation }>}
 */
async function analyze(report, codeSamples, view = "recruiter", enhancedRepos = [], jobDescription = "") {
  const payload = report?.report ? report.report : report;
  const prompt = buildPrompt(payload, codeSamples, view, enhancedRepos, jobDescription);

  if (!GEMINI_API_KEY) {
    return {
      scores: { overallScore: 0, categoryScores: { codeQuality: 0, projectComplexity: 0, documentation: 0, consistency: 0, technicalBreadth: 0 } },
      scoreBreakdown: "",
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
