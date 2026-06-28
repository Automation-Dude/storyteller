-- denormalized alignment quality columns on book (backfill in .sql.ts)
ALTER TABLE book
ADD COLUMN alignment_grade TEXT;

ALTER TABLE book
ADD COLUMN alignment_score REAL;

ALTER TABLE book
ADD COLUMN alignment_chapters INTEGER;

ALTER TABLE book
ADD COLUMN alignment_missing_sentences INTEGER;

ALTER TABLE book
ADD COLUMN alignment_muted_chapters INTEGER;

ALTER TABLE book
ADD COLUMN alignment_failed_chapters INTEGER;

ALTER TABLE book
ADD COLUMN alignment_unaligned_audio INTEGER;

ALTER TABLE book
ADD COLUMN alignment_report_uuid TEXT;
