#!/usr/bin/env bash
set -euo pipefail

# Cross-compile Windows build using mingw-w64 and NSIS
# Usage: scripts/windows/build-windows.sh [-c]

CLEAN=false
if [[ ${1:-} == "-c" ]]; then CLEAN=true; fi

# Ensure deps
command -v x86_64-w64-mingw32-gcc >/dev/null || { echo "Install mingw-w64: sudo apt install gcc-mingw-w64-x86-64"; exit 1; }
command -v makensis >/dev/null || command -v nsis >/dev/null || { echo "Install NSIS: sudo apt install nsis"; exit 1; }

go run ./scripts/verify-app-icon

export CGO_ENABLED=1
export CC=x86_64-w64-mingw32-gcc
export CXX=x86_64-w64-mingw32-g++

# Version injection: prefer APP_VERSION env; else read from frontend/package.json
VERSION=${APP_VERSION:-}
if [[ -z "$VERSION" && -f frontend/package.json ]]; then VERSION=$(jq -r .version frontend/package.json); fi
if [[ -z "$VERSION" ]]; then echo "APP_VERSION not set and package.json missing"; exit 1; fi

# Frontend always gets full version (e.g., 0.1.1-dev.20251228.abc1234)
export VITE_APP_VERSION="$VERSION"

# Wails' NSIS template appends the fourth numeric component itself.
VERSION_BASE="${VERSION%%-*}"  # Get x.y.z part before first dash
if [[ ! $VERSION_BASE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Windows product version must start with x.y.z: $VERSION" >&2
    exit 1
fi
NSIS_VERSION="$VERSION_BASE"
echo "Full version: $VERSION"
echo "NSIS version: $NSIS_VERSION"

# Wails only generates this derivative when it does not already exist.
rm -f build/windows/icon.ico

BACKUP_WAILS_JSON="wails.json.bak"
cp wails.json "$BACKUP_WAILS_JSON"
jq --arg ver "$NSIS_VERSION" '.info.productVersion = $ver' wails.json > wails.json.tmp && mv wails.json.tmp wails.json
trap 'mv -f "$BACKUP_WAILS_JSON" wails.json 2>/dev/null || true' EXIT

ARGS=(build -platform windows/amd64 -nsis)
$CLEAN && ARGS=(build -platform windows/amd64 -nsis -clean)

echo "Building Windows binary with CGO_ENABLED=$CGO_ENABLED CC=$CC CXX=$CXX"
bash scripts/wails.sh "${ARGS[@]}"
CGO_ENABLED=0 go run ./scripts/verify-windows-icon build/bin/half-beat.exe

echo "Artifacts in build/bin/"
