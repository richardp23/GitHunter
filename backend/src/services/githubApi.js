const axios = require("axios");
const { GITHUB_TOKEN } = require("../config/env");

const githubApi = axios.create({
  headers: GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {},
});

module.exports = githubApi;
