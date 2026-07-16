-- Setting a device up twice should not leave two of them.
--
-- Every run of setup minted a fresh row and a fresh token, so a retry, or a
-- failed write, left an orphan behind: a live key to someone's library that
-- nobody knows about and nobody will revoke. A Kobo reports its serial, which
-- is what actually identifies the thing in your hand, so key a device by that
-- and rotate its token instead of accumulating rows.
--
-- Nullable, because a device set up before this has no serial recorded and we
-- are not going to invent one. Those rows keep working and simply do not
-- collapse together.
ALTER TABLE kobo_device
ADD COLUMN serial TEXT;

-- Partial: several legacy rows may have a NULL serial, and NULLs must not
-- collide with each other.
CREATE UNIQUE INDEX idx_kobo_device_user_serial ON kobo_device (user_id, serial)
WHERE
  serial IS NOT NULL;
