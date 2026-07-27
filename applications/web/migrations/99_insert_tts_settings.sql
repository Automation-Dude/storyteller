-- Narration generation (text-to-speech) settings. ttsEngine defaults to null
-- (off) so existing behaviour is unchanged; an admin turns it on in Settings.
INSERT INTO
  settings (name, value)
SELECT
  'ttsEngine',
  null
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      settings
    WHERE
      name = 'ttsEngine'
  );

INSERT INTO
  settings (name, value)
SELECT
  'ttsVoice',
  '"af_heart"'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      settings
    WHERE
      name = 'ttsVoice'
  );

INSERT INTO
  settings (name, value)
SELECT
  'ttsSpeed',
  '1'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      settings
    WHERE
      name = 'ttsSpeed'
  );

INSERT INTO
  settings (name, value)
SELECT
  'ttsFormat',
  '"m4b"'
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      settings
    WHERE
      name = 'ttsFormat'
  );
