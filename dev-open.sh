#!/usr/bin/env bash
# Start the demos dev server (demos/tools/dev-server.js) if it's not already
# running, wait for it to answer, then open the app pages in the browser.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8817
BASE_URL="http://localhost:${PORT}"
LOG_FILE="/tmp/sciencesandbox-dev-server.log"
PAGES=(
  "${BASE_URL}/"
  "${BASE_URL}/water-lab.html"
  "${BASE_URL}/molecule-builder.html"
)

notify() {
  osascript -e "display notification \"$1\" with title \"Science Sandbox\"" 2>/dev/null || true
}

is_up() {
  curl -s -o /dev/null -m 2 "${BASE_URL}/"
}

if is_up; then
  echo "Dev server already running on port ${PORT}."
else
  echo "Starting dev server on port ${PORT}…"
  (cd "${REPO_DIR}/demos" && nohup node tools/dev-server.js "${PORT}" >"${LOG_FILE}" 2>&1 &)

  for _ in $(seq 1 30); do
    if is_up; then
      break
    fi
    sleep 0.5
  done

  if ! is_up; then
    echo "Server did not come up in time. Check ${LOG_FILE}." >&2
    notify "Failed to start server"
    exit 1
  fi
fi

for page in "${PAGES[@]}"; do
  open "${page}"
done

notify "Server is running"
echo "Server is running at ${BASE_URL}"
