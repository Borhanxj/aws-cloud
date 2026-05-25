const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      app: "CloudChat",
      mode: process.env.APP_MODE || "local",
      database: "connected",
      authenticated: Boolean(req.currentUser),
      server: process.env.SERVER_NAME || "local-dev-server"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      app: "CloudChat",
      database: "not connected"
    });
  }
});

module.exports = router;
