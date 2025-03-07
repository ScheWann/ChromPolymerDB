-- clear_tables.sql
SET LOCAL lock_timeout = '5s';
BEGIN;
TRUNCATE position, distance;
COMMIT;