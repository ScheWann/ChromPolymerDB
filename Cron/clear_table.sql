-- clear_tables.sql
SELECT cron.schedule('daily_clear', '0 3 * * *', $$
    BEGIN;
        TRUNCATE position, distance;
    COMMIT;
    END;
$$);