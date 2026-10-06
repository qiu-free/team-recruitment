CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekly_hours INTEGER NOT NULL DEFAULT 0 CHECK (weekly_hours BETWEEN 0 AND 168),
  session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  progress TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  recruitment_paused BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_roles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  UNIQUE(project_id, id)
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  applicant_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  contribution TEXT NOT NULL,
  profile_snapshot JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (project_id, role_id) REFERENCES project_roles(project_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS applications_one_pending_per_user_project
  ON applications(project_id, applicant_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT,
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id),
  FOREIGN KEY (project_id, role_id) REFERENCES project_roles(project_id, id)
);

CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects(owner_id);
CREATE INDEX IF NOT EXISTS applications_project_idx ON applications(project_id);
CREATE INDEX IF NOT EXISTS applications_applicant_idx ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS members_project_idx ON project_members(project_id);
