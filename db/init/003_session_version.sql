ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_session_version_check;

ALTER TABLE users
  ADD CONSTRAINT users_session_version_check CHECK (session_version >= 0);
