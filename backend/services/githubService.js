const axios = require("axios");

const githubApi = axios.create({
  headers: process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {},
});

async function buildReport(username) {
  const userResponse = await githubApi.get(`https://api.github.com/users/${username}`);
  const userData = userResponse.data;

  const repoResponse = await githubApi.get(userData.repos_url);
  const repoData = repoResponse.data;

  const languageCounts = {};
  repoData.forEach((repo) => {
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
    }
  });

  let forkCount = 0;
  repoData.forEach((repo) => {
    if (repo.fork) forkCount += 1;
  });

  let forked_projects = 0;
  repoData.forEach((repo) => {
    forked_projects += repo.forks_count;
  });

  const project_descriptions = repoData.map((r) => r.description);

  let totalStars = 0;
  let totalWatchers = 0;
  let totalSize = 0;
  repoData.forEach((repo) => {
    totalStars += repo.stargazers_count;
    totalWatchers += repo.watchers_count;
    totalSize += repo.size;
  });

  const topRepos = [...repoData]
    .filter((r) => !r.fork)
    .sort((a, b) => {
      const starsDiff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
      if (starsDiff !== 0) return starsDiff;
      return new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0);
    })
    .slice(0, 15);

  let totalCommits = 0;
  let totalPulls = 0;

  for (const repo of topRepos) {
    const owner = repo.owner?.login || username;
    const fullName = `${owner}/${repo.name}`;
    try {
      const [commitsRes, pullsRes] = await Promise.all([
        githubApi.get(`https://api.github.com/repos/${fullName}/commits?per_page=30`),
        githubApi.get(`https://api.github.com/repos/${fullName}/pulls?state=all&per_page=30`),
      ]);
      totalCommits += commitsRes.data.length;
      totalPulls += pullsRes.data.length;
    } catch {
      // Skip repo on 404/403
    }
  }

  const userReport = {
    user: userData,
    repos: repoData,
    stats: {
      language: languageCounts,
      project_type: project_descriptions,
      fork_count: forkCount,
      user_forked_projects: forked_projects,
      repo_size: totalSize,
      watchers: totalWatchers,
      stars: totalStars,
      commits: totalCommits,
      pulls: totalPulls,
    },
  };

  return { report: userReport };
}

module.exports = { buildReport };
