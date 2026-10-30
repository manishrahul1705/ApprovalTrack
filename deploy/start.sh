#!/bin/bash
set -Eeuo pipefail
umask 077
# This image intentionally supports one service and one persistent disk only.
test "${NODE_ENV}" = production
test "${QUEUE_MODE}" = inline
test -z "${AI_SERVICE_URL}"
test "${CLAMAV_HOST}" = 127.0.0.1
test "${CLAMAV_PORT}" = 3310
test "${UPLOAD_DIR}" = /var/data/uploads
mkdir -p /var/data/uploads /var/data/clamav
chown appuser:appuser /var/data/uploads
chown clamav:clamav /var/data/clamav
chmod 700 /var/data/uploads /var/data/clamav
pids=()
cleanup() {
  trap - TERM INT EXIT
  # Node drains HTTP, scheduler and inference before stopping scanner processes.
  if [[ -n "${api_pid:-}" ]]; then
    kill -TERM "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  for pid in "${pids[@]}"; do kill -TERM "$pid" 2>/dev/null || true; done
  wait || true
}
trap cleanup TERM INT EXIT
gosu appuser python /app/deploy/preflight.py
# Signature refresh is required; no empty-database or scanner-disabled fallback.
freshclam --config-file=/app/deploy/freshclam.conf
clamd --config-file=/app/deploy/clamd.conf &
pids+=("$!")
freshclam --daemon --config-file=/app/deploy/freshclam.conf &
pids+=("$!")
gosu appuser python - <<'PY'
import socket, time
for _ in range(180):
    try:
        with socket.create_connection(('127.0.0.1', 3310), timeout=1) as s:
            s.sendall(b'zPING\0')
            if s.recv(64).strip(b'\0\r\n') == b'PONG':
                break
    except OSError:
        pass
    time.sleep(1)
else:
    raise SystemExit('ClamAV did not become ready')
PY
if [[ "${STORAGE_MAINTENANCE:-false}" == true ]]; then
  gosu appuser node /app/deploy/maintenance.mjs &
else
  gosu appuser node src/server.js &
fi
api_pid=$!
# If any critical child exits, terminate the service so Render can restart it.
set +e
wait -n "$api_pid" "${pids[@]}"
exit 1
