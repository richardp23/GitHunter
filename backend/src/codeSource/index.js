/**
 * Pluggable code source: API (default) or clone (Phase 2).
 * Consumed by analysis pipeline; produces { username, repos: [{ name, files: [{ path, content, language }] }] }.
 */
const apiSource = require("./apiSource");

/**
 * @param {string} username
 * @param {Array<object>} repos - repo list from buildReport (report.repos)
 * @param {{ useClone?: boolean }} [opts]
 * @returns {Promise<{ repos: Array<{ name: string, files: Array<{ path: string, content: string, language: string }> }>}>}
 */
async function fetchCodeSamples(username, repos, opts = {}) {
  if (opts.useClone) {
    // Phase 2: cloneSource not implemented yet; fallback to API
    // const cloneSource = require('./cloneSource');
    // return cloneSource.fetchFromClone(username, repos).catch(() => apiSource.fetchFromApi(username, repos));
    return apiSource.fetchFromApi(username, repos);
  }
  return apiSource.fetchFromApi(username, repos);
}

module.exports = { fetchCodeSamples };
