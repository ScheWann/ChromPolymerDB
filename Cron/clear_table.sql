-- clear_tables.sql
SELECT cron.schedule('daily_clear', '0 3 * * *', $$
BEGIN
    DELETE FROM position
    WHERE NOT (
        cell_line IN ('IMR', 'GM') AND
        chrid = 'chr8' AND
        start_value = 127300000 AND
        end_value = 128300000
    );

    DELETE FROM distance
    WHERE NOT (
        cell_line IN ('IMR', 'GM') AND
        chrid = 'chr8' AND
        start_value = 127300000 AND
        end_value = 128300000
    );
END;
$$);