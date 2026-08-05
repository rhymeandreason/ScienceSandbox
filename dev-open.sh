#!/usr/bin/env bash
# Start the demos dev server (demos/tools/dev-server.js) if it's not already
# running, wait for it to answer, then open the lesson index in the browser.
# Pass lesson names to open those too:  ./dev-open.sh water-lab contrast-lab
set -euo pipefail
# Monitor mode: puts the backgrounded server in its own process group, so it
# survives signals sent to this script's group (e.g. Studio's own dev-server
# restarts) instead of dying with them.
set -m

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8817
BASE_URL="http://localhost:${PORT}"
LOG_FILE="/tmp/sciencesandbox-dev-server.log"
# Just the lesson index by default — it links to every lesson, so opening two
# more tabs only guessed at which one you wanted. Name pages as arguments to
# open them too, either way round:  ./dev-open.sh water-lab  molecule-builder
#
# The server's root is the REPO root, not demos/ — that is what GitHub Pages
# publishes, so a local URL is the URL that ships. `/` is the index; a lesson
# is `/demos/…`, and a bare name gets that prefix and `.html` filled in.
PAGES=("${BASE_URL}/")
for arg in "$@"; do
  case "${arg}" in
    http*)     PAGES+=("${arg}") ;;
    /*)        PAGES+=("${BASE_URL}${arg}") ;;
    *.html)    PAGES+=("${BASE_URL}/demos/${arg}") ;;
    *)         PAGES+=("${BASE_URL}/demos/${arg}.html") ;;
  esac
done

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
