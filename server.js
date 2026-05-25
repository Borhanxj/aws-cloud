require("dotenv").config();

const app = require("./src/app");
const { initializeDatabase } = require("./src/db/init");

const PORT = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`CloudChat running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start CloudChat:", error);
    process.exit(1);
  });