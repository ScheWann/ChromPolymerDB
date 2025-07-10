FROM alpine:3.18

RUN apk add --no-cache postgresql-client tzdata

ENV PATH="/usr/sbin:$PATH"

COPY crontab /etc/crontabs/root

RUN touch /root/.pgpass && \
    chmod 600 /root/.pgpass 

CMD ["crond", "-f", "-l", "8"]