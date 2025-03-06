-- clear_tables.sql
BEGIN;
LOCK TABLE position, distance IN SHARE MODE NOWAIT;
TRUNCATE position, distance;
COMMIT;