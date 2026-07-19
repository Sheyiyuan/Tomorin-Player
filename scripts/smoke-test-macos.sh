#!/usr/bin/env bash
set -euo pipefail

APP_PATH=${1:-build/bin/half-beat.app}
[[ -f "$APP_PATH/Contents/Info.plist" ]] || { echo "Invalid app bundle: $APP_PATH" >&2; exit 1; }

open -n -W "$APP_PATH" &
launcher_pid=$!

cleanup() {
  osascript -e 'tell application id "com.sheyiyuan.half-beat" to quit' >/dev/null 2>&1 || true
  wait "$launcher_pid" 2>/dev/null || true
}
trap cleanup EXIT

sleep 10
if ! kill -0 "$launcher_pid" 2>/dev/null; then
  echo "macOS app exited during GUI launch smoke test" >&2
  exit 1
fi

running=$(osascript -e 'application id "com.sheyiyuan.half-beat" is running')
[[ "$running" == "true" ]] || { echo "macOS application process is not running" >&2; exit 1; }

echo "macOS GUI launch smoke test passed."
