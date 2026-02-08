/**
 * AI analysis report shape and pipeline.
 * Sections as variables: scores, strengthsWeaknesses, technicalHighlights, improvementSuggestions, hiringRecommendation.
 */

const mockBuildReport = jest.fn();
const mockFetchCodeSamples = jest.fn();

jest.mock("../../src/services/githubService", () => ({ buildReport: (...args) => mockBuildReport(...args) }));
jest.mock("../../src/codeSource/index.js", () => ({ fetchCodeSamples: (...args) => mockFetchCodeSamples(...args) }));

const aiService = require("../../src/services/aiService");
const analysisService = require("../../src/services/analysisService");

describe("aiService", () => {
  describe("parseJsonResponse", () => {
    it("parses plain JSON", () => {
      const json = '{"scores":{"overallScore":70},"technicalHighlights":[]}';
      expect(aiService.parseJsonResponse(json)).toEqual(
        expect.objectContaining({ scores: { overallScore: 70 }, technicalHighlights: [] })
      );
    });

    it("strips markdown code block", () => {
      const wrapped = "```json\n{\"hiringRecommendation\":\"Yes\"}\n```";
      expect(aiService.parseJsonResponse(wrapped)).toEqual({ hiringRecommendation: "Yes" });
    });

    it("returns null for invalid JSON", () => {
      expect(aiService.parseJsonResponse("not json")).toBeNull();
      expect(aiService.parseJsonResponse("")).toBeNull();
    });
  });

  describe("normalizeOutput", () => {
    it("returns all report section variables with defaults", () => {
      const out = aiService.normalizeOutput({});
      expect(out).toHaveProperty("scores");
      expect(out.scores).toHaveProperty("overallScore", 0);
      expect(out.scores).toHaveProperty("categoryScores");
      expect(out.scores.categoryScores).toMatchObject({
        codeQuality: 0,
        projectComplexity: 0,
        documentation: 0,
        consistency: 0,
        technicalBreadth: 0,
      });
      expect(out).toHaveProperty("strengthsWeaknesses");
      expect(out.strengthsWeaknesses).toEqual({ strengths: [], weaknesses: [] });
      expect(out).toHaveProperty("technicalHighlights");
      expect(Array.isArray(out.technicalHighlights)).toBe(true);
      expect(out).toHaveProperty("improvementSuggestions");
      expect(Array.isArray(out.improvementSuggestions)).toBe(true);
      expect(out).toHaveProperty("hiringRecommendation", "");
    });

    it("preserves valid parsed values", () => {
      const parsed = {
        scores: {
          overallScore: 85,
          categoryScores: {
            codeQuality: 90,
            projectComplexity: 80,
            documentation: 70,
            consistency: 75,
            technicalBreadth: 88,
          },
        },
        strengthsWeaknesses: { strengths: ["Clean code"], weaknesses: ["Few tests"] },
        technicalHighlights: ["Uses TypeScript"],
        improvementSuggestions: ["Add CI"],
        hiringRecommendation: "Recommend yes.",
      };
      const out = aiService.normalizeOutput(parsed);
      expect(out.scores.overallScore).toBe(85);
      expect(out.strengthsWeaknesses.strengths).toEqual(["Clean code"]);
      expect(out.technicalHighlights).toEqual(["Uses TypeScript"]);
      expect(out.improvementSuggestions).toEqual(["Add CI"]);
      expect(out.hiringRecommendation).toBe("Recommend yes.");
    });
  });

  describe("analyze when GEMINI_API_KEY not set", () => {
    it("returns all section variables with fallback message", async () => {
      const report = { report: { user: { login: "test" }, repos: [], stats: {} } };
      const codeSamples = { repos: [] };
      const result = await aiService.analyze(report, codeSamples, "recruiter");

      expect(result).toHaveProperty("scores");
      expect(result).toHaveProperty("strengthsWeaknesses");
      expect(result).toHaveProperty("technicalHighlights");
      expect(result).toHaveProperty("improvementSuggestions");
      expect(result).toHaveProperty("hiringRecommendation");
      expect(result.scores.overallScore).toBe(0);
      expect(result.hiringRecommendation).toContain("GEMINI_API_KEY");
    });
  });
});

describe("analysisService.runAnalysis", () => {
  const mockReport = {
    user: { login: "testuser", name: "Test" },
    repos: [{ name: "repo1", fork: false, owner: { login: "testuser" }, stargazers_count: 5 }],
    stats: { stars: 5, language: { JavaScript: 1 } },
  };

  beforeEach(() => {
    mockBuildReport.mockResolvedValue({ report: mockReport });
    mockFetchCodeSamples.mockResolvedValue({ repos: [{ name: "repo1", files: [] }] });
  });

  it("returns report plus scores, strengthsWeaknesses, technicalHighlights, improvementSuggestions, hiringRecommendation", async () => {
    const result = await analysisService.runAnalysis("testuser", "recruiter");

    expect(result).toHaveProperty("report", mockReport);
    expect(result).toHaveProperty("scores");
    expect(result).toHaveProperty("strengthsWeaknesses");
    expect(result).toHaveProperty("technicalHighlights");
    expect(result).toHaveProperty("improvementSuggestions");
    expect(result).toHaveProperty("hiringRecommendation");

    expect(result.scores).toHaveProperty("overallScore");
    expect(result.scores).toHaveProperty("categoryScores");
    expect(result.strengthsWeaknesses).toHaveProperty("strengths");
    expect(result.strengthsWeaknesses).toHaveProperty("weaknesses");
    expect(Array.isArray(result.technicalHighlights)).toBe(true);
    expect(Array.isArray(result.improvementSuggestions)).toBe(true);
    expect(typeof result.hiringRecommendation).toBe("string");

    expect(mockBuildReport).toHaveBeenCalledWith("testuser");
    expect(mockFetchCodeSamples).toHaveBeenCalledWith("testuser", mockReport.repos, { useClone: false });
  });
});
