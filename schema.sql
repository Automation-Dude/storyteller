CREATE TABLE "migration" (
  id integer PRIMARY KEY NOT NULL,
  name text NOT NULL,
  hash TEXT NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER migration_update_trigger AFTER
UPDATE ON migration FOR EACH ROW BEGIN
UPDATE migration
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  id = OLD.id;

END;

CREATE TABLE "book" (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  title text NOT NULL,
  /* Maintain the old integer ids to avoid breaking changes */
  id integer,
  language TEXT DEFAULT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publication_date text,
  aligned_by_storyteller_version text,
  aligned_at text,
  aligned_with text,
  description text,
  rating real,
  subtitle text,
  "duration" real,
  "page_count" integer,
  asset_dir text NOT NULL DEFAULT ''
);

CREATE TRIGGER book_update_trigger AFTER
UPDATE ON book FOR EACH ROW BEGIN
UPDATE book
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE "user_permission" (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  id integer,
  book_create boolean NOT NULL DEFAULT 0,
  book_read boolean NOT NULL DEFAULT 0,
  book_process boolean NOT NULL DEFAULT 0,
  book_download boolean NOT NULL DEFAULT 0,
  book_list boolean NOT NULL DEFAULT 0,
  user_create boolean NOT NULL DEFAULT 0,
  user_list boolean NOT NULL DEFAULT 0,
  user_read boolean NOT NULL DEFAULT 0,
  user_delete boolean NOT NULL DEFAULT 0,
  settings_update boolean NOT NULL DEFAULT 0,
  book_delete boolean NOT NULL DEFAULT 0,
  book_update boolean NOT NULL DEFAULT 0,
  invite_list boolean NOT NULL DEFAULT 0,
  invite_delete boolean NOT NULL DEFAULT 0,
  user_update boolean NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  collection_create boolean NOT NULL DEFAULT 0
);

CREATE TRIGGER user_permission_update_trigger AFTER
UPDATE ON user_permission FOR EACH ROW BEGIN
UPDATE user_permission
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE "settings" (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  id integer,
  name text NOT NULL,
  value text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER settings_update_trigger AFTER
UPDATE ON settings FOR EACH ROW BEGIN
UPDATE settings
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE "token_revokation" (
  token text PRIMARY KEY NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER token_revokation_update_trigger AFTER
UPDATE ON token_revokation FOR EACH ROW BEGIN
UPDATE token_revokation
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  token = OLD.token;

END;

CREATE TABLE status (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER status_update_trigger AFTER
UPDATE ON status FOR EACH ROW BEGIN
UPDATE status
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE "user" (
  id text PRIMARY KEY DEFAULT (uuid ()),
  user_permission_uuid text NOT NULL,
  username text,
  email text NOT NULL UNIQUE,
  invite_key text UNIQUE,
  invite_accepted text,
  name text,
  hashed_password text,
  email_verified text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_permission_uuid) REFERENCES user_permission (uuid) ON DELETE CASCADE
);

CREATE TRIGGER user_update_trigger AFTER
UPDATE ON USER FOR EACH ROW BEGIN
UPDATE USER
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  id = OLD.id;

END;

CREATE TABLE position(
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id text NOT NULL,
  book_uuid text NOT NULL,
  locator text NOT NULL,
  timestamp real NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_uuid) REFERENCES book (uuid),
  FOREIGN KEY (user_id) REFERENCES USER (id),
  UNIQUE (user_id, book_uuid)
);

CREATE TRIGGER position_update_trigger AFTER
UPDATE ON position FOR EACH ROW BEGIN
UPDATE position
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE book_to_status (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  book_uuid text NOT NULL,
  status_uuid text NOT NULL,
  user_id text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_uuid) REFERENCES book (uuid),
  FOREIGN KEY (status_uuid) REFERENCES status (uuid),
  FOREIGN KEY (user_id) REFERENCES USER (id)
);

CREATE TRIGGER book_to_status_update_trigger AFTER
UPDATE ON book_to_status FOR EACH ROW BEGIN
UPDATE book_to_status
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE account (
  id text PRIMARY KEY DEFAULT (uuid ()),
  user_id text NOT NULL,
  type TEXT NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES USER (id)
);

CREATE TRIGGER account_update_trigger AFTER
UPDATE ON account FOR EACH ROW BEGIN
UPDATE account
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  id = OLD.id;

END;

CREATE TABLE session (
  id text PRIMARY KEY DEFAULT (uuid ()),
  user_id text NOT NULL,
  session_token text NOT NULL UNIQUE,
  expires text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES USER (id)
);

CREATE TRIGGER session_update_trigger AFTER
UPDATE ON session FOR EACH ROW BEGIN
UPDATE session
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  id = OLD.id;

END;

CREATE TABLE verification_token (
  identifier text NOT NULL,
  token text NOT NULL UNIQUE,
  expires text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER verification_token_update_trigger AFTER
UPDATE ON verification_token FOR EACH ROW BEGIN
UPDATE verification_token
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  token = OLD.token;

END;

CREATE TABLE "readaloud" (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  book_uuid text NOT NULL REFERENCES book (uuid),
  filepath text,
  status text NOT NULL DEFAULT 'CREATED',
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  missing integer NOT NULL DEFAULT 0,
  current_stage text,
  stage_progress integer NOT NULL DEFAULT 0,
  queue_position integer,
  restart_pending integer,
  "manifest" jsonb,
  "page_count" integer,
  is_epub2 boolean NOT NULL DEFAULT FALSE,
  "duration" real,
  "file_size" integer,
  "fingerprint" text,
  "cover_colors" text,
  "cover_blurhash" text
);

CREATE TRIGGER aligned_book_update_trigger AFTER
UPDATE ON "readaloud" FOR EACH ROW BEGIN
UPDATE "readaloud"
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE ebook (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  book_uuid text NOT NULL REFERENCES book (uuid),
  filepath text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  missing integer NOT NULL DEFAULT 0,
  "manifest" jsonb,
  "page_count" integer,
  is_epub2 boolean NOT NULL DEFAULT FALSE,
  "file_size" integer,
  "fingerprint" text,
  "cover_colors" text,
  "cover_blurhash" text
);

CREATE TRIGGER ebook_update_trigger AFTER
UPDATE ON ebook FOR EACH ROW BEGIN
UPDATE ebook
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE audiobook (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  book_uuid text NOT NULL REFERENCES book (uuid),
  filepath text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  missing integer NOT NULL DEFAULT 0,
  "manifest" jsonb,
  "duration" real,
  "file_size" integer,
  "fingerprint" text,
  "cover_colors" text,
  "cover_blurhash" text
);

CREATE TRIGGER audiobook_update_trigger AFTER
UPDATE ON audiobook FOR EACH ROW BEGIN
UPDATE audiobook
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE creator (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  id integer,
  name text NOT NULL UNIQUE,
  file_as text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER creator_update_trigger AFTER
UPDATE ON "creator" FOR EACH ROW BEGIN
UPDATE "creator"
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE tag (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  name text NOT NULL UNIQUE,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER tag_update_trigger AFTER
UPDATE ON "tag" FOR EACH ROW BEGIN
UPDATE "tag"
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE series (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  name text NOT NULL UNIQUE,
  description text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER series_update_trigger AFTER
UPDATE ON "series" FOR EACH ROW BEGIN
UPDATE "series"
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE book_to_collection (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  collection_uuid text NOT NULL,
  book_uuid text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_uuid) REFERENCES book (uuid),
  FOREIGN KEY (collection_uuid) REFERENCES collection (uuid)
);

CREATE TABLE book_to_creator (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  book_uuid text NOT NULL,
  creator_uuid text NOT NULL,
  role TEXT,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_uuid) REFERENCES book (uuid),
  FOREIGN KEY (creator_uuid) REFERENCES "creator" (uuid)
);

CREATE TABLE book_to_series (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  series_uuid text NOT NULL,
  book_uuid text NOT NULL,
  position real,
  featured boolean NOT NULL DEFAULT 1,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (series_uuid) REFERENCES "series" (uuid),
  FOREIGN KEY (book_uuid) REFERENCES book (uuid)
);

CREATE TABLE book_to_tag (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  tag_uuid text NOT NULL,
  book_uuid text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_uuid) REFERENCES book (uuid),
  FOREIGN KEY (tag_uuid) REFERENCES "tag" (uuid)
);

CREATE TABLE collection_to_user (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id text NOT NULL,
  collection_uuid text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_uuid) REFERENCES "collection" (uuid),
  FOREIGN KEY (user_id) REFERENCES USER (id)
);

CREATE INDEX idx_book_to_creator_book_role ON book_to_creator (book_uuid, ROLE);

CREATE INDEX idx_book_to_series_book ON book_to_series (book_uuid);

CREATE INDEX idx_book_to_tag_book ON book_to_tag (book_uuid);

CREATE INDEX idx_book_to_status_book_user ON book_to_status (book_uuid, user_id);

CREATE INDEX idx_ebook_book ON ebook (book_uuid);

CREATE INDEX idx_audiobook_book ON audiobook (book_uuid);

CREATE INDEX idx_readaloud_book ON readaloud (book_uuid);

CREATE TABLE device_authorization (
  id text PRIMARY KEY DEFAULT (uuid ()),
  device_code text NOT NULL UNIQUE,
  user_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  approved_by_user_id text,
  interval_seconds integer NOT NULL DEFAULT 5,
  expires_at text NOT NULL,
  last_polled_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (approved_by_user_id) REFERENCES USER (id)
);

CREATE INDEX device_authorization_expires_at_idx ON device_authorization (expires_at);

CREATE TRIGGER device_authorization_update_trigger AFTER
UPDATE ON device_authorization FOR EACH ROW BEGIN
UPDATE device_authorization
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  id = OLD.id;

END;

CREATE TABLE changelog (
  uuid text PRIMARY KEY DEFAULT (uuid ()),
  tag_name text NOT NULL UNIQUE,
  version text NOT NULL,
  component text NOT NULL,
  description text,
  released_at text NOT NULL,
  created_at text NOT NULL DEFAULT (datetime ('now')),
  updated_at text NOT NULL DEFAULT (datetime ('now'))
);

CREATE INDEX idx_changelog_component_released_at ON changelog (component, released_at DESC);

CREATE UNIQUE INDEX idx_settings_name ON settings (name);

CREATE TABLE import_rule (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  kind text NOT NULL CHECK (kind IN ('watch', 'ignore')),
  path text NOT NULL,
  import_mode text DEFAULT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source text NOT NULL DEFAULT 'user' CHECK (
    source IN (
      'user',
      'import-relocate',
      'import-backup',
      'prevent-reimport'
    )
  ),
  book_uuid text DEFAULT NULL REFERENCES book (uuid) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_import_rule_path ON import_rule (path);

CREATE TRIGGER import_rule_update_trigger AFTER
UPDATE ON "import_rule" FOR EACH ROW BEGIN
UPDATE "import_rule"
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE import_rule_to_collection (
  import_rule_uuid text NOT NULL REFERENCES import_rule (uuid) ON DELETE CASCADE,
  collection_uuid text NOT NULL REFERENCES collection (uuid) ON DELETE CASCADE,
  PRIMARY KEY (import_rule_uuid, collection_uuid)
);

CREATE TABLE "collection" (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  name text NOT NULL UNIQUE,
  public boolean NOT NULL DEFAULT 0,
  description text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER collection_update_trigger AFTER
UPDATE ON "collection" FOR EACH ROW BEGIN
UPDATE "collection"
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE INDEX idx_import_rule_book_uuid ON import_rule (book_uuid);

CREATE UNIQUE INDEX idx_book_asset_dir ON book (asset_dir);

CREATE TABLE user_book_rating (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id text NOT NULL,
  book_uuid text NOT NULL,
  rating real,
  review text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES USER (id),
  FOREIGN KEY (book_uuid) REFERENCES book (uuid),
  UNIQUE (user_id, book_uuid),
  CHECK (
    rating IS NOT NULL
    OR review IS NOT NULL
  )
);

CREATE TRIGGER user_book_rating_update_trigger AFTER
UPDATE ON user_book_rating FOR EACH ROW BEGIN
UPDATE user_book_rating
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE shelf (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id text NOT NULL REFERENCES USER (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filter TEXT,
  order_by text NOT NULL DEFAULT 'createdAt',
  order_direction text NOT NULL DEFAULT 'desc',
  limit_count integer,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER shelf_update_trigger AFTER
UPDATE ON shelf FOR EACH ROW BEGIN
UPDATE shelf
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE TABLE shelf_book (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  shelf_uuid text NOT NULL REFERENCES shelf (uuid) ON DELETE CASCADE,
  book_uuid text NOT NULL REFERENCES book (uuid) ON DELETE CASCADE,
  position integer,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER shelf_book_update_trigger AFTER
UPDATE ON shelf_book FOR EACH ROW BEGIN
UPDATE shelf_book
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE INDEX idx_shelf_book_shelf ON shelf_book (shelf_uuid);

CREATE INDEX idx_shelf_book_book ON shelf_book (book_uuid);

CREATE TABLE shelf_filter_reference (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  shelf_uuid text NOT NULL REFERENCES shelf (uuid) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_uuid text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER shelf_filter_reference_update_trigger AFTER
UPDATE ON shelf_filter_reference FOR EACH ROW BEGIN
UPDATE shelf_filter_reference
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE INDEX idx_shelf_filter_ref_shelf ON shelf_filter_reference (shelf_uuid);

CREATE TABLE home_shelf (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id text NOT NULL REFERENCES USER (id) ON DELETE CASCADE,
  shelf_uuid text REFERENCES shelf (uuid) ON DELETE CASCADE,
  shelf_type text NOT NULL,
  position integer NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER home_shelf_update_trigger AFTER
UPDATE ON home_shelf FOR EACH ROW BEGIN
UPDATE home_shelf
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;

CREATE INDEX idx_home_shelf_user ON home_shelf (user_id);

CREATE INDEX idx_book_to_collection_book ON book_to_collection (book_uuid);

CREATE INDEX idx_book_to_creator_creator ON book_to_creator (creator_uuid);

CREATE INDEX idx_collection_to_user_collection ON collection_to_user (collection_uuid);

CREATE TABLE user_settings (
  uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  user_id text NOT NULL,
  name text NOT NULL,
  value text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES USER (id),
  UNIQUE (user_id, name)
);

CREATE TRIGGER user_settings_update_trigger AFTER
UPDATE ON user_settings FOR EACH ROW BEGIN
UPDATE user_settings
SET
  updated_at = CURRENT_TIMESTAMP
WHERE
  uuid = OLD.uuid;

END;
