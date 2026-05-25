const pool = require("../db/pool");

async function loadCurrentUser(req, res, next) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      req.currentUser = null;
      res.locals.currentUser = null;
      return next();
    }

    const result = await pool.query(
      `
      SELECT id, username, display_name, email, avatar_color, created_at, last_seen_at
      FROM users_app
      WHERE id = $1
      `,
      [userId]
    );

    req.currentUser = result.rows[0] || null;
    res.locals.currentUser = req.currentUser;

    if (!req.currentUser) {
      delete req.session.userId;
    }

    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    req.flash("info", "Please sign in first.");
    return res.redirect("/login");
  }

  next();
}

function redirectIfAuthenticated(req, res, next) {
  if (req.currentUser) {
    return res.redirect("/");
  }

  next();
}

module.exports = {
  loadCurrentUser,
  requireAuth,
  redirectIfAuthenticated
};
