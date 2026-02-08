require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

// GitHub API client with auth (5000 req/hr when authenticated vs 60 unauthenticated)
const githubApi = axios.create({
  headers: process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {},
});

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

if (require.main === module) {
  app.listen(5000, () => { console.log("Server running on port 5000"); });
}

module.exports = app;
 
app.get("/api/user/:username", async (req, res) => {
  const username = req.params.username;
  console.log(`Request received for user: ${username}`);

  try {
    // get user
    const userReponse = await githubApi.get(`https://api.github.com/users/${username}`);
    const userData = userReponse.data;

    // get repo data from user
    const repoResponse = await githubApi.get(userData.repos_url);
    const repoData = repoResponse.data;

    //create an object that holds the programming lanugages and how many repos are in that langauge
    const languageCounts = {};
    repoData.forEach(repo => {
        if (repo.language) {
            languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
        }
    });

    //get fork count
    let forkCount = 0;
    repoData.forEach(repo => {
        if(repo.fork) {
             forkCount += 1
        }
    });

    //get projects from this user that have been forked
    let forked_projects = 0;
    repoData.forEach(repo => {
       forked_projects += repo.forks_count;
    });

    //get project descriptions
    const project_descriptions = [];
    repoData.forEach(repo => {
        project_descriptions.push(repo.description);
    });

    let totalStars = 0;
    let totalWatchers = 0;
    let totalSize = 0;
    repoData.forEach(repo => {
        totalStars += repo.stargazers_count;
        totalWatchers += repo.watchers_count;
        totalSize += repo.size;
    });

    // Limit heavy API calls to top 15 repos (by stars, then recency) to avoid rate limits
    const topRepos = [...repoData]
      .filter(r => !r.fork)
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
        // Skip this repo on 404/403; don't fail the whole request
      }
    }

    //Creates a user report that holds all the personal information about the user
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
        }
    };

    //send all the data to the frontend
    res.json({report: userReport});
    
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }

});

