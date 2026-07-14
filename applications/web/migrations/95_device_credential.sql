-- A per-device credential lets an e-reader (or any OPDS client) pull a user's
-- library without holding the user's real Storyteller password. Each device
-- gets its own secret, so a lost or sold device can be revoked on its own
-- without disturbing the user's account or their other devices.
CREATE TABLE device_credential (
  uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  -- A human label so the user knows which device this is when revoking, e.g.
  -- "Kobo Clara BW".
  label TEXT NOT NULL,
  -- argon2 hash of the device secret. The secret itself is shown once, when
  -- the credential is created, and never stored.
  secret_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE INDEX idx_device_credential_user_id ON device_credential (user_id);

CREATE TRIGGER IF NOT EXISTS device_credential_update_trigger AFTER
UPDATE ON device_credential FOR EACH ROW BEGIN
UPDATE device_credential
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;
