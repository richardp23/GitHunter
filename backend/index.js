const express = require("express"); //create express server
const axios = require("axios"); //api calling
const cors = require("cors"); //cross-origin resource sharing
const app = express(); //app creation

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

app.listen(5000, () => { console.log("Server running on port 5000"); });
 
app.get("/api/user/:username", async (req, res) => {
  const username = req.params.username;
  console.log(`Request received for user: ${username}`);

  try {
    //get user 
    const userReponse = await axios.get(`https://api.github.com/users/${username}`);
    const userData = userReponse.data;

    //get repo data from user 
    const repoResponse = await axios.get(userData.repos_url);
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
            stars: totalStars
        }
    };

    //send all the data to the frontend
    res.json({report: userReport});
    
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }

});

