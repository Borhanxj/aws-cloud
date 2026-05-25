const express = require("express");

const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { openAttachment } = require("../services/storageService");

const router = express.Router();

function cleanFileName(value) {
  return String(value || "attachment").replace(/["\r\n]/g, "");
}

router.get("/attachments/:attachmentId", requireAuth, async (req, res, next) => {
  try {
    const attachmentId = Number(req.params.attachmentId);
    const result = await pool.query(
      `
      SELECT id, storage_key, file_name, content_type, file_size
      FROM attachments
      WHERE id = $1
      `,
      [attachmentId]
    );

    const attachment = result.rows[0];

    if (!attachment) {
      return res.status(404).send("Attachment not found.");
    }

    const object = await openAttachment(attachment.storage_key);

    if (!object) {
      return res.status(404).send("Attachment not found.");
    }

    res.setHeader(
      "Content-Type",
      attachment.content_type || object.contentType || "application/octet-stream"
    );

    if (attachment.file_size || object.contentLength) {
      res.setHeader("Content-Length", attachment.file_size || object.contentLength);
    }

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${cleanFileName(attachment.file_name)}"`
    );

    object.stream.on("error", next);
    object.stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
