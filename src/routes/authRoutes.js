const express = require("express");
const bcrypt = require("bcryptjs");

const pool = require("../db/pool");
const { redirectIfAuthenticated } = require("../middleware/auth");
const { renderPage } = require("../utils/render");
const {
  cleanDisplayName,
  normalizeUsername,
  pickAvatarColor
} = require("../utils/text");

const router = express.Router();

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

router.get("/login", redirectIfAuthenticated, async (req, res, next) => {
  try {
    await renderPage(req, res, "login", {
      pageTitle: "Sign in - CloudChat",
      bodyClass: "auth-page",
      form: {
        username: ""
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/register", redirectIfAuthenticated, async (req, res, next) => {
  try {
    await renderPage(req, res, "register", {
      pageTitle: "Create account - CloudChat",
      bodyClass: "auth-page",
      form: {
        username: "",
        displayName: "",
        email: ""
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/register", redirectIfAuthenticated, async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const displayName = cleanDisplayName(req.body.display_name, username);
    const email = String(req.body.email || "").trim().toLowerCase() || null;
    const password = String(req.body.password || "");

    if (username.length < 3) {
      req.flash("error", "Username must be at least 3 characters.");
      return res.redirect("/register");
    }

    if (password.length < 6) {
      req.flash("error", "Password must be at least 6 characters.");
      return res.redirect("/register");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO users_app (username, display_name, email, password_hash, avatar_color)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [username, displayName, email, passwordHash, pickAvatarColor(username)]
    );

    await regenerateSession(req);
    req.session.userId = result.rows[0].id;
    await saveSession(req);

    res.redirect("/");
  } catch (error) {
    if (error.code === "23505") {
      req.flash("error", "That username or email is already registered.");
      return res.redirect("/register");
    }

    next(error);
  }
});

router.post("/login", redirectIfAuthenticated, async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");

    const result = await pool.query(
      `
      SELECT id, password_hash
      FROM users_app
      WHERE username = $1
      `,
      [username]
    );

    const user = result.rows[0];
    const validPassword =
      user?.password_hash && (await bcrypt.compare(password, user.password_hash));

    if (!validPassword) {
      req.flash("error", "Invalid username or password.");
      return res.redirect("/login");
    }

    await pool.query(
      `
      UPDATE users_app
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [user.id]
    );

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie("cloudchat.sid");
    res.redirect("/login");
  });
});

module.exports = router;
