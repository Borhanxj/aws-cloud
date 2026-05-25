const express = require("express");

const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { renderPage } = require("../utils/render");
const { slugifyChannelName } = require("../utils/text");

const router = express.Router();

async function getChannels() {
  const result = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.description,
      c.created_at,
      COUNT(m.id)::int AS message_count,
      MAX(m.created_at) AS last_message_at
    FROM channels c
    LEFT JOIN messages m ON m.channel_id = c.id
    GROUP BY c.id
    ORDER BY c.id ASC
  `);

  return result.rows;
}

async function getChannel(channelId) {
  const result = await pool.query(
    `
    SELECT id, name, description, created_at
    FROM channels
    WHERE id = $1
    `,
    [channelId]
  );

  return result.rows[0] || null;
}

async function getMessages(channelId) {
  const result = await pool.query(
    `
    SELECT
      m.id,
      m.content,
      m.created_at,
      m.updated_at,
      u.id AS user_id,
      u.username,
      u.display_name,
      u.avatar_color,
      a.id AS attachment_id,
      a.storage_key,
      a.file_name,
      a.content_type,
      a.file_size
    FROM messages m
    JOIN users_app u ON u.id = m.user_id
    LEFT JOIN attachments a ON a.message_id = m.id
    WHERE m.channel_id = $1
    ORDER BY m.created_at ASC
    `,
    [channelId]
  );

  return result.rows.map((message) => ({
    ...message,
    attachment_url: message.attachment_id
      ? `/attachments/${message.attachment_id}`
      : ""
  }));
}

async function getMembers(channelId) {
  const result = await pool.query(
    `
    SELECT DISTINCT
      u.id,
      u.username,
      u.display_name,
      u.avatar_color,
      MAX(m.created_at) AS last_message_at
    FROM users_app u
    JOIN messages m ON m.user_id = u.id
    WHERE m.channel_id = $1
    GROUP BY u.id
    ORDER BY last_message_at DESC
    LIMIT 24
    `,
    [channelId]
  );

  return result.rows;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const channels = await getChannels();

    if (channels.length === 0) {
      await renderPage(req, res, "chat", {
        pageTitle: "CloudChat",
        bodyClass: "chat-page",
        channels: [],
        selectedChannel: null,
        messages: [],
        members: []
      });
      return;
    }

    res.redirect(`/channels/${channels[0].id}`);
  } catch (error) {
    next(error);
  }
});

router.get("/channels/:channelId", requireAuth, async (req, res, next) => {
  try {
    const channelId = Number(req.params.channelId);
    const channels = await getChannels();
    const selectedChannel = await getChannel(channelId);

    if (!selectedChannel) {
      req.flash("error", "Channel not found.");
      return res.redirect("/");
    }

    const [messages, members] = await Promise.all([
      getMessages(channelId),
      getMembers(channelId)
    ]);

    await renderPage(req, res, "chat", {
      pageTitle: `#${selectedChannel.name} - CloudChat`,
      bodyClass: "chat-page",
      channels,
      selectedChannel,
      messages,
      members
    });
  } catch (error) {
    next(error);
  }
});

router.post("/channels", requireAuth, async (req, res, next) => {
  try {
    const name = slugifyChannelName(req.body.name);
    const description = String(req.body.description || "").trim().slice(0, 180);

    if (!name) {
      req.flash("error", "Channel name is required.");
      return res.redirect(req.get("Referrer") || "/");
    }

    const result = await pool.query(
      `
      INSERT INTO channels (name, description, created_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (name)
      DO UPDATE SET description = EXCLUDED.description
      RETURNING id
      `,
      [name, description, req.currentUser.id]
    );

    res.redirect(`/channels/${result.rows[0].id}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
