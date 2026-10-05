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

mkdir -p /tmp/nginx

# The theme service location is environment, not build time, so one image serves
# every environment. The file is regenerated on every start and is read by the
# page before the bundle runs.
cat > /app/frontend/runtime-config.js <<CONFIG
window.__GO_GUESS_CONFIG__ = { themeBaseUrl: "${THEME_BASE_URL:-}" }
CONFIG

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
