# cron/Dockerfile
FROM alpine:3.18

RUN apk add --no-cache postgresql-client tzdata

ENV PATH="/usr/sbin:$PATH"

RUN mkdir -p /scripts
COPY crontab /etc/crontabs/root
COPY clear_table.sql /scripts/clear_table.sql

RUN touch /root/.pgpass && \
    chmod 600 /root/.pgpass 

CMD ["crond", "-f", "-l", "8"]