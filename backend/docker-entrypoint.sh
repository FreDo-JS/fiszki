#!/bin/sh
set -e

PRISMA_CLI="/app/node_modules/prisma/build/index.js"

# Compose czeka na healthcheck Postgresa, ale przy restarcie bazy kontener API
# może wystartować ułamek sekundy za wcześnie — stąd krótkie ponawianie.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying database migrations..."
  attempt=1
  until node "$PRISMA_CLI" migrate deploy; do
    if [ "$attempt" -ge "${MIGRATE_RETRIES:-10}" ]; then
      echo "[entrypoint] migrations failed after $attempt attempts" >&2
      exit 1
    fi
    echo "[entrypoint] database not ready yet, retry $attempt..."
    attempt=$((attempt + 1))
    sleep 3
  done
  echo "[entrypoint] migrations applied"
fi

exec "$@"
