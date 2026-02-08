const { buildReport } = require("../services/githubService");
const { getReportByUsername, setReportByUsername } = require("../utils/cache");
const githubApi = require("../services/githubApi"); // <-- you must import this

async function getOverview(username) {
  // 1. Try Redis first
  const cached = await getReportByUsername(username);
  if (cached) {
    console.log(`AI Overview: Cache hit for ${username}`);
    return cached;
  }

  // 2. Build the base report
  const result = await buildReport(username);

  // 3. Extract repos
  const repos = result.report.repos;

  // 4. Enhanced data for each repo
  const enhancedRepos = [];

  for (const repo of repos) {
    const owner = repo.owner.login;
    const name = repo.name;

    // README
    let content = "";
    try {
      const res = await githubApi.get(
        `https://api.github.com/repos/${owner}/${name}/contents/README.md`
      );
      content = Buffer.from(res.data.content, "base64").toString("utf8");
    } catch {}

    // COMMITS
    let commitData = { commit_count: 0, commits: [] };
    try {
      const res = await githubApi.get(
        `https://api.github.com/repos/${owner}/${name}/commits?per_page=100`
      );
      commitData = {
        commit_count: res.data.length,
        commits: res.data.map(c => ({
          message: c.commit.message,
          date: c.commit.author.date
        }))
      };
    } catch {}

    // PULL REQUESTS
    let pullData = { pull_count: 0, merged_count: 0 };
    try {
      const res = await githubApi.get(
        `https://api.github.com/repos/${owner}/${name}/pulls?state=all&per_page=100`
      );
      const pulls = res.data;
      const merged = pulls.filter(p => p.merged_at !== null).length;

      pullData = {
        pull_count: pulls.length,
        merged_count: merged
      };
    } catch {}

    enhancedRepos.push({
      repo: name,
      readme: content,
      commits: commitData,
      pulls: pullData
    });
  }

  // 5. Save to Redis
  const overview_result = {
    generalData: result,
    enhancedRepos
  };

  await setReportByUsername(username, overview_result);

  // 6. Return everything
  return overview_result;
}

module.exports = { getOverview };
