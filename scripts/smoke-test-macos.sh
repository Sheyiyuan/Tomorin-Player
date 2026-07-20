#!/usr/bin/env bash
set -euo pipefail

APP_PATH=${1:-build/bin/half-beat.app}
[[ -f "$APP_PATH/Contents/Info.plist" ]] || { echo "Invalid app bundle: $APP_PATH" >&2; exit 1; }

APP_EXECUTABLE=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Contents/Info.plist")
APP_BINARY="$APP_PATH/Contents/MacOS/$APP_EXECUTABLE"
[[ -x "$APP_BINARY" ]] || { echo "App executable is missing: $APP_BINARY" >&2; exit 1; }

app_pid=""

cleanup() {
  if [[ -n "$app_pid" ]] && kill -0 "$app_pid" 2>/dev/null; then
    kill "$app_pid" 2>/dev/null || true
    for _ in {1..10}; do
      kill -0 "$app_pid" 2>/dev/null || break
      sleep 0.5
    done
    kill -9 "$app_pid" 2>/dev/null || true
  fi
  [[ -z "$app_pid" ]] || wait "$app_pid" 2>/dev/null || true
}
trap cleanup EXIT

"$APP_BINARY" &
app_pid=$!

sleep 10
if ! kill -0 "$app_pid" 2>/dev/null; then
  echo "macOS app exited during GUI launch smoke test" >&2
  exit 1
fi

echo "macOS GUI launch smoke test passed."
