const express = require("express"); //create express server
const axios = require("axios"); //api calling
const cors = require("cors"); //cross-origin resource sharing
const app = express(); //app creation

app.use(cors());

app.listen(5000, () => { console.log("Server running on port 5000"); });
 
app.get("/api/user/:username", async (req, res) => {
  const username = req.params.username;

  try {
    //get user 
    const userReponse = await axios.get(`https://api.github.com/users/${username}`);
    const userData = userReponse.data;

    //get repo data from user 
    const repoResponse = await axios.get(userData.repos_url);
    const repoData = repoResponse.data;
    
    // console.log(repoData); 
    //user repo data

  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }
});

