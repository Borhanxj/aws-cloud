const express = require("express");

const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const {
  createUploadMiddleware,
  removeAttachment,
  saveAttachment
} = require("../services/storageService");

const router = express.Router();
const upload = createUploadMiddleware();

function wantsJson(req) {
  return req.get("X-Requested-With") === "fetch" || req.accepts(["json", "html"]) === "json";
}

router.post(
  "/channels/:channelId/messages",
  requireAuth,
  upload.single("attachment"),
  async (req, res, next) => {
    const client = await pool.connect();
    let storedAttachment = null;

    try {
      const channelId = Number(req.params.channelId);
      const content = String(req.body.content || "").trim();

      if (!content && !req.file) {
        if (wantsJson(req)) {
          return res.status(400).json({
            message: "Write a message or attach a file."
          });
        }

        req.flash("error", "Write a message or attach a file.");
        return res.redirect(`/channels/${channelId}`);
      }

      storedAttachment = await saveAttachment(req.file);

      await client.query("BEGIN");

      const channelResult = await client.query(
        "SELECT id FROM channels WHERE id = $1",
        [channelId]
      );

      if (channelResult.rows.length === 0) {
        throw new Error("Channel not found.");
      }

      const messageResult = await client.query(
        `
        INSERT INTO messages (channel_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING id
        `,
        [channelId, req.currentUser.id, content]
      );

      if (storedAttachment) {
        await client.query(
          `
          INSERT INTO attachments (
            message_id,
            storage_key,
            file_name,
            content_type,
            file_size
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            messageResult.rows[0].id,
            storedAttachment.storageKey,
            storedAttachment.fileName,
            storedAttachment.contentType,
            storedAttachment.fileSize
          ]
        );
      }

      await client.query(
        "UPDATE users_app SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1",
        [req.currentUser.id]
      );

      await client.query("COMMIT");

      if (wantsJson(req)) {
        return res.json({
          ok: true,
          channelId
        });
      }

      res.redirect(`/channels/${channelId}`);
    } catch (error) {
      await client.query("ROLLBACK");

      if (storedAttachment) {
        await removeAttachment(storedAttachment.storageKey);
      }

      next(error);
    } finally {
      client.release();
    }
  }
);

router.post("/messages/:messageId/edit", requireAuth, async (req, res, next) => {
  try {
    const messageId = Number(req.params.messageId);
    const channelId = Number(req.body.channel_id);
    const content = String(req.body.content || "").trim();

    if (!content) {
      req.flash("error", "Edited message cannot be empty.");
      return res.redirect(`/channels/${channelId}`);
    }

    const result = await pool.query(
      `
      UPDATE messages
      SET content = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND user_id = $3
      RETURNING id
      `,
      [content, messageId, req.currentUser.id]
    );

    if (result.rows.length === 0) {
      req.flash("error", "You can only edit your own messages.");
    }

    res.redirect(`/channels/${channelId}`);
  } catch (error) {
    next(error);
  }
});

router.post("/messages/:messageId/delete", requireAuth, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const messageId = Number(req.params.messageId);
    const channelId = Number(req.body.channel_id);

    await client.query("BEGIN");

    const ownershipResult = await client.query(
      `
      SELECT id
      FROM messages
      WHERE id = $1
        AND user_id = $2
      `,
      [messageId, req.currentUser.id]
    );

    if (ownershipResult.rows.length === 0) {
      await client.query("ROLLBACK");
      req.flash("error", "You can only delete your own messages.");
      return res.redirect(`/channels/${channelId}`);
    }

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

    await Promise.all(
      attachmentsResult.rows.map((attachment) =>
        removeAttachment(attachment.storage_key)
      )
    );

    res.redirect(`/channels/${channelId}`);
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
