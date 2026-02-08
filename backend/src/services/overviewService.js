const { buildReport } = require("./githubService");
const { getOverviewByUsername, setOverviewByUsername } = require("../utils/cache");
const githubApi = require("./githubApi");

async function getOverview(username) {
  const cached = await getOverviewByUsername(username);
  if (cached) {
    console.log(`AI Overview: Cache hit for ${username}`);
    return cached;
  }

  const result = await buildReport(username);
  const repos = result.report.repos;
  const enhancedRepos = [];

  for (const repo of repos) {
    const owner = repo.owner.login;
    const name = repo.name;

    let content = "";
    try {
      const res = await githubApi.get(
        `https://api.github.com/repos/${owner}/${name}/contents/README.md`
      );
      content = Buffer.from(res.data.content, "base64").toString("utf8");
    } catch {}

    let commitData = { commit_count: 0, commits: [] };
    try {
      const res = await githubApi.get(
        `https://api.github.com/repos/${owner}/${name}/commits?per_page=100`
      );
      commitData = {
        commit_count: res.data.length,
        commits: res.data.map((c) => ({
          message: c.commit.message,
          date: c.commit.author.date,
        })),
      };
    } catch {}

    let pullData = { pull_count: 0, merged_count: 0 };
    try {
      const res = await githubApi.get(
        `https://api.github.com/repos/${owner}/${name}/pulls?state=all&per_page=100`
      );
      const pulls = res.data;
      const merged = pulls.filter((p) => p.merged_at !== null).length;
      pullData = { pull_count: pulls.length, merged_count: merged };
    } catch {}

    enhancedRepos.push({
      repo: name,
      readme: content,
      commits: commitData,
      pulls: pullData,
    });
  }

  const overview_result = {
    generalData: result,
    enhancedRepos,
  };

  await setOverviewByUsername(username, overview_result);
  return overview_result;
}

module.exports = { getOverview };
