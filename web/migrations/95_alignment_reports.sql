CREATE TABLE IF NOT EXISTS alignment_report (
  uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
  job_uuid TEXT REFERENCES job (uuid) ON DELETE SET NULL,
  book_uuid TEXT REFERENCES book (uuid) ON DELETE CASCADE,
  report TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alignment_report_job ON alignment_report (job_uuid);

CREATE INDEX IF NOT EXISTS idx_alignment_report_book ON alignment_report (book_uuid);
