const bcrypt = require("bcryptjs");
const pool = require("./pool");
const {
  cleanDisplayName,
  normalizeUsername,
  pickAvatarColor
} = require("../utils/text");

async function bootstrapAdminAccount() {
  const username = normalizeUsername(process.env.ADMIN_USERNAME);
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!username || !password) {
    return;
  }

  if (password.length < 10) {
    console.warn("ADMIN_PASSWORD is too short. Admin account was not bootstrapped.");
    return;
  }

  const displayName = cleanDisplayName(
    process.env.ADMIN_DISPLAY_NAME || "Cloud Admin",
    username
  );
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase() || null;
  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    `
    INSERT INTO users_app (
      username,
      display_name,
      email,
      password_hash,
      avatar_color,
      role,
      is_banned,
      banned_at,
      banned_by,
      banned_reason
    )
    VALUES ($1, $2, $3, $4, $5, 'admin', false, NULL, NULL, NULL)
    ON CONFLICT (username)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      avatar_color = EXCLUDED.avatar_color,
      role = 'admin',
      is_banned = false,
      banned_at = NULL,
      banned_by = NULL,
      banned_reason = NULL
    `,
    [username, displayName, email, passwordHash, pickAvatarColor(username)]
  );
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users_app (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      display_name VARCHAR(100),
      email VARCHAR(150) UNIQUE,
      password_hash TEXT,
      avatar_color VARCHAR(20) DEFAULT '#5865f2',
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      is_banned BOOLEAN NOT NULL DEFAULT false,
      banned_at TIMESTAMP,
      banned_by INTEGER REFERENCES users_app(id) ON DELETE SET NULL,
      banned_reason TEXT,
      last_seen_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_by INTEGER REFERENCES users_app(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users_app(id) ON DELETE CASCADE,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      storage_key TEXT,
      file_name TEXT NOT NULL,
      content_type TEXT,
      file_size INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR NOT NULL PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire);
  `);

  await pool.query(`
    ALTER TABLE users_app
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS email VARCHAR(150),
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(20) DEFAULT '#5865f2',
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS banned_by INTEGER REFERENCES users_app(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS banned_reason TEXT,
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;

    ALTER TABLE channels
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users_app(id) ON DELETE SET NULL;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

    ALTER TABLE attachments
      ADD COLUMN IF NOT EXISTS storage_key TEXT,
      ADD COLUMN IF NOT EXISTS file_size INTEGER;
  `);

  await pool.query(`
    UPDATE users_app
    SET role = 'member'
    WHERE role IS NULL;

    UPDATE users_app
    SET is_banned = false
    WHERE is_banned IS NULL;

    ALTER TABLE users_app
      ALTER COLUMN role SET DEFAULT 'member',
      ALTER COLUMN role SET NOT NULL,
      ALTER COLUMN is_banned SET DEFAULT false,
      ALTER COLUMN is_banned SET NOT NULL;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_app_email_unique_idx
    ON users_app (LOWER(email))
    WHERE email IS NOT NULL AND email <> '';
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'attachments'
          AND column_name = 's3_key'
      ) THEN
        ALTER TABLE attachments
        ALTER COLUMN s3_key DROP NOT NULL;

        UPDATE attachments
        SET storage_key = s3_key
        WHERE storage_key IS NULL
          AND s3_key IS NOT NULL;
      END IF;
    END $$;
  `);

  await pool.query(`
    INSERT INTO channels (name, description)
    VALUES
      ('general', 'General discussion'),
      ('course-project', 'Cloud project updates'),
      ('aws-infrastructure', 'EC2, RDS, ALB, S3, and CloudWatch discussion'),
      ('random', 'Off-topic messages')
    ON CONFLICT (name) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO users_app (username, display_name, email, password_hash, avatar_color)
    VALUES
      ('demo_user', 'Demo User', 'demo@example.com', NULL, '#5865f2')
    ON CONFLICT (username) DO NOTHING;
  `);

  await bootstrapAdminAccount();
}

module.exports = {
  initializeDatabase
};
