const express = require("express");

const pool = require("../db/pool");
const { requireAdmin } = require("../middleware/auth");
const { removeAttachment } = require("../services/storageService");
const { renderPage } = require("../utils/render");

const router = express.Router();

function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function removeSessionForUser(userId) {
  await pool.query(
    `
    DELETE FROM sessions
    WHERE sess->>'userId' = $1
    `,
    [String(userId)]
  );
}

async function removeStoredAttachments(rows) {
  await Promise.all(
    rows
      .filter((row) => row.storage_key)
      .map((row) =>
        removeAttachment(row.storage_key).catch((error) => {
          console.error("Could not remove attachment:", error);
        })
      )
  );
}

async function getDashboardData() {
  const [statsResult, usersResult, channelsResult, messagesResult] =
    await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users_app) AS user_count,
          (SELECT COUNT(*)::int FROM users_app WHERE is_banned = true) AS banned_count,
          (SELECT COUNT(*)::int FROM channels) AS channel_count,
          (SELECT COUNT(*)::int FROM messages) AS message_count
      `),
      pool.query(`
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.email,
          u.role,
          u.is_banned,
          u.banned_reason,
          u.created_at,
          u.last_seen_at,
          COUNT(m.id)::int AS message_count
        FROM users_app u
        LEFT JOIN messages m ON m.user_id = u.id
        GROUP BY u.id
        ORDER BY
          CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END,
          u.is_banned ASC,
          u.created_at DESC
      `),
      pool.query(`
        SELECT
          c.id,
          c.name,
          c.description,
          c.created_at,
          COUNT(DISTINCT m.id)::int AS message_count,
          COUNT(DISTINCT a.id)::int AS attachment_count
        FROM channels c
        LEFT JOIN messages m ON m.channel_id = c.id
        LEFT JOIN attachments a ON a.message_id = m.id
        GROUP BY c.id
        ORDER BY c.id ASC
      `),
      pool.query(`
        SELECT
          m.id,
          m.content,
          m.created_at,
          c.name AS channel_name,
          u.username,
          u.display_name
        FROM messages m
        JOIN channels c ON c.id = m.channel_id
        JOIN users_app u ON u.id = m.user_id
        ORDER BY m.created_at DESC
        LIMIT 20
      `)
    ]);

  return {
    stats: statsResult.rows[0],
    users: usersResult.rows,
    channels: channelsResult.rows,
    recentMessages: messagesResult.rows
  };
}

router.get("/admin", requireAdmin, async (req, res, next) => {
  try {
    await renderPage(req, res, "admin", {
      pageTitle: "Admin - CloudChat",
      bodyClass: "admin-page",
      ...(await getDashboardData())
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/users/:userId/ban", requireAdmin, async (req, res, next) => {
  try {
    const userId = toId(req.params.userId);
    const reason = String(req.body.reason || "").trim().slice(0, 240);

    if (!userId) {
      req.flash("error", "Invalid user.");
      return res.redirect("/admin");
    }

    if (userId === req.currentUser.id) {
      req.flash("error", "You cannot ban your own account.");
      return res.redirect("/admin");
    }

    await pool.query(
      `
      UPDATE users_app
      SET is_banned = true,
          banned_at = CURRENT_TIMESTAMP,
          banned_by = $1,
          banned_reason = $2
      WHERE id = $3
      `,
      [req.currentUser.id, reason || null, userId]
    );

    await removeSessionForUser(userId);
    req.flash("info", "User banned.");
    res.redirect("/admin");
  } catch (error) {
    next(error);
  }
});

router.post("/admin/users/:userId/unban", requireAdmin, async (req, res, next) => {
  try {
    const userId = toId(req.params.userId);

    if (!userId) {
      req.flash("error", "Invalid user.");
      return res.redirect("/admin");
    }

    await pool.query(
      `
      UPDATE users_app
      SET is_banned = false,
          banned_at = NULL,
          banned_by = NULL,
          banned_reason = NULL
      WHERE id = $1
      `,
      [userId]
    );

    req.flash("info", "User unbanned.");
    res.redirect("/admin");
  } catch (error) {
    next(error);
  }
});

router.post("/admin/users/:userId/promote", requireAdmin, async (req, res, next) => {
  try {
    const userId = toId(req.params.userId);

    if (!userId) {
      req.flash("error", "Invalid user.");
      return res.redirect("/admin");
    }

    await pool.query("UPDATE users_app SET role = 'admin' WHERE id = $1", [userId]);
    req.flash("info", "User promoted to admin.");
    res.redirect("/admin");
  } catch (error) {
    next(error);
  }
});

router.post("/admin/users/:userId/demote", requireAdmin, async (req, res, next) => {
  try {
    const userId = toId(req.params.userId);

    if (!userId) {
      req.flash("error", "Invalid user.");
      return res.redirect("/admin");
    }

    if (userId === req.currentUser.id) {
      req.flash("error", "You cannot demote your own account.");
      return res.redirect("/admin");
    }

    await pool.query("UPDATE users_app SET role = 'member' WHERE id = $1", [userId]);
    req.flash("info", "Admin role removed.");
    res.redirect("/admin");
  } catch (error) {
    next(error);
  }
});

router.post("/admin/users/:userId/delete", requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const userId = toId(req.params.userId);

    if (!userId) {
      req.flash("error", "Invalid user.");
      return res.redirect("/admin");
    }

    if (userId === req.currentUser.id) {
      req.flash("error", "You cannot delete your own account.");
      return res.redirect("/admin");
    }

    await client.query("BEGIN");

    const attachmentsResult = await client.query(
      `
      SELECT a.storage_key
      FROM attachments a
      JOIN messages m ON m.id = a.message_id
      WHERE m.user_id = $1
      `,
      [userId]
    );

    await client.query("DELETE FROM users_app WHERE id = $1", [userId]);
    await client.query("DELETE FROM sessions WHERE sess->>'userId' = $1", [
      String(userId)
    ]);
    await client.query("COMMIT");

    await removeStoredAttachments(attachmentsResult.rows);
    req.flash("info", "User deleted.");
    res.redirect("/admin");
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.post("/admin/channels/:channelId/delete", requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const channelId = toId(req.params.channelId);

    if (!channelId) {
      req.flash("error", "Invalid channel.");
      return res.redirect("/admin");
    }

    await client.query("BEGIN");

    const attachmentsResult = await client.query(
      `
      SELECT a.storage_key
      FROM attachments a
      JOIN messages m ON m.id = a.message_id
      WHERE m.channel_id = $1
      `,
      [channelId]
    );

    await client.query("DELETE FROM channels WHERE id = $1", [channelId]);
    await client.query("COMMIT");

    await removeStoredAttachments(attachmentsResult.rows);
    req.flash("info", "Channel deleted.");
    res.redirect("/admin");
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.post("/admin/messages/:messageId/delete", requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const messageId = toId(req.params.messageId);

    if (!messageId) {
      req.flash("error", "Invalid message.");
      return res.redirect("/admin");
    }

    await client.query("BEGIN");

    const attachmentsResult = await client.query(
      `
      SELECT storage_key
      FROM attachments
      WHERE message_id = $1
      `,
      [messageId]
    );

    await client.query("DELETE FROM messages WHERE id = $1", [messageId]);
    await client.query("COMMIT");

    await removeStoredAttachments(attachmentsResult.rows);
    req.flash("info", "Message deleted.");
    res.redirect(req.get("Referrer") || "/admin");
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
