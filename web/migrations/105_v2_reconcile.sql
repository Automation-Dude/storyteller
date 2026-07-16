-- 105_v2_reconcile: bring pre-merge v3 databases in line with the v2 (main)
-- schema before the cascade rebuild in 106. logic lives in
-- src/database/migrations/105_v2_reconcile.sql.ts:
--   * add import_rule.epub2_import_strategy when missing (v2 added it in
--     80_import_rule_epub2_strategy, which v3 databases hash-skip)
--   * replace the abandoned v3 identifier experiment (identifier as a type
--     registry + book_to_identifier) with the v2 model from 89_identifiers
--     (identifier_type + per-book identifier). both v3 tables shipped empty.
SELECT
  105;
