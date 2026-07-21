#!/usr/bin/env bash
set -euo pipefail

# Half Beat Player - macOS build script
# Usage: APP_VERSION=1.2.0 scripts/build-macos.sh [-c]
# Requires: macOS host, Xcode toolchain, Wails CLI, Node/pnpm, create-dmg

CLEAN=false
if [[ ${1:-} == "-c" ]]; then CLEAN=true; fi

APP_VERSION=${APP_VERSION:-}
if [[ -z "$APP_VERSION" ]]; then
  if [[ -f frontend/package.json ]]; then
    APP_VERSION=$(jq -r .version frontend/package.json)
  else
    echo "APP_VERSION not provided and frontend/package.json missing" >&2
    exit 1
  fi
fi

export APP_VERSION
export VITE_APP_VERSION="$APP_VERSION"

go run ./scripts/verify-app-icon

ARGS=(build -platform darwin/universal -clean)
$CLEAN || ARGS=(build -platform darwin/universal)

# Temporarily patch wails.json productVersion
BACKUP_WAILS_JSON="wails.json.bak"
cp wails.json "$BACKUP_WAILS_JSON"
jq --arg ver "$APP_VERSION" '.info.productVersion = $ver' wails.json > wails.json.tmp && mv wails.json.tmp wails.json
trap 'mv -f "$BACKUP_WAILS_JSON" wails.json 2>/dev/null || true' EXIT

bash scripts/wails.sh "${ARGS[@]}"

APP_PATH="build/bin/half-beat.app"
DMG_PATH="build/bin/half-beat-${APP_VERSION}.dmg"
[[ -f "$APP_PATH/Contents/Info.plist" ]] || { echo "Invalid app bundle: Info.plist is missing" >&2; exit 1; }
ICON_NAME=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' "$APP_PATH/Contents/Info.plist")
[[ "$ICON_NAME" == "iconfile" ]] || { echo "Unexpected CFBundleIconFile: $ICON_NAME" >&2; exit 1; }
[[ -s "$APP_PATH/Contents/Resources/iconfile.icns" ]] || { echo "Generated iconfile.icns is missing" >&2; exit 1; }

command -v create-dmg >/dev/null || { echo "create-dmg is required" >&2; exit 1; }
rm -f "$DMG_PATH"
create-dmg \
  --volname "half-beat" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "half-beat.app" 200 190 \
  --hide-extension "half-beat.app" \
  --app-drop-link 600 185 \
  "$DMG_PATH" \
  "$APP_PATH"
[[ -s "$DMG_PATH" ]] || { echo "DMG was not created" >&2; exit 1; }

echo "macOS build done. Artifacts in build/bin/"
