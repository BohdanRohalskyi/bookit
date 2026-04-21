-- 000016_integer_primary_keys.down.sql
-- This migration is irreversible. Restore from backup to revert.
-- The structural change from UUID to BIGSERIAL primary keys cannot be
-- automatically undone without data loss risk.
SELECT 'irreversible migration -- restore from backup' AS note;
