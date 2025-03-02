-- clear_tables.sql
SELECT pg_try_advisory_lock(12345) AS got_lock;

DO $$ 
DECLARE 
    lock_status BOOLEAN;
BEGIN
    SELECT pg_try_advisory_lock(12345) INTO lock_status;
    IF lock_status THEN
        TRUNCATE TABLE position;
        TRUNCATE TABLE distance;

        PERFORM pg_advisory_unlock(12345);
    ELSE
        RAISE NOTICE 'Skipping delete, table is busy';
    END IF;
END $$;