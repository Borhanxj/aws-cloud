const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "..", "..", "uploads");
const maxFileSize = Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024;

function ensureUploadDirectory() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

function toSafeFileName(value) {
  return String(value || "attachment")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function createUploadMiddleware() {
  ensureUploadDirectory();

  return multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename(req, file, callback) {
        const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        callback(null, `${uniquePrefix}-${toSafeFileName(file.originalname)}`);
      }
    }),
    limits: {
      fileSize: maxFileSize
    }
  });
}

async function saveAttachment(file) {
  if (!file) {
    return null;
  }

  return {
    storageKey: file.filename,
    fileName: file.originalname,
    contentType: file.mimetype,
    fileSize: file.size
  };
}

function getPublicUrl(storageKey) {
  if (!storageKey) {
    return "";
  }

  return `/uploads/${encodeURIComponent(storageKey)}`;
}

async function removeAttachment(storageKey) {
  if (!storageKey) {
    return;
  }

  const filePath = path.join(uploadDir, storageKey);
  const resolvedUploadDir = path.resolve(uploadDir);
  const resolvedFilePath = path.resolve(filePath);

  if (!resolvedFilePath.startsWith(resolvedUploadDir)) {
    return;
  }

  await fs.promises.rm(resolvedFilePath, { force: true });
}

module.exports = {
  createUploadMiddleware,
  getPublicUrl,
  removeAttachment,
  saveAttachment
};
