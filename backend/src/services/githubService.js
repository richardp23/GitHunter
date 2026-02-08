const githubApi = require("./githubApi");

/**
 * Fetch pinned repo names for a user (GraphQL; not available in REST).
 * Returns array of repo names in pin order. Empty if no token or error.
 */
async function getPinnedRepoNames(username) {
  try {
    const res = await githubApi.post("https://api.github.com/graphql", {
      query: "query($login: String!) { user(login: $login) { pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name } } } } }",
      variables: { login: username },
    });
    const nodes = res?.data?.data?.user?.pinnedItems?.nodes || [];
    return nodes.map((n) => n.name).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Sort repos for interviewer relevance: pinned first (candidate showcase), then stars, forks, activity.
 */
function sortReposForReport(repos, pinnedNames) {
  const pinnedSet = new Set((pinnedNames || []).map((n) => n.toLowerCase()));
  return [...repos].sort((a, b) => {
    const aPinned = pinnedSet.has((a.name || "").toLowerCase());
    const bPinned = pinnedSet.has((b.name || "").toLowerCase());
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (aPinned && bPinned) {
      const ai = pinnedNames.indexOf(a.name);
      const bi = pinnedNames.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }
    const starsDiff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
    if (starsDiff !== 0) return starsDiff;
    const forksDiff = (b.forks_count || 0) - (a.forks_count || 0);
    if (forksDiff !== 0) return forksDiff;
    return new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0);
  });
}

async function buildReport(username) {
  const userResponse = await githubApi.get(`https://api.github.com/users/${username}`);
  const userData = userResponse.data;

  const [repoResponse, pinnedNames] = await Promise.all([
    githubApi.get(userData.repos_url),
    getPinnedRepoNames(username),
  ]);
  const repoData = repoResponse.data;
  const sortedRepos = sortReposForReport(repoData, pinnedNames);

  const languageCounts = {};
  sortedRepos.forEach((repo) => {
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
    }
  });

  let forkCount = 0;
  sortedRepos.forEach((repo) => {
    if (repo.fork) forkCount += 1;
  });

  let forked_projects = 0;
  sortedRepos.forEach((repo) => {
    forked_projects += repo.forks_count;
  });

  const project_descriptions = sortedRepos.map((r) => r.description);

  let totalStars = 0;
  let totalWatchers = 0;
  let totalSize = 0;
  sortedRepos.forEach((repo) => {
    totalStars += repo.stargazers_count;
    totalWatchers += repo.watchers_count;
    totalSize += repo.size;
  });

  const topRepos = sortedRepos.filter((r) => !r.fork).slice(0, 15);

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
    repos: sortedRepos,
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
