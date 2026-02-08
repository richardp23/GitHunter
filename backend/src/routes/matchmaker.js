const express = require("express");
// Phase 4: search pre-seeded pool, return ranked matches

const router = express.Router();

/**
 * GET /api/matchmaker?role=&skills=&level=
 * Placeholder for Phase 4.
 */
router.get("/", (req, res) => {
  res.status(501).json({ error: "Matchmaker not implemented yet." });
});

module.exports = router;
