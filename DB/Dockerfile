FROM postgres:17.0-bookworm

RUN apt-get update && apt-get install -y postgresql-17-cron

# Set shared_preload_libraries and configure pg_cron to use your database (chromosome_db)
RUN echo "shared_preload_libraries = 'pg_cron'" >> /usr/share/postgresql/postgresql.conf.sample && \
    echo "cron.database_name = 'chromosome_db'" >> /usr/share/postgresql/postgresql.conf.sample

COPY init-cron.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-cron.sh