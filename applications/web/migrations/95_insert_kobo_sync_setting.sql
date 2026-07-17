-- Kobo sync is off until an administrator turns it on, like the other sync and
-- feed features. Stored as a settings row so it can be toggled without a schema
-- change; the value is JSON, matching every other setting.
INSERT INTO
  settings (name, value)
VALUES
  ('koboSyncEnabled', 'false');
