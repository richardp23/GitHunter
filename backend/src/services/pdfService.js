/**
 * Generates an extensive PDF report from the full analysis payload.
 * Used by GET /api/download/:jobId and GET /api/download/latest/:username.
 */
const PDFDocument = require("pdfkit");

const PAGE_WIDTH = 612;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function sectionTitle(doc, title) {
  doc.fontSize(14).font("Helvetica-Bold").fillColor("#333333").text(title, { continued: false });
  doc.moveDown(0.4);
}

function bodyText(doc, text, opts = {}) {
  if (!text || typeof text !== "string") return;
  doc.fontSize(10).font("Helvetica").fillColor("#222222");
  doc.text(text.trim(), { width: CONTENT_WIDTH, align: "left", ...opts });
  doc.moveDown(0.5);
}

function bulletList(doc, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  doc.fontSize(10).font("Helvetica").fillColor("#222222");
  items.forEach((item) => {
    if (String(item).trim()) doc.text(`• ${String(item).trim()}`, { width: CONTENT_WIDTH - 15, indent: 15 });
  });
  doc.moveDown(0.5);
}

/**
 * Fill the PDF document with the full report. Call after doc.pipe(res) and then call doc.end().
 * @param {PDFKit.PDFDocument} doc
 * @param {object} data - Full report: { report: { user, repos, stats }, scores?, scoreBreakdown?, strengthsWeaknesses?, technicalHighlights?, improvementSuggestions?, hiringRecommendation? }
 */
function fillReportPdf(doc, data) {
  const report = data.report || {};
  const user = report.user || {};
  const stats = report.stats || {};
  const username = user.login || user.name || "candidate";
  const displayName = user.name || user.login || username;

  doc.fontSize(22).font("Helvetica-Bold").fillColor("#1a1a1a").text("GitHunter — Candidate Report", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(12).font("Helvetica").fillColor("#555555").text(displayName, { align: "center" });
  doc.text(`@${username}`, { align: "center" });
  doc.moveDown(1);

  // Overview
  sectionTitle(doc, "Overview");
  const repos = report.repos?.length ?? user.public_repos ?? 0;
  const stars = stats.stars ?? 0;
  const forks = stats.fork_count ?? 0;
  bodyText(doc, `Public repositories: ${repos}  •  Stars: ${stars}  •  Forks: ${forks}`);
  const lang = stats.language;
  if (lang && typeof lang === "object" && Object.keys(lang).length > 0) {
    const langList = Object.entries(lang)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => `${name}: ${count}`)
      .join("  •  ");
    bodyText(doc, `Top languages: ${langList}`);
  }
  doc.moveDown(0.5);

  // Scores
  const scores = data.scores;
  if (scores && (scores.overallScore != null || scores.categoryScores)) {
    sectionTitle(doc, "AI Scores");
    if (scores.overallScore != null) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text(`Overall: ${scores.overallScore}/100`, { continued: false });
      doc.moveDown(0.3);
    }
    const cat = scores.categoryScores;
    if (cat) {
      const lines = [];
      if (cat.codeQuality != null) lines.push(`Code Quality: ${cat.codeQuality}`);
      if (cat.projectComplexity != null) lines.push(`Project Complexity: ${cat.projectComplexity}`);
      if (cat.documentation != null) lines.push(`Documentation: ${cat.documentation}`);
      if (cat.consistency != null) lines.push(`Consistency: ${cat.consistency}`);
      if (cat.technicalBreadth != null) lines.push(`Technical Breadth: ${cat.technicalBreadth}`);
      if (lines.length) bodyText(doc, lines.join("  •  "));
    }
    doc.moveDown(0.5);
  }

  // Score breakdown
  const scoreBreakdown = (data.scoreBreakdown || "").trim();
  if (scoreBreakdown) {
    sectionTitle(doc, "Score breakdown");
    bodyText(doc, scoreBreakdown);
  }

  // Strengths & Weaknesses
  const sw = data.strengthsWeaknesses;
  if (sw && ((Array.isArray(sw.strengths) && sw.strengths.length > 0) || (Array.isArray(sw.weaknesses) && sw.weaknesses.length > 0))) {
    sectionTitle(doc, "Strengths & weaknesses");
    if (Array.isArray(sw.strengths) && sw.strengths.length > 0) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text("Strengths", { continued: false });
      doc.moveDown(0.2);
      bulletList(doc, sw.strengths);
    }
    if (Array.isArray(sw.weaknesses) && sw.weaknesses.length > 0) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text("Weaknesses", { continued: false });
      doc.moveDown(0.2);
      bulletList(doc, sw.weaknesses);
    }
  }

  // Technical highlights
  const highlights = data.technicalHighlights;
  if (Array.isArray(highlights) && highlights.length > 0) {
    sectionTitle(doc, "Technical highlights");
    bulletList(doc, highlights);
  }

  // Improvement suggestions
  const suggestions = data.improvementSuggestions;
  if (Array.isArray(suggestions) && suggestions.length > 0) {
    sectionTitle(doc, "Improvement suggestions");
    bulletList(doc, suggestions);
  }

  // Hiring recommendation
  const rec = (data.hiringRecommendation || "").trim();
  if (rec && !rec.includes("GEMINI_API_KEY not set")) {
    sectionTitle(doc, "Hiring recommendation");
    bodyText(doc, rec);
  }

  doc.moveDown(1);
  doc.fontSize(9).font("Helvetica").fillColor("#888888").text("Generated by GitHunter", { align: "center" });
}

/**
 * Create a new PDF document. Caller must: doc.pipe(res), then fillReportPdf(doc, data), then doc.end().
 * Content must be written after piping so the stream is correct.
 * @returns {PDFKit.PDFDocument}
 */
function createReportPdf() {
  return new PDFDocument({ margin: MARGIN, size: "LETTER" });
}

module.exports = { fillReportPdf, createReportPdf };
