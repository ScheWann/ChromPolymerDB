FROM postgres:17.0-bookworm

RUN apt-get update && apt-get install -y postgresql-17-cron

RUN echo "shared_preload_libraries = 'pg_cron'" >> /usr/share/postgresql/postgresql.conf.sample

COPY init-cron.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-cron.sh
