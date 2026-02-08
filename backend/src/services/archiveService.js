/**
 * Long-term storage of reports in Supabase. Optional; app runs without it if env is unset.
 * Table: archived_reports (username text PK, report jsonb, created_at timestamptz).
 */
const { createClient } = require("@supabase/supabase-js");
const { SUPABASE_URL, SUPABASE_KEY } = require("../config/env");

const TABLE = "archived_reports";

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

/**
 * Save (upsert) full report to Supabase. No-op if Supabase not configured.
 * @param {string} username - Canonical GitHub login
 * @param {object} report - Full runAnalysis result (report, scores, etc.)
 */
async function saveReport(username, report) {
  const supabase = getClient();
  if (!supabase) {
    console.log("[Archive] Supabase not configured, skipping save for", username);
    return;
  }
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { username, report, created_at: new Date().toISOString() },
        { onConflict: "username" }
      );
    if (error) throw error;
    console.log("[Archive] Saved report for", username);
  } catch (err) {
    console.error("[Archive] saveReport error for", username, ":", err?.message);
  }
}

/**
 * List archived entries for the enterprise portal: username, score, avatar_url.
 * Returns [] if Supabase unavailable or empty.
 */
async function listArchived() {
  const supabase = getClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from(TABLE).select("username, report");
    if (error) throw error;
    if (!data || !data.length) return [];
    return data.map((row) => {
      const r = row.report || {};
      const score = r.scores?.overallScore ?? null;
      const avatar_url = r.report?.user?.avatar_url ?? "";
      return { username: row.username, score, avatar_url };
    });
  } catch (err) {
    console.error("[Archive] listArchived error:", err?.message);
    return [];
  }
}

/**
 * Get full report by username from Supabase. Returns null if not found or Supabase unavailable.
 */
async function getReport(username) {
  const supabase = getClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("report")
      .eq("username", username)
      .maybeSingle();
    if (error) throw error;
    return data?.report ?? null;
  } catch (err) {
    console.error("[Archive] getReport error for", username, ":", err?.message);
    return null;
  }
}

module.exports = { saveReport, listArchived, getReport };
