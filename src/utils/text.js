const AVATAR_COLORS = [
  "#5865f2",
  "#2fb67c",
  "#e45757",
  "#e0a82e",
  "#8b5cf6",
  "#0891b2",
  "#db2777",
  "#4f46e5"
];

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function cleanDisplayName(value, fallback) {
  const displayName = String(value || "").trim().replace(/\s+/g, " ");
  return displayName || fallback;
}

function slugifyChannelName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function pickAvatarColor(seed) {
  const text = String(seed || "cloudchat");
  let hash = 0;

  for (const char of text) {
    hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  }

  return AVATAR_COLORS[hash];
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "CC";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

module.exports = {
  cleanDisplayName,
  formatDateTime,
  formatFileSize,
  getInitials,
  normalizeUsername,
  pickAvatarColor,
  slugifyChannelName
};
