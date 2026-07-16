-- "No shelf" and "the shelf is gone" must not mean the same thing.
--
-- A device's shelf was recorded only as a collection reference, with NULL read
-- as "the whole library". That makes the difference between a curated reader
-- and one who can see everything depend on a column staying non-NULL, and the
-- reference is declared ON DELETE SET NULL: the only reason deleting a shelf
-- does not hand that device the entire library today is that foreign keys are
-- not enabled on this database. That is not a decision, it is an accident.
--
-- So record what was actually chosen. With whole_library off and no shelf, a
-- device is sent nothing, which is the safe end to fail towards.
--
-- Defaults to 1 so devices set up before this keep the behaviour they were
-- given: they were all whole-library or had a live shelf.
ALTER TABLE kobo_device
ADD COLUMN whole_library INTEGER NOT NULL DEFAULT 1;

-- Existing devices with a shelf chose that shelf, not everything.
UPDATE kobo_device
SET
  whole_library = 0
WHERE
  collection_uuid IS NOT NULL;
