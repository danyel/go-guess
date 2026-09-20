#!/bin/sh
set -eu

shutdown() {
  trap - TERM INT
  kill -TERM "$api_pid" "$nginx_pid" 2>/dev/null || true
  wait "$api_pid" "$nginx_pid" 2>/dev/null || true
  exit 0
}

goose -dir /app/migrations postgres "$DATABASE_URL" up
seed

api &
api_pid=$!
nginx -e /dev/stderr -g 'daemon off;' &
nginx_pid=$!

trap shutdown TERM INT

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

kill -TERM "$api_pid" "$nginx_pid" 2>/dev/null || true
wait "$api_pid" "$nginx_pid" 2>/dev/null || true
exit 1
