const { Pool } = require("pg");

const useSsl =
  process.env.DB_SSL === "true" ||
  process.env.APP_MODE === "aws" ||
  process.env.NODE_ENV === "production";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "discord_local",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  ssl: useSsl
    ? {
        rejectUnauthorized: false
      }
    : false
});

module.exports = pool;
