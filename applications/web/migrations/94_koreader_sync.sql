CREATE TABLE koreader_user (
  uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  auth_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_koreader_user_user_id ON koreader_user (user_id);

CREATE TRIGGER IF NOT EXISTS koreader_user_update_trigger AFTER
UPDATE ON koreader_user FOR EACH ROW BEGIN
UPDATE koreader_user
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE koreader_progress (
  uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  koreader_user_uuid TEXT NOT NULL REFERENCES koreader_user (uuid) ON DELETE CASCADE,
  document TEXT NOT NULL,
  progress TEXT NOT NULL,
  percentage REAL NOT NULL,
  device TEXT,
  device_id TEXT,
  timestamp INTEGER NOT NULL,
  book_uuid TEXT REFERENCES book (uuid) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (koreader_user_uuid, document)
);

CREATE INDEX idx_koreader_progress_book ON koreader_progress (book_uuid);

CREATE TRIGGER IF NOT EXISTS koreader_progress_update_trigger AFTER
UPDATE ON koreader_progress FOR EACH ROW BEGIN
UPDATE koreader_progress
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE koreader_document (
  uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  document TEXT NOT NULL UNIQUE,
  book_uuid TEXT NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  ebook_uuid TEXT REFERENCES ebook (uuid) ON DELETE CASCADE,
  readaloud_uuid TEXT REFERENCES readaloud (uuid) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_koreader_document_book ON koreader_document (book_uuid);

CREATE TRIGGER IF NOT EXISTS koreader_document_update_trigger AFTER
UPDATE ON koreader_document FOR EACH ROW BEGIN
UPDATE koreader_document
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

INSERT INTO
  settings (name, value)
VALUES
  ('koreaderSyncEnabled', 'false');

INSERT INTO
  settings (name, value)
VALUES
  ('koreaderSyncAllowRegistration', 'true');
