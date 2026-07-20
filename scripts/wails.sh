#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
WAILS_VERSION=${WAILS_VERSION:-v2.11.0}

cd "$ROOT_DIR"

if [[ -n "${WAILS_CMD:-}" ]]; then
  WAILS=("$WAILS_CMD")
elif command -v wails >/dev/null 2>&1; then
  WAILS=(wails)
elif [[ -x "${HOME}/go/bin/wails" ]]; then
  WAILS=("${HOME}/go/bin/wails")
elif command -v go >/dev/null 2>&1; then
  WAILS=(go run "github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}")
else
  echo "Wails is unavailable. Install it or set WAILS_CMD." >&2
  exit 1
fi

ARGS=("$@")
COMMAND=${ARGS[0]:-}
PLATFORM=""
HAS_TAGS=false

# Wails keeps running after its dev proxy fails to bind. In that state the
# application window can open while every Vite module request returns 502,
# which WebKit reports as a generic module-script import error. Fail before
# starting the frontend watcher so the stale process is immediately visible.
if [[ "$COMMAND" == "dev" ]]; then
  DEV_SERVER="localhost:34115"
  for ((i = 0; i < ${#ARGS[@]}; i++)); do
    case "${ARGS[$i]}" in
      -devserver)
        if ((i + 1 < ${#ARGS[@]})); then
          DEV_SERVER=${ARGS[$((i + 1))]}
        fi
        ;;
      -devserver=*) DEV_SERVER=${ARGS[$i]#-devserver=} ;;
    esac
  done

  DEV_HOST=${DEV_SERVER%:*}
  DEV_PORT=${DEV_SERVER##*:}
  DEV_HOST=${DEV_HOST#[}
  DEV_HOST=${DEV_HOST%]}
  if [[ "$DEV_PORT" != "0" ]] && (exec 3<>"/dev/tcp/${DEV_HOST}/${DEV_PORT}") 2>/dev/null; then
    exec 3>&-
    echo "Wails dev server ${DEV_SERVER} is already in use." >&2
    echo "Stop the existing Wails process or pass -devserver host:port to use another port." >&2
    exit 1
  fi
fi

for ((i = 0; i < ${#ARGS[@]}; i++)); do
  case "${ARGS[$i]}" in
    -platform)
      if ((i + 1 < ${#ARGS[@]})); then
        PLATFORM=${ARGS[$((i + 1))]}
      fi
      ;;
    -platform=*) PLATFORM=${ARGS[$i]#-platform=} ;;
    -tags|-tags=*) HAS_TAGS=true ;;
  esac
done

if [[ -z "$PLATFORM" ]]; then
  case "$(uname -s)" in
    Linux) PLATFORM="linux" ;;
    Darwin) PLATFORM="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  esac
fi

if [[ "$HAS_TAGS" == false && ("$COMMAND" == "build" || "$COMMAND" == "dev") && "$PLATFORM" == linux* ]]; then
  if [[ -n "${WAILS_TAGS+x}" ]]; then
    TAGS=$WAILS_TAGS
  elif command -v pkg-config >/dev/null 2>&1 && pkg-config --exists webkit2gtk-4.1; then
    TAGS=webkit2_41
  elif command -v pkg-config >/dev/null 2>&1 && pkg-config --exists webkit2gtk-4.0; then
    TAGS=""
  else
    echo "WebKitGTK development files were not found (webkit2gtk-4.1 or 4.0)." >&2
    exit 1
  fi

  if [[ -n "$TAGS" ]]; then
    ARGS+=(-tags "$TAGS")
  fi
fi

exec "${WAILS[@]}" "${ARGS[@]}"
