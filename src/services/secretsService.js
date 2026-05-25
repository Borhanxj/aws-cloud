async function getDatabaseSecret() {
  if (process.env.APP_MODE !== "aws") {
    return {
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    };
  }

  throw new Error("AWS Secrets Manager loading will be connected during the cloud deployment step.");
}

module.exports = {
  getDatabaseSecret
};
