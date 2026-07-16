-- A Kobo reads its library from a store rather than from files copied onto it,
-- so a device is pointed at Storyteller by rewriting a single line of its
-- config: api_endpoint=<server>/kobo/<token>. Each device therefore needs its
-- own token, and that token is the whole credential: anything holding it can
-- read the library it is scoped to.
--
-- The token is stored as a sha256 digest rather than an argon2 hash, unlike a
-- password: every sync request carries it in the URL and must be looked up
-- directly, which a salted hash cannot do. It is high-entropy and server
-- generated, so it is not guessable and needs no work factor.
CREATE TABLE kobo_device (
  uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  -- sha256 of the URL token. Shown once, when the device is set up.
  token_hash TEXT NOT NULL UNIQUE,
  -- A human label so a lost device can be revoked on its own, e.g. "Kobo Clara".
  label TEXT NOT NULL,
  -- The shelf this device sees. NULL means the whole library; setting it is how
  -- one reader gets a curated subset instead of everything.
  collection_uuid TEXT REFERENCES collection (uuid) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TEXT,
  revoked_at TEXT
);

CREATE INDEX idx_kobo_device_user_id ON kobo_device (user_id);

CREATE TRIGGER IF NOT EXISTS kobo_device_update_trigger AFTER
UPDATE ON kobo_device FOR EACH ROW BEGIN
UPDATE kobo_device
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

-- Which books a device has already been told about. The Kobo sync protocol is
-- incremental: it asks what changed since its last sync, so without this every
-- sync would re-send the whole shelf and the device would never settle.
CREATE TABLE kobo_synced_book (
  uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  kobo_device_uuid TEXT NOT NULL REFERENCES kobo_device (uuid) ON DELETE CASCADE,
  book_uuid TEXT NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (kobo_device_uuid, book_uuid)
);

CREATE INDEX idx_kobo_synced_book_device ON kobo_synced_book (kobo_device_uuid);
