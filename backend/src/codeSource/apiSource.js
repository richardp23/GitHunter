/**
 * Fetch code samples via GitHub Trees API + Contents API.
 * Target: package.json, README, entry points, tests, .github/workflows, configs.
 * Cap: ~15–20 files per repo, ~100–150 lines per file.
 */
const githubApi = require("../services/githubApi");

const MAX_FILES_PER_REPO = 18;
const MAX_LINES_PER_FILE = 150;

const PRIORITY_PATTERNS = [
  { pattern: /^package\.json$/i, weight: 100 },
  { pattern: /^README\.(md|mdx|txt)$/i, weight: 95 },
  { pattern: /^(src\/)?index\.(js|ts|jsx|tsx)$/, weight: 90 },
  { pattern: /^(src\/)?(main|app)\.(js|ts|jsx|tsx)$/, weight: 85 },
  { pattern: /\.(test|spec)\.(js|ts|jsx|tsx)$/, weight: 80 },
  { pattern: /^(src\/)?__tests__\//, weight: 75 },
  { pattern: /^\.github\/workflows\//, weight: 70 },
  { pattern: /^(tsconfig|webpack|vite|rollup|jest|babel)\./, weight: 65 },
  { pattern: /^\.(env|eslintrc|prettierrc)/, weight: 60 },
  { pattern: /\.(js|ts|jsx|tsx)$/, weight: 50 },
  { pattern: /\.(json|yaml|yml)$/, weight: 40 },
];

function scorePath(path) {
  for (const { pattern, weight } of PRIORITY_PATTERNS) {
    if (pattern.test(path)) return weight;
  }
  return 10;
}

function inferLanguage(path) {
  if (/\.(js|jsx|mjs|cjs)$/i.test(path)) return "JavaScript";
  if (/\.(ts|tsx)$/i.test(path)) return "TypeScript";
  if (/\.(json)$/i.test(path)) return "JSON";
  if (/\.(md|mdx)$/i.test(path)) return "Markdown";
  if (/\.(yaml|yml)$/i.test(path)) return "YAML";
  if (/\.(py)$/i.test(path)) return "Python";
  if (/\.(go)$/i.test(path)) return "Go";
  if (/\.(rs)$/i.test(path)) return "Rust";
  return "Text";
}

function truncateLines(text, maxLines = MAX_LINES_PER_FILE) {
  const lines = text.split(/\r?\n/);
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + "\n// ... truncated";
}

/**
 * @param {string} owner
 * @param {string} repoName
 * @param {string} [branch]
 * @returns {Promise<Array<{ path: string, content: string, language: string }>>}
 */
async function fetchRepoFiles(owner, repoName, branch = "HEAD") {
  try {
    const treeRes = await githubApi.get(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`
    );
    const tree = treeRes.data.tree || [];
    const blobs = tree.filter((n) => n.type === "blob" && n.path && !n.path.includes("node_modules"));
    const scored = blobs.map((n) => ({ path: n.path, score: scorePath(n.path) }));
    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, MAX_FILES_PER_REPO).map((s) => s.path);

    const files = [];
    for (const path of selected) {
      try {
        const contentRes = await githubApi.get(
          `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`
        );
        const data = contentRes.data;
        if (data.encoding === "base64" && data.content) {
          const raw = Buffer.from(data.content, "base64").toString("utf8");
          const content = truncateLines(raw);
          files.push({ path, content, language: inferLanguage(path) });
        }
      } catch {
        // Skip file on 404 or size limit
      }
    }
    return files;
  } catch (err) {
    return [];
  }
}

/**
 * Fetch code samples for given repos using GitHub API only.
 * @param {string} username
 * @param {Array<{ name: string, owner?: { login: string }, default_branch?: string }>} repos - from buildReport
 * @returns {Promise<{ repos: Array<{ name: string, files: Array<{ path: string, content: string, language: string }> }>}>}
 */
async function fetchFromApi(username, repos) {
  const topRepos = (repos || [])
    .filter((r) => !r.fork)
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 15);

  const results = [];
  for (const repo of topRepos) {
    const owner = repo.owner?.login || username;
    const branch = repo.default_branch || "main";
    const files = await fetchRepoFiles(owner, repo.name, branch);
    results.push({ name: repo.name, files });
  }
  return { repos: results };
}

module.exports = { fetchFromApi, fetchRepoFiles };
