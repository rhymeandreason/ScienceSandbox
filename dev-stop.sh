#!/usr/bin/env bash
# Stop the demos dev server running on its port (see dev-open.sh).
set -euo pipefail

PORT=8817

notify() {
  osascript -e "display notification \"$1\" with title \"Science Sandbox\"" 2>/dev/null || true
}

PIDS="$(lsof -ti tcp:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"

if [[ -z "${PIDS}" ]]; then
  echo "Nothing running on port ${PORT}."
  notify "Nothing was running"
  exit 0
fi

kill ${PIDS}

for _ in $(seq 1 10); do
  if [[ -z "$(lsof -ti tcp:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)" ]]; then
    break
  fi
  sleep 0.3
done

REMAINING="$(lsof -ti tcp:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${REMAINING}" ]]; then
  kill -9 ${REMAINING}
fi

echo "Stopped dev server on port ${PORT} (pid(s): ${PIDS})."
notify "Server stopped"
