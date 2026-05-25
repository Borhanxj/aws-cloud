const fs = require("fs");
const path = require("path");
const multer = require("multer");
const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} = require("@aws-sdk/client-s3");

const uploadDir = path.join(__dirname, "..", "..", "uploads");
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 20);
const maxFileSize = maxUploadMb * 1024 * 1024;
const useS3 = process.env.APP_MODE === "aws" && Boolean(process.env.S3_BUCKET_NAME);
const s3Client = useS3
  ? new S3Client({
      region: process.env.AWS_REGION || "eu-west-1"
    })
  : null;

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
  if (useS3) {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: maxFileSize
      }
    });
  }

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

function createStorageKey(fileName) {
  const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `attachments/${uniquePrefix}-${toSafeFileName(fileName)}`;
}

async function saveAttachment(file) {
  if (!file) {
    return null;
  }

  if (useS3) {
    const storageKey = createStorageKey(file.originalname);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    );

    return {
      storageKey,
      fileName: file.originalname,
      contentType: file.mimetype,
      fileSize: file.size
    };
  }

  return {
    storageKey: file.filename,
    fileName: file.originalname,
    contentType: file.mimetype,
    fileSize: file.size
  };
}

async function openAttachment(storageKey) {
  if (!storageKey) {
    return null;
  }

  if (useS3) {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: storageKey
      })
    );

    return {
      stream: result.Body,
      contentType: result.ContentType,
      contentLength: result.ContentLength
    };
  }

  const filePath = resolveLocalPath(storageKey);

  return {
    stream: fs.createReadStream(filePath),
    contentLength: (await fs.promises.stat(filePath)).size
  };
}

function resolveLocalPath(storageKey) {
  const filePath = path.join(uploadDir, storageKey);
  const resolvedUploadDir = path.resolve(uploadDir);
  const resolvedFilePath = path.resolve(filePath);

  if (!resolvedFilePath.startsWith(resolvedUploadDir)) {
    throw new Error("Invalid attachment path.");
  }

  return resolvedFilePath;
}

async function removeAttachment(storageKey) {
  if (!storageKey) {
    return;
  }

  if (useS3) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: storageKey
      })
    );
    return;
  }

  await fs.promises.rm(resolveLocalPath(storageKey), { force: true });
}

module.exports = {
  createUploadMiddleware,
  openAttachment,
  removeAttachment,
  saveAttachment,
  maxUploadMb
};
