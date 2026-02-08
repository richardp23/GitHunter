const userRoutes = require("./user");
const analyzeRoutes = require("./analyze");
const matchmakerRoutes = require("./matchmaker");
const slidesRoutes = require("./slides");
const enterpriseRoutes = require("./enterprise");

function mountRoutes(app) {
  app.use("/api/user", userRoutes);
  app.use("/api", analyzeRoutes);   // POST /api/analyze, GET /api/status/:jobId, GET /api/report/:jobId
  app.use("/api/matchmaker", matchmakerRoutes);
  app.use("/api/slides", slidesRoutes); // POST /api/slides/generate
  app.use("/api/enterprise", enterpriseRoutes); // GET /api/enterprise/list, GET /api/enterprise/ensure/:username
}

module.exports = { mountRoutes };
