const userRoutes = require("./user");
const analyzeRoutes = require("./analyze");
const matchmakerRoutes = require("./matchmaker");

function mountRoutes(app) {
  app.use("/api/user", userRoutes);
  app.use("/api", analyzeRoutes);   // POST /api/analyze, GET /api/status/:jobId, GET /api/report/:jobId
  app.use("/api/matchmaker", matchmakerRoutes);
}

module.exports = { mountRoutes };
