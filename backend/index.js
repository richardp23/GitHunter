const express = require("express"); //create express server
const axios = require("axios"); //api calling
const app = express(); //app creation

// test express backend


app.get("/", (req, res) => { res.send("Backend is running"); }); 
app.listen(5000, () => { console.log("Server running on port 5000"); });

//get username and make call to express server to retrieve user data. 
//To do: retreive information from the user

/* 
app.get("/api/user/:username", async (req, res) => {
  const username = req.params.username;

  try {
    const response = await axios.get(`https://api.github.com/users/${username}`);
    res.json(response.data);
    console.log(response.data);
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }
});
*/



