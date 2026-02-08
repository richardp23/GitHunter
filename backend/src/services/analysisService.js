/**
 * Orchestrates GitHub data + code samples + AI analysis into final report.
 * Uses getOverview (READMEs, commits, pulls per repo) then fetchCodeSamples + AI.
 * Report includes base data plus: scores, strengthsWeaknesses, technicalHighlights, improvementSuggestions, hiringRecommendation.
 */
const { getOverview } = require("./overviewService");
const { fetchCodeSamples } = require("../codeSource");
const aiService = require("./aiService");

/**
 * Run full analysis: getOverview → fetchCodeSamples → aiService.analyze.
 * @param {string} username
 * @param {string} [view] - "recruiter" | "developer"
 * @param {{ useClone?: boolean }} [opts]
 * @returns {Promise<{ report: object, scores: object, strengthsWeaknesses: object, technicalHighlights: string[], improvementSuggestions: string[], hiringRecommendation: string }>}
 */
async function runAnalysis(username, view = "recruiter", opts = {}) {
  const overview = await getOverview(username);
  const base = overview.generalData;
  const reportPayload = base.report;

  const codeSamples = await fetchCodeSamples(username, reportPayload.repos || [], { useClone: opts.useClone || false });
  const aiResult = await aiService.analyze(base, codeSamples, view, overview.enhancedRepos);

  return {
    report: reportPayload,
    scores: aiResult.scores,
    scoreBreakdown: aiResult.scoreBreakdown,
    strengthsWeaknesses: aiResult.strengthsWeaknesses,
    technicalHighlights: aiResult.technicalHighlights,
    improvementSuggestions: aiResult.improvementSuggestions,
    hiringRecommendation: aiResult.hiringRecommendation,
  };
}

module.exports = { runAnalysis };
