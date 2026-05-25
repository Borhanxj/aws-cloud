const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const createPgSession = require("connect-pg-simple");

const pool = require("./db/pool");
const { flashMiddleware } = require("./middleware/flash");
const { loadCurrentUser } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const channelRoutes = require("./routes/channelRoutes");
const healthRoutes = require("./routes/healthRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { formatDateTime, formatFileSize, getInitials } = require("./utils/text");

const app = express();
const PgSession = createPgSession(session);

const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (process.env.APP_MODE === "aws") {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(uploadDir));

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: true
    }),
    name: "cloudchat.sid",
    secret: process.env.SESSION_SECRET || "change-this-local-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.locals.appName = "CloudChat";
app.locals.formatDateTime = formatDateTime;
app.locals.formatFileSize = formatFileSize;
app.locals.getInitials = getInitials;

app.use(flashMiddleware);
app.use(loadCurrentUser);

app.use((req, res, next) => {
  res.locals.mode = process.env.APP_MODE || "local";
  res.locals.serverName = process.env.SERVER_NAME || "local-dev-server";
  res.locals.pageTitle = "CloudChat";
  next();
});

app.use(healthRoutes);
app.use(authRoutes);
app.use(channelRoutes);
app.use(messageRoutes);

app.use((req, res) => {
  res.status(404).render("layout", {
    pageTitle: "Not found - CloudChat",
    bodyClass: "auth-page",
    body: `
      <main class="empty-state">
        <div class="brand-mark">CC</div>
        <h1>Page not found</h1>
        <p>This route does not exist.</p>
        <a class="button primary" href="/">Back to CloudChat</a>
      </main>
    `
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render("layout", {
    pageTitle: "Application error - CloudChat",
    bodyClass: "auth-page",
    body: `
      <main class="empty-state">
        <div class="brand-mark">CC</div>
        <h1>Application error</h1>
        <p>Check the terminal logs for details.</p>
        <a class="button primary" href="/">Back to CloudChat</a>
      </main>
    `
  });
});

module.exports = app;
